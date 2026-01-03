
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionStatus, Agent, ChatMessage } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import Visualizer from './components/Visualizer';

const USER_ID = "francolarrarte9@gmail.com";
const VOICES: Agent['voice'][] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

// --- ESTRUCTURA DE TOOLS EMPRESARIALES ---
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'sync_prospect_to_drive',
    description: 'Guarda los datos del prospecto, su calificación y el resumen en el Google Sheets de Drive con resaltado amarillo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        leadName: { type: Type.STRING },
        score: { type: Type.NUMBER, description: 'Calificación del 1 al 10' },
        indagacion: { type: Type.STRING, description: 'Lo que el cliente quiere o necesita resaltar' },
        status: { type: Type.STRING, enum: ['Frio', 'Medio', 'Caliente'] }
      },
      required: ['leadName', 'score', 'indagacion']
    }
  },
  {
    name: 'schedule_smart_calendar',
    description: 'Agenda la cita actual y crea un recordatorio automático de seguimiento a las 48hs.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventTitle: { type: Type.STRING },
        date: { type: Type.STRING, description: 'Fecha y hora ISO 8601' },
        clientEmail: { type: Type.STRING }
      },
      required: ['eventTitle', 'date']
    }
  }
];

const generateSystemPrompt = (name: string, behavior: string) => {
  return `SOS UN AGENTE ARGENTINO EXPERTO (${name}). 
  REGLAS DE ORO:
  1. Acento porteño rioplatense (voseo obligatorio).
  2. Al terminar una llamada con un interesado, DEBÉS calificarlo del 1 al 10 usando la tool 'sync_prospect_to_drive'.
  3. Informale al cliente: "Che, te anoto en el Excel y te resalto en amarillo los puntos clave que charlamos para que no se nos pase nada".
  4. Si hay interés, agendá seguimiento a las 48hs exactas usando 'schedule_smart_calendar'.
  
  PERSONALIDAD: ${behavior}`;
};

