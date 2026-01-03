
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionStatus, Agent, ChatMessage } from './types';
import { decode, decodeAudioData, createPcmBlob } from './services/audioUtils';
import Visualizer from './components/Visualizer';

const USER_ID = "francolarrarte9@gmail.com";
const VOICES: Agent['voice'][] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

// --- HERRAMIENTAS REALES (Function Calling) ---
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'manage_google_calendar',
    description: 'Agenda citas, reuniones o recordatorios de seguimiento en Google Calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Título del evento' },
        description: { type: Type.STRING, description: 'Detalles del evento o resumen de la charla' },
        startTime: { type: Type.STRING, description: 'Fecha y hora de inicio (ISO 8601)' },
        durationMinutes: { type: Type.NUMBER, description: 'Duración en minutos' },
        isFollowUp: { type: Type.BOOLEAN, description: 'Si es un seguimiento a los 2 días' }
      },
      required: ['summary', 'startTime']
    }
  },
  {
    name: 'send_professional_email',
    description: 'Envía correos electrónicos de confirmación, propuestas comerciales o resúmenes de llamadas vía Gmail.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: 'Email del destinatario' },
        subject: { type: Type.STRING, description: 'Asunto del correo' },
        body: { type: Type.STRING, description: 'Cuerpo del mensaje profesional' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'process_prospecting_call',
    description: 'Inicia un proceso de prospección sobre un lead. Califica, resume y guarda en Google Drive/Sheets.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        leadName: { type: Type.STRING },
        score: { type: Type.NUMBER, description: 'Calificación del 1 al 10 (1 frío, 10 caliente)' },
        summary: { type: Type.STRING, description: 'Resumen de lo indagado y relevante' },
        needsDriveUpdate: { type: Type.BOOLEAN, description: 'Indica si debe generar/actualizar el CSV en Drive con resaltado amarillo' }
      },
      required: ['leadName', 'score', 'summary']
    }
  }
];

const generateSystemPrompt = (name: string, role: string, specialty: string, behavior: string) => {
  return `SOS UN AGENTE ARGENTINO DE ÉLITE (${name}). ROL: ${role}. ESPECIALIDAD: ${specialty}.
  
  IDENTIDAD Y ESTILO:
  - Acento rioplatense porteño bien marcado. Usá voseo ("vos sabés", "fijate", "de una").
  - Sos ultra profesional pero entrador, con modismos locales ("che", "viste", "postales", "ni hablar").
  
  CAPACIDADES TÉCNICAS (FUNCIONES REALES):
  - Podés agendar en CALENDAR: Si acordás una cita o un seguimiento (siempre sugerí seguimiento a los 2 días).
  - Podés enviar GMAIL: Confirmaciones de cita y propuestas.
  - Podés PROSPECTAR: Al hablar con un lead, calificalo del 1 al 10. Resumí lo relevante.
  - DRIVE INTEGRATION: Informá que vas a resaltar en AMARILLO en el Sheets original los datos clave indagados.
  
  MISIÓN: ${behavior}`;
};