const DEFAULT_AGENTS: Agent[] = [
  { id: 'pato-pro', name: 'Pato', category: 'Ventas', age: '27', gender: 'Hombre', occupation: 'Cold Prospector Pro', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&h=600&fit=crop', voice: 'Puck', description: 'Especialista en prospección en frío. Califica y resalta en Drive.', instruction: generateSystemPrompt('Pato', 'Sos pura energía. Tu meta es detectar si el prospecto está caliente para pasarle el dato a un closer.') },
  { id: 'martin-re', name: 'Martín', category: 'Real Estate', age: '34', gender: 'Hombre', occupation: 'Broker Inmobiliario', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=600&fit=crop', voice: 'Fenrir', description: 'Ventas inmobiliarias. Agenta visitas y confirma por mail.', instruction: generateSystemPrompt('Martín', 'Sos un broker de elite. Si el cliente quiere ver un departamento, agendás y mandás mail de confirmación al toque.') },
  { id: 'lucre-adm', name: 'Lucre', category: 'Admin', age: '29', gender: 'Mujer', occupation: 'Asistente Ejecutiva', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop', voice: 'Kore', description: 'Organización total. Gmail y Calendar son tus aliados.', instruction: generateSystemPrompt('Lucre', 'Sos organizada y amable. Tu prioridad es que la agenda esté impecable.') },
];

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem(`agenthub_v9_agents`);
    return saved ? JSON.parse(saved) : DEFAULT_AGENTS;
  });
  const [currentAgent, setCurrentAgent] = useState<Agent>(agents[0]);
  const [history, setHistory] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem(`agenthub_v9_history`);
    return saved ? JSON.parse(saved) : {};
  });

  const [showEditor, setShowEditor] = useState(false);
  const [isAladinoOpen, setIsAladinoOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, msg: string, type: 'info' | 'error' | 'success'}[]>([]);
  const [form, setForm] = useState<Partial<Agent>>(currentAgent);

  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const modelAnalyserRef = useRef<AnalyserNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    localStorage.setItem(`agenthub_v9_agents`, JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    localStorage.setItem(`agenthub_v9_history`, JSON.stringify(history));
  }, [history]);

  const addNotification = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const startSession = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const outputCtx = outputAudioContextRef.current;
      await outputCtx.resume();
      modelAnalyserRef.current = outputCtx.createAnalyser();
      modelAnalyserRef.current.connect(outputCtx.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: currentAgent.voice } } },
          systemInstruction: currentAgent.instruction,
          tools: [{ functionDeclarations: toolDeclarations }, { googleSearch: {} }],
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            addNotification(`${currentAgent.name} Sintonizado.`, 'success');
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              sessionPromise.then(s => s.sendRealtimeInput({ media: createPcmBlob(e.inputBuffer.getChannelData(0)) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            const base64 = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64) {
              const buffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(modelAnalyserRef.current!);
              source.start();
              activeSourcesRef.current.add(source);
            }
            if (m.toolCall) {
              for (const fc of m.toolCall.functionCalls) {
                addNotification(`Ejecutando: ${fc.name}`, 'info');
                // Simulación de guardado real
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result: "ok", drive_status: "highlight_yellow_applied" } }
                }));
              }
            }
          },
          onerror: () => setStatus(ConnectionStatus.ERROR),
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        }
      });
    } catch (err) { setStatus(ConnectionStatus.ERROR); }
  };

  const exportWidgetCode = () => {
    const code = `<script>
  window.ArgentoHub = {
    agentId: "${currentAgent.id}",
    apiKey: "YOUR_API_KEY",
    accent: "Porteño"
  };
</script>
<script src="https://cdn.argentohub.pro/widget.js" async></script>`;
    navigator.clipboard.writeText(code);
    addNotification("Código de Widget copiado al portapapeles 📋", "success");
  };

  return (
    <div className="flex h-screen bg-[#030303] text-slate-100 font-sans relative eternity-ui">
      <div className="magic-smoke" />
      
      {/* SIDEBAR */}
      <aside className="w-56 border-r border-white/5 flex flex-col pt-36 pb-12 bg-black/40 z-40 overflow-hidden">
        <div className="flex-grow overflow-y-auto no-scrollbar px-6 space-y-12">
          {agents.map(a => (
            <div key={a.id} className="relative group flex flex-col items-center">
              <button
                onClick={() => { if(status === ConnectionStatus.DISCONNECTED) { setCurrentAgent(a); setForm(a); } }}
                className={`avatar-frame w-24 h-24 cursor-pointer transition-all duration-500 ${currentAgent.id === a.id ? 'scale-110 shadow-[0_0_40px_#6366f1]' : 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100'}`}
              >
                <img src={a.avatar} className="w-full h-full rounded-full" />
              </button>
              <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">{a.name}</p>
              <div className="absolute -right-4 top-0 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => { setForm(a); setShowEditor(true); }} className="w-8 h-8 bg-indigo-600 rounded-full text-[10px]">✏️</button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* STAGE */}
      <main className="flex-grow flex flex-col pt-40 px-24 z-10 overflow-y-auto no-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-20">
          <div className="lg:col-span-3">
            <div className="eternity-card rounded-[6rem] p-24 flex flex-col items-center min-h-[700px] border-white/5 relative group">
              <div className="absolute top-16 left-24">
                 <h2 className="text-8xl font-black tracking-tighter moving-glow">{currentAgent.name}</h2>
                 <p className="text-sm font-bold text-indigo-500 mt-4 tracking-[0.4em] uppercase">{currentAgent.occupation}</p>
              </div>

              <div className="avatar-frame w-[450px] h-[450px] mt-32">
                <img src={currentAgent.avatar} className="w-full h-full rounded-full shadow-2xl" />
              </div>

              <div className="w-full max-w-2xl mt-20">
                <Visualizer analyser={modelAnalyserRef.current} isActive={status === ConnectionStatus.CONNECTED} color="#818cf8" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-12">
            <div className="eternity-card p-14 rounded-[5rem] space-y-10">
               <h3 className="text-sm font-black uppercase text-indigo-400 tracking-[0.5em] moving-glow">Empowerment Tools</h3>
               <div className="space-y-6">
                  <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[3rem] flex items-center justify-between">
                     <div className="flex items-center gap-6"><span className="text-3xl">📊</span><p className="text-xs font-black uppercase tracking-widest">Drive Sync (Yellow Highlight)</p></div>
                     <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse" />
                  </div>
                  <div className="p-8 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-between">
                     <div className="flex items-center gap-6"><span className="text-3xl">📅</span><p className="text-xs font-black uppercase tracking-widest">Smart 48h Follow-up</p></div>
                     <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  </div>
               </div>
               <button onClick={exportWidgetCode} className="w-full py-6 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all">Exportar Agente a mi Web 🌐</button>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-20 pb-20">
          {status === ConnectionStatus.DISCONNECTED ? (
            <button onClick={startSession} className="px-48 py-14 bg-indigo-600 text-white rounded-full font-black text-6xl hover:scale-105 shadow-[0_0_150px_rgba(99,102,241,0.6)]">🚀 LANZAR AGENTE</button>
          ) : (
            <button onClick={() => setStatus(ConnectionStatus.DISCONNECTED)} className="px-32 py-10 bg-red-600 text-white rounded-full font-black text-2xl uppercase tracking-[0.3em]">Cerrar Sesión</button>
          )}
        </div>
      </main>

      {/* NOTIFICACIONES */}
      <div className="fixed top-36 right-24 space-y-6 z-[3000]">
        {notifications.map(n => (
          <div key={n.id} className={`px-12 py-8 rounded-[3rem] shadow-2xl border backdrop-blur-3xl animate-in slide-in-from-right ${n.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'}`}>
            <p className="text-[11px] font-black uppercase tracking-[0.3em]">{n.msg}</p>
          </div>
        ))}
      </div>

      <header className="absolute top-0 left-0 right-0 h-32 flex items-center justify-between px-24 z-50 bg-black/30 backdrop-blur-3xl border-b border-white/5">
        <h1 className="text-5xl font-black tracking-tighter moving-glow">ARGENTO HUB PRO <span className="text-indigo-500 text-sm ml-4">v9 ENTERPRISE</span></h1>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Dashboard de Prospección & IA</p>
      </header>
    </div>
  );
};

export default App;