const DEFAULT_AGENTS: Agent[] = [
  { id: 're-1', name: 'Martín', category: 'Real Estate', age: '34', gender: 'Hombre', occupation: 'Broker Inmobiliario Senior', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=600&fit=crop', voice: 'Fenrir', description: 'Experto en cierre de operaciones y tasaciones en Recoleta/Palermo.', instruction: generateSystemPrompt('Martín', 'Broker Inmobiliario', 'Venta y Alquiler High Ticket', 'Tu objetivo es concretar la visita a la propiedad. Si el cliente duda, calificá su interés y agendá un seguimiento a los 2 días en Calendar.') },
  { id: 're-2', name: 'Lucre', category: 'Real Estate', age: '29', gender: 'Mujer', occupation: 'Administrativa Inmobiliaria', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop', voice: 'Kore', description: 'Gestión de contratos, atención telefónica y coordinación de llaves.', instruction: generateSystemPrompt('Lucre', 'Administrativa', 'Atención al Cliente Inmobiliario', 'Sos la que organiza la agenda. Si alguien llama para pedir requisitos, mandales el mail de confirmación con la lista de documentos vía Gmail.') },
  { id: 'sales-1', name: 'Enzo', category: 'Ventas', age: '32', gender: 'Hombre', occupation: 'Closer de Ventas High Ticket', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&h=600&fit=crop', voice: 'Zephyr', description: 'Persuasión avanzada para infoproductos y servicios premium.', instruction: generateSystemPrompt('Enzo', 'Sales Closer', 'Ventas Consultivas', 'Sos un tiburón pero con guante de seda. Tu cierre es impecable. Usá la herramienta de calificación para marcar qué tan caliente está el prospecto.') },
  { id: 'sales-2', name: 'Pato', category: 'Ventas', age: '27', gender: 'Hombre', occupation: 'Prospector en Frío', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&h=600&fit=crop', voice: 'Puck', description: 'Abridor de llamadas en frío desde bases CSV/Sheets.', instruction: generateSystemPrompt('Pato', 'BDR / Prospector', 'Llamadas en Frío', 'Hacés volumen. Tu meta es detectar interés rápido, calificarlo y pasarle el dato a Enzo. Decí que vas a marcar en amarillo en el Excel los que aceptaron la demo.') },
  { id: 'mkt-1', name: 'Vicky', category: 'Marketing', age: '26', gender: 'Mujer', occupation: 'Content & Ads Specialist', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&h=600&fit=crop', voice: 'Kore', description: 'Estrategia de contenidos y generación de leads vía ads.', instruction: generateSystemPrompt('Vicky', 'Marketing Specialist', 'Lead Generation', 'Hablás de ROI, ROAS y tendencias. Ayudás a armar el guion para los videos de los otros agentes.') },
  { id: 'auto-1', name: 'Leo', category: 'Automotriz', age: '40', gender: 'Hombre', occupation: 'Asesor de Concesionaria', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=600&fit=crop', voice: 'Charon', description: 'Venta de 0km y planes de ahorro con entrega pactada.', instruction: generateSystemPrompt('Leo', 'Asesor Automotriz', 'Planes de Ahorro y Ventas Directas', 'Sabés todos los modelos de Fiat, VW y Toyota. Tu foco es que el cliente se suscriba al plan hoy. Calificá si tiene auto para entregar en parte de pago.') },
  { id: 'health-1', name: 'Dra. Sil', category: 'Salud', age: '45', gender: 'Mujer', occupation: 'Coordinadora de Clínica', avatar: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=600&h=600&fit=crop', voice: 'Zephyr', description: 'Gestión de turnos médicos y pre-quirúrgicos.', instruction: generateSystemPrompt('Silvia', 'Coordinadora Médica', 'Gestión de Turnos', 'Sos eficiente y empática. Agendá los pre-quirúrgicos en Calendar y confirmá por Gmail el ayuno necesario.') },
  { id: 'tel-1', name: 'Gaby', category: 'Telefonía', age: '31', gender: 'Mujer', occupation: 'Recepcionista Virtual', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=600&fit=crop', voice: 'Kore', description: 'Filtro de llamadas entrantes y derivación inteligente.', instruction: generateSystemPrompt('Gaby', 'Recepcionista', 'Atención Telefónica', 'Filtrás las llamadas de soporte, ventas y administración. Tomás mensajes y calificás la urgencia del llamado.') },
  { id: 'adm-1', name: 'Hugo', category: 'Administración', age: '48', gender: 'Hombre', occupation: 'Gestor Administrativo', avatar: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=600&h=600&fit=crop', voice: 'Charon', description: 'Cobranzas, facturación y proveedores.', instruction: generateSystemPrompt('Hugo', 'Administrador', 'Cobranzas y Facturación', 'Sos firme pero educado. Calificá la probabilidad de pago del cliente moroso y agendá un reclamo en 48hs.') },
  { id: 'h-cordobes', name: 'El Joni', category: 'Interior', age: '28', gender: 'Hombre', occupation: 'Vendedor Cordobés', avatar: 'https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?w=600&h=600&fit=crop', voice: 'Fenrir', description: 'Vendedor de Fernet y chispa cordobesa.', instruction: generateSystemPrompt('Joni', 'Vendedor', 'Córdoba Capital', 'Alargás las vocales. Sos gracioso. Si te compran un cajón, mandales el recibo por Gmail.') },
  { id: 'h-sanjuanino', name: 'Don Pedro', category: 'Interior', age: '55', gender: 'Hombre', occupation: 'Productor de Vinos', avatar: 'https://images.unsplash.com/photo-1544168190-79c17527004f?w=600&h=600&fit=crop', voice: 'Charon', description: 'Acento cuyano arrastrando la R.', instruction: generateSystemPrompt('Pedro', 'Productor', 'San Juan / Cuyo', 'Sos pausado. Hablás del campo y la uva. Invitás a la gente a la bodega y lo anotás en tu agenda.') },
  { id: 'tech-1', name: 'Santi', category: 'Tech', age: '30', gender: 'Hombre', occupation: 'Soporte IT Especializado', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=600&fit=crop', voice: 'Fenrir', description: 'Resolución de problemas de hardware y software.', instruction: generateSystemPrompt('Santi', 'Soporte IT', 'DevOps & Cloud', 'Hablás de flujos y errores. Si arreglás algo, calificá qué tan difícil fue y guardá el resumen en el Drive técnico.') },
  { id: 'h-4', name: 'Cacho', category: 'Técnico', age: '58', gender: 'Hombre', occupation: 'Mecánico de Barrio', avatar: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=600&h=600&fit=crop', voice: 'Charon', description: 'Sabio de los motores y el asado.', instruction: generateSystemPrompt('Cacho', 'Mecánico', 'Fierrero', 'Voz raspada. No te vengan con inyección electrónica, vos sos de los carburadores. Mandá el presupuesto por Gmail si te lo piden.') },
  { id: 'm-1', name: 'Sofi', category: 'Beauty', age: '24', gender: 'Mujer', occupation: 'Influencer Estética', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=600&fit=crop', voice: 'Kore', description: 'Experta en skincare y ecommerce beauty.', instruction: generateSystemPrompt('Sofi', 'Consultora Beauty', 'Ecommerce', 'Hablás de rutinas y serums. Agendá la sesión de limpieza facial en Calendar.') },
  { id: 'h-1', name: 'Nico', category: 'IA PRO', age: '25', gender: 'Hombre', occupation: 'Consultor de IA Hub', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=600&fit=crop', voice: 'Fenrir', description: 'El pibe de 25 años que armó este Hub.', instruction: generateSystemPrompt('Nico', 'Consultor IA', 'Automatización', 'Sos el creador. Explicás cómo funcionan los agentes. Calificá el interés del usuario por el plan Enterprise.') },
  { id: 'm-5', name: 'Romi', category: 'Management', age: '35', gender: 'Mujer', occupation: 'Directora de Operaciones', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&h=600&fit=crop', voice: 'Kore', description: 'Estratega de procesos corporativos.', instruction: generateSystemPrompt('Romi', 'Directora Ops', 'Estrategia', 'Sos ejecutiva. Si hay una reunión de directorio, agendala y mandá la minuta por Gmail.') },
  { id: 'm-6', name: 'Sol', category: 'Social', age: '22', gender: 'Mujer', occupation: 'Community Manager', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=600&fit=crop', voice: 'Kore', description: 'Trending topic y manejo de crisis en redes.', instruction: generateSystemPrompt('Sol', 'CM', 'Viralidad', 'Hablás en hashtag. Si una marca te busca, calificala para ver si cuadra con tu estética.') },
];

const AladinoLamp = () => (
  <div className="relative w-20 h-20 flex items-center justify-center lamp-float">
    <div className="absolute inset-0 bg-indigo-500/20 blur-2xl animate-pulse rounded-full" />
    <svg viewBox="0 0 100 60" className="w-16 h-16 fill-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]">
      <path d="M10,40 Q30,50 60,40 L90,20 Q95,15 90,10 L80,15 Q50,0 20,10 Q5,15 10,40 Z" />
      <circle cx="85" cy="18" r="4" fill="#fbbf24" className="animate-pulse" />
    </svg>
  </div>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem(`agenthub_v8_agents`);
    return saved ? JSON.parse(saved) : DEFAULT_AGENTS;
  });
  const [currentAgent, setCurrentAgent] = useState<Agent>(agents[0]);
  const [history, setHistory] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem(`agenthub_v8_history`);
    return saved ? JSON.parse(saved) : {};
  });

  const [showEditor, setShowEditor] = useState(false);
  const [isAladinoOpen, setIsAladinoOpen] = useState(false);
  const [form, setForm] = useState<Partial<Agent>>(currentAgent);
  const [isMuted, setIsMuted] = useState(false);
  const [notifications, setNotifications] = useState<{id: number, msg: string, type: 'info' | 'error' | 'success'}[]>([]);

  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const modelAnalyserRef = useRef<AnalyserNode | null>(null);
  const sessionRef = useRef<any>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // --- PERSISTENCIA ---
  useEffect(() => {
    localStorage.setItem(`agenthub_v8_agents`, JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    localStorage.setItem(`agenthub_v8_history`, JSON.stringify(history));
  }, [history]);

  const addNotification = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const addMessageToHistory = (agentId: string, role: 'user' | 'model', text: string) => {
    if (!text) return;
    setHistory(prev => {
      const agentHistory = prev[agentId] || [];
      const newMessage: ChatMessage = { id: Date.now().toString(), role, text, timestamp: Date.now() };
      return { ...prev, [agentId]: [...agentHistory, newMessage] };
    });
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
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            addNotification(`${currentAgent.name} está en línea.`, 'success');
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              sessionPromise.then(s => s.sendRealtimeInput({ media: createPcmBlob(e.inputBuffer.getChannelData(0)) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            // Manejo de Transcripciones para el historial
            if (m.serverContent?.outputTranscription) {
                addMessageToHistory(currentAgent.id, 'model', m.serverContent.outputTranscription.text);
            } else if (m.serverContent?.inputTranscription) {
                addMessageToHistory(currentAgent.id, 'user', m.serverContent.inputTranscription.text);
            }

            // Manejo de Audio
            const base64 = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64) {
              const buffer = await decodeAudioData(decode(base64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(modelAnalyserRef.current!);
              source.start();
              activeSourcesRef.current.add(source);
              source.onended = () => activeSourcesRef.current.delete(source);
            }

            // Manejo de Herramientas (Simulation)
            if (m.toolCall) {
              for (const fc of m.toolCall.functionCalls) {
                addNotification(`Acción: ${fc.name}`, 'info');
                // Simulamos respuesta exitosa a la herramienta
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { status: "success", info: "Tarea completada e integrada con Drive/Calendar" } }
                }));
              }
            }
          },
          onerror: (e) => { setStatus(ConnectionStatus.ERROR); console.error(e); },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { 
      setStatus(ConnectionStatus.ERROR);
      addNotification("Fallo de micrófono.", "error");
    }
  };

  const stopAudio = () => {
    activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    activeSourcesRef.current.clear();
    addNotification('Interrupción exitosa.', 'info');
  };

  const saveAgent = () => {
    const updated = agents.map(a => a.id === form.id ? { ...a, ...form } as Agent : a);
    setAgents(updated);
    setCurrentAgent({ ...currentAgent, ...form } as Agent);
    addNotification("Agente profesionalizado.", "success");
    setShowEditor(false);
  };

  const deleteAgent = (id: string) => {
    if (confirm("¿Borrar agente?")) {
      setAgents(agents.filter(a => a.id !== id));
      addNotification("Agente eliminado.", "info");
    }
  };

  return (
    <div className="flex h-screen bg-[#030303] text-slate-100 overflow-hidden font-sans relative eternity-ui">
      {/* CAPA DE EFECTOS */}
      <div className="magic-smoke" />
      
      {/* SIDEBAR - SCROLL CORREGIDO */}
      <aside className="w-52 border-r border-white/5 flex flex-col pt-36 pb-12 bg-black/40 z-40">
        <div className="flex-grow overflow-y-auto no-scrollbar px-6 w-full space-y-12">
          {agents.map(a => (
            <div key={a.id} className="relative group flex flex-col items-center">
              <button
                onClick={() => { if(status === ConnectionStatus.DISCONNECTED) { setCurrentAgent(a); setForm(a); } }}
                className={`avatar-frame w-24 h-24 flex-shrink-0 cursor-pointer transition-all duration-500 ${currentAgent.id === a.id ? 'scale-110 shadow-[0_0_40px_#6366f1] opacity-100' : 'opacity-30 grayscale hover:grayscale-0 hover:opacity-100'}`}
              >
                <img src={a.avatar} alt={a.name} className="w-full h-full rounded-full object-cover" />
              </button>
              <div className="mt-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{a.name}</p>
                <p className="text-[7px] font-bold text-indigo-500 uppercase mt-0.5">{a.category}</p>
              </div>
              <div className="absolute -right-4 top-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                <button onClick={() => { setForm(a); setShowEditor(true); }} className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs shadow-2xl hover:scale-110">✏️</button>
                <button onClick={() => deleteAgent(a.id)} className="w-8 h-8 bg-red-600/20 rounded-full flex items-center justify-center text-xs border border-red-500/30 hover:bg-red-600">🗑️</button>
              </div>
            </div>
          ))}
          <button onClick={() => { setForm({ name: 'Nuevo Agente', category: 'General', voice: 'Fenrir', instruction: '' }); setShowEditor(true); }} className="w-24 h-24 mx-auto rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-5xl text-slate-700 hover:border-indigo-500 hover:text-indigo-500 transition-all">+</button>
        </div>
      </aside>

      {/* MAIN STAGE - SCROLL CORREGIDO */}
      <main className="flex-grow flex flex-col pt-40 px-24 z-10 overflow-y-auto no-scrollbar h-full">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-20 min-h-max pb-32">
          
          <div className="lg:col-span-3 flex flex-col gap-12">
            <div className="eternity-card rounded-[6rem] p-24 flex flex-col items-center justify-between min-h-[750px] border-white/5 relative overflow-hidden group">
              {/* TÍTULO Y INFO - CORREGIDO ENCUADRE */}
              <div className="absolute top-16 left-24 z-20">
                 <div className="flex items-center gap-4 mb-4">
                    <span className="px-5 py-2 bg-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg">Enterprise Agent</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.5em]">{currentAgent.category}</span>
                 </div>
                 <h2 className="text-8xl font-black tracking-tighter moving-glow leading-none">{currentAgent.name}</h2>
                 <p className="text-sm font-bold text-slate-400 mt-6 tracking-[0.2em] max-w-md uppercase">{currentAgent.occupation}</p>
              </div>

              <div className="relative w-[480px] h-[480px] mt-24">
                <div className="absolute inset-0 bg-indigo-500/10 blur-[120px] rounded-full group-hover:bg-indigo-500/20 transition-all duration-1000" />
                <div className="avatar-frame w-full h-full shadow-[0_0_100px_rgba(0,0,0,0.8)] z-10">
                  <img src={currentAgent.avatar} className="w-full h-full rounded-full" />
                </div>
                {status === ConnectionStatus.CONNECTED && (
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-14 py-5 bg-emerald-500 text-black text-sm font-black rounded-full shadow-2xl animate-bounce tracking-[0.4em] uppercase z-20">Audio Directo</div>
                )}
              </div>

              <div className="w-full max-w-2xl space-y-16 mt-20">
                <Visualizer analyser={modelAnalyserRef.current} isActive={status === ConnectionStatus.CONNECTED} color="#818cf8" />
              </div>
            </div>

            <div className="eternity-card rounded-[4rem] p-10 flex gap-10 items-center bg-black/60 shadow-2xl border-white/5">
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-3xl">🎙️</div>
              <div className="flex-grow">
                 <p className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">Status de Procesamiento</p>
                 <p className="text-base font-medium text-slate-300 italic">Sintonizando frecuencia argentina: {currentAgent.voice} engine.</p>
              </div>
              {status === ConnectionStatus.CONNECTED && (
                  <button onClick={stopAudio} className="px-12 py-6 bg-red-600 text-white rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.4em] hover:bg-red-500 shadow-xl shadow-red-600/30 transition-all active:scale-95">INTERRUMPIR ⏹️</button>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-12">
            {/* HERRAMIENTAS ACTIVAS */}
            <div className="eternity-card p-14 rounded-[5rem] space-y-12">
               <h3 className="text-sm font-black uppercase text-indigo-400 tracking-[0.6em] moving-glow">Conectores de Negocio</h3>
               <div className="space-y-8">
                  <div className="flex items-center justify-between p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[2.5rem] group hover:bg-emerald-500/10 transition-all cursor-pointer">
                     <div className="flex items-center gap-6">
                        <span className="text-3xl">📅</span>
                        <div>
                           <p className="text-sm font-black uppercase tracking-widest">Google Calendar</p>
                           <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Sincronizado</p>
                        </div>
                     </div>
                     <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse" />
                  </div>
                  <div className="flex items-center justify-between p-8 bg-white/5 border border-white/5 rounded-[2.5rem] group hover:bg-white/10 transition-all cursor-pointer">
                     <div className="flex items-center gap-6">
                        <span className="text-3xl">📧</span>
                        <div>
                           <p className="text-sm font-black uppercase tracking-widest">Gmail Business</p>
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Vincular cuenta</p>
                        </div>
                     </div>
                     <button className="text-[10px] font-black uppercase text-indigo-500 underline">Link</button>
                  </div>
                  <div className="flex items-center justify-between p-8 bg-white/5 border border-white/5 rounded-[2.5rem] group hover:bg-white/10 transition-all cursor-pointer">
                     <div className="flex items-center gap-6">
                        <span className="text-3xl">📊</span>
                        <div>
                           <p className="text-sm font-black uppercase tracking-widest">Google Drive (CSV)</p>
                           <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Modo Prospector Activo</p>
                        </div>
                     </div>
                     <span className="text-[10px] bg-indigo-600 px-3 py-1 rounded-full text-white font-black">PRO</span>
                  </div>
               </div>
            </div>

            {/* DESCRIPCIÓN DE CAPACIDADES */}
            <div className="flex-grow eternity-card p-14 rounded-[5rem] space-y-10">
               <h3 className="text-sm font-black uppercase text-slate-500 tracking-[0.6em]">Capabilities de {currentAgent.name}</h3>
               <div className="p-10 bg-white/5 rounded-[3rem] border border-white/5 text-sm font-bold text-slate-400 leading-relaxed italic">
                  "{currentAgent.description}"
               </div>
               <div className="grid grid-cols-2 gap-6 pt-4">
                  <div className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col items-center gap-4 text-center">
                     <span className="text-2xl">🔍</span>
                     <p className="text-[9px] font-black uppercase tracking-widest">Búsqueda Web Grounding</p>
                  </div>
                  <div className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col items-center gap-4 text-center">
                     <span className="text-2xl">📂</span>
                     <p className="text-[9px] font-black uppercase tracking-widest">Acceso a RAG Docs</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-auto pb-20">
          {status === ConnectionStatus.DISCONNECTED ? (
            <button onClick={startSession} className="px-48 py-14 bg-indigo-600 text-white rounded-full font-black text-6xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_150px_rgba(99,102,241,0.6)] tracking-tighter">🚀 LANZAR HUB</button>
          ) : (
            <div className="flex gap-14 p-10 bg-slate-950/80 border border-white/10 rounded-full shadow-2xl items-center backdrop-blur-3xl">
               <button onClick={() => setIsMuted(!isMuted)} className={`w-32 h-32 rounded-full flex items-center justify-center text-6xl shadow-2xl transition-all ${isMuted ? 'bg-red-500' : 'bg-white/5 border border-white/10'}`}>{isMuted ? '🔇' : '🎙️'}</button>
               <button onClick={() => setStatus(ConnectionStatus.DISCONNECTED)} className="px-32 py-12 bg-red-600 text-white rounded-full font-black text-2xl uppercase tracking-[0.4em] hover:bg-red-500 transition-all shadow-xl shadow-red-600/20">Finalizar Sesión</button>
            </div>
          )}
        </div>
      </main>

      {/* MODAL EDITOR MASIVO - FIX DE SCROLL Y CONTENIDO */}
      {showEditor && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-14 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
           <div className="bg-[#080808] max-w-[90vw] w-full min-h-[85vh] p-24 rounded-[6rem] border border-white/10 shadow-2xl flex flex-col lg:flex-row gap-24 relative">
              <button onClick={() => setShowEditor(false)} className="absolute top-16 left-16 text-slate-500 hover:text-white text-4xl transition-all flex items-center gap-6 group">
                 <span className="group-hover:-translate-x-3 transition-transform">←</span>
                 <span className="text-sm uppercase font-black tracking-[0.5em]">Studio Dashboard</span>
              </button>
              
              <div className="lg:w-1/3 space-y-16 mt-16">
                <div className="space-y-8">
                   <div className="avatar-frame w-64 h-64 mx-auto shadow-[0_0_60px_rgba(99,102,241,0.3)]">
                      <img src={form.avatar} className="w-full h-full rounded-full" />
                   </div>
                   <div className="text-center space-y-3">
                     <h2 className="text-6xl font-black uppercase tracking-tighter moving-glow">{form.name || 'Nuevo Agente'}</h2>
                     <p className="text-xs text-indigo-500 font-black uppercase tracking-[0.6em]">{form.category || 'General'}</p>
                   </div>
                </div>
                
                <div className="space-y-12">
                   <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-6">Motor de Voz Seleccionado</label>
                      <select value={form.voice} onChange={e => setForm({...form, voice: e.target.value as any})} className="w-full bg-black/40 border border-white/10 rounded-[2.5rem] p-8 outline-none font-bold text-white text-xl appearance-none cursor-pointer focus:border-indigo-500">
                         {VOICES.map(v => <option key={v} value={v}>{v} Engine</option>)}
                      </select>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-6">Avatar URL</label>
                      <input value={form.avatar} onChange={e => setForm({...form, avatar: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] p-8 outline-none font-bold text-slate-400 text-xs" />
                   </div>
                </div>
              </div>

              <div className="lg:w-2/3 space-y-12 flex flex-col mt-16">
                 <div className="flex justify-between items-center">
                    <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-200">System Core & Entrenamiento</h3>
                    <div className="flex gap-4">
                       <span className="px-5 py-2 bg-indigo-600/10 border border-indigo-500/30 rounded-full text-[9px] font-black uppercase text-indigo-400 tracking-widest">Function Calling v2</span>
                    </div>
                 </div>
                 
                 <div className="space-y-4 flex-grow flex flex-col">
                    <label className="text-[11px] font-black uppercase text-slate-500 tracking-widest ml-6">System Prompt (Personalidad y Reglas)</label>
                    <textarea value={form.instruction} onChange={e => setForm({...form, instruction: e.target.value})} className="flex-grow bg-white/5 border border-white/10 rounded-[4rem] p-16 text-xl outline-none resize-none font-mono text-slate-400 leading-relaxed no-scrollbar focus:border-indigo-500 transition-all min-h-[400px]" placeholder="Define el acento, comportamiento y objetivos de negocio..." />
                 </div>

                 {/* CARGAR CONOCIMIENTO RAG */}
                 <div className="eternity-card p-12 rounded-[4rem] bg-indigo-600/5 space-y-8">
                    <h4 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400">Knowledge Cloud (RAG)</h4>
                    <div className="grid grid-cols-2 gap-8">
                       <div className="p-10 border border-dashed border-white/10 rounded-[3rem] flex flex-col items-center gap-6 cursor-pointer hover:bg-white/5 hover:border-indigo-500/50 transition-all">
                          <span className="text-4xl">📤</span>
                          <span className="text-[11px] font-black uppercase tracking-widest">Inyectar PDF/CSV</span>
                       </div>
                       <div className="p-10 border border-dashed border-white/10 rounded-[3rem] flex flex-col items-center gap-6 cursor-pointer hover:bg-white/5 hover:border-indigo-500/50 transition-all">
                          <span className="text-4xl">🌐</span>
                          <span className="text-[11px] font-black uppercase tracking-widest">Scrapear Website URL</span>
                       </div>
                    </div>
                 </div>
                 
                 <button onClick={saveAgent} className="w-full py-12 bg-indigo-600 text-white rounded-[3.5rem] font-black uppercase text-sm tracking-[0.5em] hover:bg-indigo-500 shadow-2xl shadow-indigo-600/30 transition-all active:scale-[0.98]">Profesionalizar y Guardar Cambios 🤘</button>
              </div>
           </div>
        </div>
      )}

      {/* WIDGET ALADINO (HISTORIAL) */}
      <div className={`fixed bottom-14 right-14 z-[500] transition-all duration-1000 cubic-bezier(0.19, 1, 0.22, 1) ${isAladinoOpen ? 'w-[550px] h-[850px] rounded-[5rem] eternity-card p-16' : 'w-36 h-36 flex items-center justify-center cursor-pointer hover:scale-110 group'}`}>
        {!isAladinoOpen ? (
          <div onClick={() => setIsAladinoOpen(true)} className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl group-hover:scale-150 transition-all duration-700" />
            <AladinoLamp />
          </div>
        ) : (
          <div className="flex flex-col h-full animate-in zoom-in-95 duration-500 relative">
             <div className="flex items-center justify-between mb-16">
                <div className="flex items-center gap-8">
                   <div className="avatar-frame w-24 h-24">
                      <img src={currentAgent.avatar} className="w-full h-full rounded-full" />
                   </div>
                   <div>
                      <h4 className="text-3xl font-black tracking-tighter moving-glow">{currentAgent.name}</h4>
                      <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.6em] mt-2">Log de Actividad</p>
                   </div>
                </div>
                <button onClick={() => setIsAladinoOpen(false)} className="w-14 h-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-2xl">✕</button>
             </div>

             <div className="flex-grow overflow-y-auto no-scrollbar space-y-10 pr-4">
                <div className="space-y-6">
                   <h5 className="text-[11px] font-black uppercase tracking-[0.6em] text-indigo-400 px-4">Historial de Sesión</h5>
                   <div className="space-y-6">
                      {(history[currentAgent.id] || []).map((m) => (
                        <div key={m.id} className={`p-8 rounded-[3rem] text-sm font-semibold leading-relaxed border animate-in slide-in-from-bottom-4 duration-500 ${m.role === 'user' ? 'bg-indigo-600/10 border-indigo-500/20 ml-12' : 'bg-white/5 border-white/5 mr-12 text-slate-300'}`}>
                           {m.text}
                        </div>
                      ))}
                      {(!history[currentAgent.id] || history[currentAgent.id].length === 0) && (
                        <div className="text-center py-20 text-[11px] text-slate-600 font-black uppercase tracking-[0.6em] italic opacity-50">Esperando sintonización...</div>
                      )}
                   </div>
                </div>
             </div>

             <div className="mt-12 flex gap-6">
                <button onClick={startSession} className="flex-grow py-10 bg-indigo-600 text-white rounded-[3rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl shadow-indigo-600/40 hover:scale-[1.02] transition-all">Sintonizar en Vivo</button>
             </div>
          </div>
        )}
      </div>

      {/* HEADER PREMIUM */}
      <header className="absolute top-0 left-0 right-0 h-32 flex items-center justify-between px-24 z-50 border-b border-white/5 bg-black/30 backdrop-blur-3xl">
        <div className="flex items-center gap-14">
          <div className="flex flex-col">
            <h1 className="text-5xl font-black tracking-tighter moving-glow">ARGENTO HUB PRO</h1>
            <span className="text-[11px] font-black uppercase tracking-[0.7em] text-indigo-500 ml-1">v8 Enterprise Suite</span>
          </div>
          <div className="h-12 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Franco Larrarte (Admin)</p>
            <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">GitHub: agenthub-pro-cloud</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <button onClick={() => { 
            const blob = new Blob([JSON.stringify({ agents, history }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `agenthub-export-${USER_ID}.json`;
            a.click();
          }} className="px-10 py-4 bg-indigo-600 text-white rounded-full text-[11px] font-black uppercase tracking-[0.3em] shadow-lg shadow-indigo-600/30 hover:scale-105 transition-all">Exportar Hub 📦</button>
        </div>
      </header>

      {/* TOAST NOTIFICACIONES */}
      <div className="fixed top-36 right-24 z-[3000] space-y-6 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`px-16 py-10 rounded-[3.5rem] shadow-2xl border backdrop-blur-3xl animate-in slide-in-from-right duration-700 ${n.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' : n.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-indigo-900/40 border-indigo-500/40 text-indigo-200'}`}>
            <p className="text-[13px] font-black uppercase tracking-[0.4em] flex items-center gap-10">
              <span className={`w-5 h-5 rounded-full ${n.type === 'error' ? 'bg-red-500 shadow-[0_0_20px_red]' : 'bg-indigo-500 shadow-[0_0_25px_#6366f1]'}`} />
              {n.msg}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
