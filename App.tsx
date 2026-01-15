import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { ConnectionStatus, Agent, ChatMessage, Scene, KnowledgeItem, ConnectorConfig, ExportConfig, VoiceSettings, DialogueSession, DialogueLine, AladinoMessage, AladinoAttachment, ElevenLabsVoice } from './types';
import { decode, decodeAudioData, createPcmBlob, pcmToWav } from './services/audioUtils';
import Visualizer from './components/Visualizer';

// --- COMPONENTE TYPEWRITER ---
const Typewriter = ({ text, speed = 100, delay = 0 }: { text: string, speed?: number, delay?: number }) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const startTyping = () => {
      let i = 0;
      const timer = setInterval(() => {
        if (i < text.length) {
          setDisplayText(prev => prev + text.charAt(i));
          i++;
        } else {
          clearInterval(timer);
        }
      }, speed);
      return timer;
    };

    if (delay > 0) {
      timeoutId = setTimeout(() => startTyping(), delay);
    } else {
      startTyping();
    }

    return () => {
      clearTimeout(timeoutId);
      setDisplayText('');
    };
  }, [text, speed, delay]);

  return <span className="border-r-4 border-indigo-500 animate-pulse pr-1">{displayText}</span>;
};

// --- PRESETS DE VOZ ARGENTINA (SIN 'CHE' EXCESIVO) ---
const ARGENTINE_PRESETS = [
    { id: 'rioplatense_corp', name: 'Rioplatense Corporativo', style: 'Profesional', pitch: 'Medio', desc: 'Serio, ideal para B2B. Acento marcado pero formal.' },
    { id: 'locutor_am', name: 'Locutor Radio AM', style: 'Serio', pitch: 'Grave', desc: 'Voz profunda, autoridad, pausas marcadas.' },
    { id: 'comercial_energi', name: 'Comercial Enérgico', style: 'Enérgico', pitch: 'Medio', desc: 'Vendedor de autos, rápido, sin dudas.' },
    { id: 'atencion_suave', name: 'Atención al Cliente (Suave)', style: 'Empático', pitch: 'Agudo', desc: 'Amable, arrastra las vocales ligeramente, muy paciente.' },
    { id: 'tech_moderno', name: 'Tech Moderno (Palermo)', style: 'Canchero', pitch: 'Medio', desc: 'Usa términos en inglés, tono relajado.' }
];

// --- LISTA MAESTRA DE AGENTES (PROMPTS REALES CARGADOS) ---
const DEFAULT_AGENTS: Agent[] = [
  // --- AGENTES BASADOS EN ARCHIVOS GITHUB ---
  { 
    id: 'tomy_megaprompt', 
    name: 'Tommy', 
    category: 'Ventas', 
    age: '25', 
    gender: 'Hombre', 
    occupation: 'Agente IA MotorsHub', 
    avatar: 'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=400&q=80', 
    voice: 'Fenrir', 
    isPro: true,
    description: 'Specialist in automotive sales (MotorsHub). Objectives: Qualify leads (BANT), handle objections, and schedule demos.', 
    instruction: `[SOURCE: MEGAPROMPT_TOMMY_IAMOTORSHUB.md]
    IDENTITY: You are Tommy, the Top Performer Sales AI for MotorsHub.
    OBJECTIVE: Qualify incoming leads based on BANT (Budget, Authority, Need, Time). Your goal is to schedule a Demo with Franco.
    TONE: Winning, direct, strategic pauses. Natural Rioplatense accent.
    BEHAVIOR: 
    1. Greeting: High energy, immediate hook.
    2. Qualification: Ask key questions but feel like a conversation, not an interrogation.
    3. Objection Handling: Pivot price objections to value.
    4. Closing: Assumptive close. "Te queda mejor el martes a las 10 o el jueves a las 15?".
    CONTEXT: Knowledge base 'conocimiento TOMMY.pdf' is active for vehicle specs and financing details.`, 
    voiceSettings: { speed: 1.1, pitch: 'Medio', style: 'Canchero', provider: 'gemini', accentLevel: 70, argentinaPreset: 'comercial_energi' },
    connectors: [{id: 'whatsapp', name: 'WhatsApp Business', enabled: true, icon: '📱'}],
    knowledge: [{id: 'k1', type: 'file', name: 'conocimiente TOMMY.pdf', content: '...', timestamp: Date.now()}]
  },
  { 
    id: 'agente_1_mkt', 
    name: 'Valentina (Agente 1)', 
    category: 'Marketing', 
    age: '30', 
    gender: 'Mujer', 
    occupation: 'Marketing Campaigns Lead', 
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400', 
    voice: 'Kore', 
    isPro: true,
    description: '360° Marketing Strategy. Objectives: Optimize ROI, design conversion funnels, and analyze campaign KPIs.', 
    instruction: `[SOURCE: AGENTE_1_MARKETING_CAMPAIGNS.md]
    ROLE: Marketing Campaigns Lead & Digital Strategist.
    TASK: Design full-funnel conversion strategies, analyze Campaign KPIs, and optimize ad spend.
    FOCUS: Data-driven decisions. Always ask for the CPA and ROAS targets before proposing a strategy.
    STYLE: Professional, analytical, sophisticated.`, 
    voiceSettings: { speed: 1.0, pitch: 'Agudo', style: 'Profesional', provider: 'gemini', accentLevel: 40, argentinaPreset: 'atencion_suave' },
    connectors: [], knowledge: []
  },
  { 
    id: 'agente_2_cold', 
    name: 'Martín (Agente 2)', 
    category: 'Ventas', 
    age: '28', 
    gender: 'Hombre', 
    occupation: 'Cold Calling Specialist', 
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400', 
    voice: 'Zephyr', 
    isPro: true,
    description: 'Cold Calling Expert. Objectives: Pattern interrupt, rapid rapport building, and lead generation in under 30 seconds.', 
    instruction: `[SOURCE: AGENTE_2_COLD_CALLING_LEADS.md]
    ROLE: SDR (Sales Development Representative) - Cold Calling Specialist.
    METHODOLOGY: AIDA (Attention, Interest, Desire, Action).
    TACTIC: Pattern Interrupt. Do not sound like a telemarketer. Be sharp, be quick.
    GOAL: Get the prospect to listen for 30 seconds.
    HANDLING REJECTION: "Entiendo que estés ocupado, justamente por eso te llamo..."`, 
    voiceSettings: { speed: 1.2, pitch: 'Medio', style: 'Entusiasta', provider: 'gemini', accentLevel: 60, argentinaPreset: 'comercial_energi' },
    connectors: [], knowledge: []
  },
  { 
    id: 'agente_3_planes', 
    name: 'Rodri (Agente 3)', 
    category: 'Ventas', 
    age: '35', 
    gender: 'Hombre', 
    occupation: 'Vendedor Planes Ahorro', 
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', 
    voice: 'Charon', 
    isPro: true,
    description: 'Savings Plan Specialist. Objectives: Transparently explain financing details, build trust, and close subscriptions.', 
    instruction: `[SOURCE: AGENTE_3_PLANES_AHORRO.md]
    ROLE: Savings Plan Advisor (Planes de Ahorro).
    KEY: Radical Transparency. Explain the "fine print" clearly to build trust.
    NARRATIVE: Focus on the dream of the 0KM car and the smart investment.
    TONE: Serious but approachable, trustworthy, like a financial advisor.`, 
    voiceSettings: { speed: 1.0, pitch: 'Grave', style: 'Serio', provider: 'gemini', accentLevel: 50, argentinaPreset: 'rioplatense_corp' },
    connectors: [], knowledge: []
  },
  { 
    id: 'agente_4_sofia', 
    name: 'Sofía Martínez (Agente 4)', 
    category: 'Hospitality', 
    age: '26', 
    gender: 'Mujer', 
    occupation: 'Recepción Hotelera', 
    avatar: 'https://images.unsplash.com/photo-1598550832205-d77e550498c6?w=400', 
    voice: 'Kore', 
    isPro: true,
    description: 'Luxury Hotel Receptionist. Objectives: Manage check-ins/outs, handle complaints with empathy, and ensure guest satisfaction.', 
    instruction: `[SOURCE: AGENTE_4_SOFIA_MARTINEZ_HOTEL.pdf]
    ROLE: Luxury Hotel Receptionist.
    OBJECTIVE: Manage Check-in/out, resolve guest inquiries, and handle complaints with extreme empathy.
    TONE: Warm, welcoming, efficient, high-end hospitality standard.
    SCENARIOS: Lost reservation, room upgrade request, local recommendations.`, 
    voiceSettings: { speed: 0.9, pitch: 'Agudo', style: 'Amigable', provider: 'gemini', accentLevel: 30, argentinaPreset: 'atencion_suave' },
    connectors: [], knowledge: []
  },
  { 
    id: 'agente_5_content', 
    name: 'Luca (Agente 5)', 
    category: 'Marketing', 
    age: '24', 
    gender: 'Hombre', 
    occupation: 'Content Creator Brutal', 
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400', 
    voice: 'Puck', 
    isPro: true,
    description: 'Viral Content Strategist. Objectives: Maximize retention metrics, create visual hooks, and produce disruptive Reels scripts.', 
    instruction: `[SOURCE: AGENTE_5_CONTENT_CREATOR.pdf]
    ROLE: Disruptive Content Creator.
    STYLE: Brutal honesty, fast-paced, Gen-Z slang (nashe, god, bro).
    FOCUS: Retention metrics and visual hooks. "If you bore them, you lose them."
    OBJECTIVE: Create viral scripts for TikTok and Reels.`, 
    voiceSettings: { speed: 1.3, pitch: 'Medio', style: 'Agresivo', provider: 'gemini', accentLevel: 80, argentinaPreset: 'tech_moderno' },
    connectors: [], knowledge: []
  },
  { 
    id: 'agente_6_concierge', 
    name: 'Carmen (Agente 6)', 
    category: 'Hospitality', 
    age: '32', 
    gender: 'Mujer', 
    occupation: 'Concierge VIP', 
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400', 
    voice: 'Kore', 
    isPro: true,
    description: 'VIP Concierge. Objectives: Secure exclusive reservations, manage logistics, and curate unique local experiences.', 
    instruction: `[SOURCE: AGENTE_6_CONCIERGE_HOTELERO.pdf]
    ROLE: VIP Concierge.
    TASK: Organize logistics, secure Michelin-star reservations, and curate unique local experiences.
    ATTITUDE: "Impossible is not in my vocabulary." Elegant, resourceful.`, 
    voiceSettings: { speed: 1.0, pitch: 'Medio', style: 'Profesional', provider: 'gemini', accentLevel: 20, argentinaPreset: 'atencion_suave' },
    connectors: [], knowledge: []
  },
  {
    id: 'agente_10_contratos',
    name: 'Dr. Rossi (Agente 10)',
    category: 'Legal',
    age: '50',
    gender: 'Hombre',
    occupation: 'Especialista Contratos',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
    voice: 'Charon',
    description: 'Corporate Lawyer. Objectives: Review contracts, identify abusive clauses, and mitigate legal risks.', 
    instruction: `[SOURCE: AGENTE_10_ESPECIALISTA_CONTRATOS.pdf]
    ROLE: Senior Corporate Lawyer.
    FOCUS: Contract review, identifying abusive clauses, legal risk mitigation.
    TONE: Formal, precise, authoritative. Uses correct legal terminology.`,
    voiceSettings: { speed: 0.9, pitch: 'Grave', style: 'Serio', provider: 'gemini', accentLevel: 10, argentinaPreset: 'rioplatense_corp' }, connectors: [], knowledge: []
  },
  {
    id: 'agente_11_abogado',
    name: 'Nacho (Agente 11)',
    category: 'Legal',
    age: '40',
    gender: 'Hombre',
    occupation: 'Abogado Generalista',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    voice: 'Fenrir',
    description: 'General Litigator. Objectives: Resolve civil and commercial conflicts efficiently. Pragmatic approach.', 
    instruction: `[SOURCE: AGENTE_11_ABOGADO_GENERALISTA.pdf]
    ROLE: General Litigator.
    STYLE: Pragmatic, focused on conflict resolution. "Better a bad settlement than a good lawsuit."
    ACCENT: Strong Porteño.
    AREAS: Civil, Commercial, Labor law basics.`,
    voiceSettings: { speed: 1.1, pitch: 'Grave', style: 'Seguro', provider: 'gemini', accentLevel: 50, argentinaPreset: 'rioplatense_corp' }, connectors: [], knowledge: []
  },
  {
    id: 'agente_12_recep_med',
    name: 'Elena (Agente 12)',
    category: 'Salud',
    age: '45',
    gender: 'Mujer',
    occupation: 'Recepcionista Médica',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    voice: 'Kore',
    description: 'Medical Secretary. Objectives: Schedule appointments, validate insurance coverage, and manage patient intake.', 
    instruction: `[SOURCE: AGENTE_12_RECEPCIONISTA_MEDICA.pdf]
    ROLE: Medical Clinic Secretary.
    TASK: Schedule appointments, validate insurance (Obras Sociales), manage anxious patients.
    TONE: Patient, motherly but efficient.
    PRIORITY: Urgency triage and calendar organization.`,
    voiceSettings: { speed: 1.0, pitch: 'Medio', style: 'Empático', provider: 'gemini', accentLevel: 40, argentinaPreset: 'atencion_suave' }, connectors: [], knowledge: []
  },
  {
    id: 'agente_13_imagenes',
    name: 'Téc. Laura (Agente 13)',
    category: 'Salud',
    age: '29',
    gender: 'Mujer',
    occupation: 'Estudios de Imágenes',
    avatar: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400',
    voice: 'Kore',
    description: 'Radiology Technician. Objectives: Explain imaging procedures, prepare patients, and ensure safety protocols.', 
    instruction: `[SOURCE: AGENTE_13_ESTUDIOS_IMAGENES.pdf]
    ROLE: Radiology Technician.
    TASK: Explain procedures, prep patients (fasting, contrast), calm claustrophobia in MRI.
    TONE: Professional, reassuring, technical but accessible.`,
    voiceSettings: { speed: 1.0, pitch: 'Medio', style: 'Profesional', provider: 'gemini', accentLevel: 20 }, connectors: [], knowledge: []
  },
  {
    id: 'agente_14_dental',
    name: 'Asist. Carla (Agente 14)',
    category: 'Salud',
    age: '27',
    gender: 'Mujer',
    occupation: 'Asistente Dental',
    avatar: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=400',
    voice: 'Kore',
    description: 'Dental Assistant. Objectives: Manage dental appointments, provide post-op instructions, and hygiene education.', 
    instruction: `[SOURCE: AGENTE_14_ASISTENTE_DENTAL.pdf]
    ROLE: Dental Assistant.
    TASK: Confirm appointments, post-op care instructions, hygiene tips.
    TONE: Cheerful and reassuring.
    FOCUS: Patient comfort and clear after-care guidance.`,
    voiceSettings: { speed: 1.1, pitch: 'Agudo', style: 'Alegre', provider: 'gemini', accentLevel: 30 }, connectors: [], knowledge: []
  },
  {
    id: 'agente_15_medico',
    name: 'Dr. Méndez (Agente 15)',
    category: 'Salud',
    age: '55',
    gender: 'Hombre',
    occupation: 'Asistente Médico Clínico',
    avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400',
    voice: 'Charon',
    description: 'Clinical Assistant. Objectives: Perform preliminary anamnesis, gather symptoms, and route to specialists.', 
    instruction: `[SOURCE: AGENTE_15_ASISTENTE_MEDICO_CLINICO.pdf]
    ROLE: Medical Pre-consultation AI.
    TASK: Gather symptoms, history, and route to correct specialist.
    TONE: Calm, grave voice, professional.
    DISCLAIMER: Always state "I am an AI assistant, not a doctor. This is a preliminary screening."`,
    voiceSettings: { speed: 0.9, pitch: 'Grave', style: 'Calmado', provider: 'gemini', accentLevel: 10, argentinaPreset: 'locutor_am' }, connectors: [], knowledge: []
  },
  {
    id: 'agente_9_b2b',
    name: 'Marcos B2B (Agente 9)',
    category: 'Ventas',
    age: '33',
    gender: 'Hombre',
    occupation: 'Asesor B2B Corporativo',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    voice: 'Fenrir',
    description: 'B2B Key Account Manager. Objectives: Negotiate high-ticket contracts, manage C-level relationships, and close deals.', 
    instruction: `[SOURCE: AGENTE_9_ASESOR_B2B.pdf]
    ROLE: Key Account Manager (B2B).
    TASK: C-Level negotiation, complex commercial proposals.
    TONE: Highly professional, confident, knowledgeable.
    STRATEGY: Consultative selling, focus on ROI and long-term partnership value.`,
    voiceSettings: { speed: 1.0, pitch: 'Grave', style: 'Profesional', provider: 'gemini', accentLevel: 40, argentinaPreset: 'rioplatense_corp' }, connectors: [], knowledge: []
  },
  {
    id: 'agente_7_host',
    name: 'Mariana (Agente 7)',
    category: 'Gastronomía',
    age: '28',
    gender: 'Mujer',
    occupation: 'Host de Restaurant',
    avatar: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400',
    voice: 'Kore',
    description: 'Restaurant Host. Objectives: Optimize seating arrangements, manage waitlists, and welcome VIP guests.', 
    instruction: `[SOURCE: AGENTE_7_HOST_RESTAURANT.pdf]
    ROLE: Restaurant Hostess.
    TASK: Manage waiting list, VIP reservations, and seating arrangements.
    TONE: Welcoming, organized.
    GOAL: Maximize table turnover while maintaining high guest satisfaction.`,
    voiceSettings: { speed: 1.1, pitch: 'Medio', style: 'Amigable', provider: 'gemini', accentLevel: 50 }, connectors: [], knowledge: []
  },
  {
    id: 'agente_8_bartender',
    name: 'Fede (Agente 8)',
    category: 'Gastronomía',
    age: '26',
    gender: 'Hombre',
    occupation: 'Bartender & Eventos',
    avatar: 'https://images.unsplash.com/photo-1583468982228-19f19164aee2?w=400',
    voice: 'Fenrir',
    description: 'Head Bartender. Objectives: Design cocktail menus, manage event stock, and recommend pairings.', 
    instruction: `[SOURCE: AGENTE_8_BARTENDER_EVENTOS.pdf]
    ROLE: Head Bartender.
    TASK: Cocktail menu design, stock calculation, pairing recommendations.
    TONE: Cool, knowledgeable, "palermo vibe".
    EXPERTISE: Mixology, inventory management, event logistics.`,
    voiceSettings: { speed: 1.1, pitch: 'Medio', style: 'Canchero', provider: 'gemini', accentLevel: 80, argentinaPreset: 'tech_moderno' }, connectors: [], knowledge: []
  }
];

const AVAILABLE_CONNECTORS: ConnectorConfig[] = [
  { id: 'google_search', name: 'Google Search Grounding', enabled: false, icon: '🔍' },
  { id: 'google_maps', name: 'Google Maps Grounding', enabled: false, icon: '🗺️' },
  { id: 'whatsapp', name: 'WhatsApp Business API', enabled: false, icon: '📱' },
];

const AVAILABLE_EXPORTS: ExportConfig[] = [
  { platform: 'web', enabled: false, integrationId: '' },
  { platform: 'whatsapp', enabled: false, integrationId: '' },
  { platform: 'instagram', enabled: false, integrationId: '' },
  { platform: 'telegram', enabled: false, integrationId: '' }
];

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'home' | 'templates' | 'test_lab' | 'studio' | 'aladino' | 'dialogues'>('home');
  const [studioTab, setStudioTab] = useState<'identity' | 'knowledge' | 'voice' | 'tools' | 'export'>('identity');
  
  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem('hub_agents_v14_master');
    return saved ? JSON.parse(saved) : DEFAULT_AGENTS;
  });
  const [currentAgent, setCurrentAgent] = useState<Agent>(agents[0]);
  
  // Template Editor State
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [magicPromptInput, setMagicPromptInput] = useState('');
  const [expandedExport, setExpandedExport] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<{id: number, msg: string, type: string}[]>([]);
  
  // ElevenLabs Browser State
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [playingVoicePreview, setPlayingVoicePreview] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Test Lab State
  const [testInput, setTestInput] = useState('');
  const [isTestThinking, setIsTestThinking] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  // Aladino State
  const [aladinoMessages, setAladinoMessages] = useState<AladinoMessage[]>([]);
  const [aladinoInput, setAladinoInput] = useState('');
  const [aladinoAttachments, setAladinoAttachments] = useState<AladinoAttachment[]>([]);
  const [isAladinoListening, setIsAladinoListening] = useState(false);
  const [isAladinoProcessing, setIsAladinoProcessing] = useState(false);
  
  // Dialogue State
  const [dialogueAgentA, setDialogueAgentA] = useState<string>('');
  const [dialogueAgentB, setDialogueAgentB] = useState<string>('');
  const [dialogueTopic, setDialogueTopic] = useState('');
  const [generatedScript, setGeneratedScript] = useState<DialogueLine[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('hub_agents_v14_master', JSON.stringify(agents));
  }, [agents]);

  const addNotification = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now();
    setNotifications(p => [...p, { id, msg, type }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 3000);
  };

  const createNewTemplate = () => {
    const newAgent: Agent = {
      id: `custom_${Date.now()}`,
      name: 'Nuevo Agente',
      category: 'Personalizado',
      age: '30',
      gender: 'Hombre',
      occupation: 'Asistente',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
      voice: 'Kore',
      voiceSettings: { speed: 1.0, pitch: 'Medio', style: 'Profesional', provider: 'gemini', accentLevel: 50 },
      instruction: `SYSTEM_INSTRUCTION_ACTIVE:
      IDENTITY: New Agent
      OBJECTIVE: Define objective.`,
      description: 'Agente personalizado.',
      connectors: [],
      knowledge: [],
      exports: []
    };
    setEditingAgent(newAgent);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result && editingAgent) {
           setEditingAgent({ ...editingAgent, avatar: ev.target.result as string });
           addNotification("Avatar actualizado", "success");
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const generateAvatar = async () => {
      if(!editingAgent) return;
      addNotification("Generando Avatar con Imagen 3 Pro...", "info");
      setTimeout(() => {
          const randomAvatars = [
              'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
              'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400'
          ];
          setEditingAgent({ ...editingAgent, avatar: randomAvatars[Math.floor(Math.random() * randomAvatars.length)] });
          addNotification("Avatar generado", "success");
      }, 2000);
  };

  const saveTemplate = () => {
    if (!editingAgent) return;
    const exists = agents.find(a => a.id === editingAgent.id);
    let newAgents;
    if (exists) {
      newAgents = agents.map(a => a.id === editingAgent.id ? editingAgent : a);
    } else {
      newAgents = [...agents, editingAgent];
    }
    setAgents(newAgents);
    setCurrentAgent(editingAgent);
    setEditingAgent(null);
    localStorage.setItem('hub_agents_v14_master', JSON.stringify(newAgents));
    setActiveView('home');
    addNotification("Agente guardado en Base de Datos", "success");
  };

  const generateAudioForText = async (text: string, agent: Agent) => {
     try {
          // Check for ElevenLabs
          if (agent.voiceSettings.provider === 'elevenlabs' && agent.voiceSettings.elevenLabsVoiceId && agent.voiceSettings.elevenLabsApiKey) {
               addNotification(`Generando con ElevenLabs (${agent.name})...`, "info");
               // Mock fetch to ElevenLabs
               await new Promise(r => setTimeout(r, 1000)); 
               // In a real app, you would fetch https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
               // Since we can't do that securely client-side without proxy, we simulate or fallback.
               addNotification("ElevenLabs API Call Simulated (Requires Backend)", "success");
               return null; 
          }

          // Gemini Logic
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let prompt = `Decí: "${text}".`;
          const preset = ARGENTINE_PRESETS.find(p => p.id === agent.voiceSettings.argentinaPreset);
          if (preset) {
             prompt = `Habla como un argentino (${preset.name}). Tono: ${preset.style}. Texto: "${text}". NO uses 'che' en exceso, sé natural.`;
          } else if (agent.voiceSettings.accentLevel > 20) {
              prompt = `Con acento argentino rioplatense marcado (${agent.voiceSettings.accentLevel}% intensidad) decí: "${text}".`;
          }

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: agent.voice } } }
            },
          });

          const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            const pcmBytes = decode(audioData);
            const wavBlob = pcmToWav(pcmBytes, 24000);
            return URL.createObjectURL(wavBlob);
          }
          return null;
      } catch (e) {
          console.error(e);
          return null;
      }
  };

  const testAgentVoice = async () => {
      if(!testInput.trim()) return;
      setIsTestThinking(true);
      const targetAgent = editingAgent || currentAgent;
      
      const audioUrl = await generateAudioForText(testInput, targetAgent);
      
      if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.play();
      } else {
          addNotification("Error generando audio", "error");
      }
      setIsTestThinking(false);
  };

  const handleMagicWand = async () => {
    if (!editingAgent || !magicPromptInput.trim()) return;
    addNotification("Generando identidad...", "info");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Genera un System Instruction profesional para un agente AI. Descripción: ${magicPromptInput}. Incluye: Identidad, Tono (Argentino si aplica), Objetivos. Solo texto plano.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setEditingAgent({ ...editingAgent, instruction: response.text || '' });
      addNotification("Prompt generado", "success");
    } catch (e) {
        addNotification("Error API", "error");
    }
  };

  // ElevenLabs Logic
  const fetchElevenLabsVoices = async (apiKey: string) => {
      if(!apiKey) {
          addNotification("Por favor, ingresa tu API Key primero.", "error");
          return;
      }
      setIsLoadingVoices(true);
      try {
          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
              headers: { 'xi-api-key': apiKey }
          });
          if(!response.ok) throw new Error("Failed to fetch");
          const data = await response.json();
          if(data.voices) {
              setElevenLabsVoices(data.voices);
              addNotification(`${data.voices.length} voces cargadas`, "success");
          }
      } catch(e) {
          addNotification("Error al conectar con ElevenLabs. Verifica tu Key.", "error");
      }
      setIsLoadingVoices(false);
  };

  const handlePlayPreview = (previewUrl: string | undefined, voiceId: string) => {
      if(!previewUrl) return;
      if(playingVoicePreview === voiceId && previewAudioRef.current) {
          previewAudioRef.current.pause();
          setPlayingVoicePreview(null);
          return;
      }

      if(previewAudioRef.current) {
          previewAudioRef.current.pause();
      }
      const audio = new Audio(previewUrl);
      previewAudioRef.current = audio;
      setPlayingVoicePreview(voiceId);
      audio.play();
      audio.onended = () => setPlayingVoicePreview(null);
  };

  const generateScript = async () => {
      if(!dialogueAgentA || !dialogueAgentB || !dialogueTopic) return;
      setIsGeneratingScript(true);
      const agentA = agents.find(a => a.id === dialogueAgentA);
      const agentB = agents.find(a => a.id === dialogueAgentB);
      
      setTimeout(() => {
          setGeneratedScript([
              { id: '1', agentId: agentA!.id, agentName: agentA?.name || 'A', text: `Hola ${agentB?.name}, quería consultarte sobre ${dialogueTopic}.`, emotion: 'Curioso' },
              { id: '2', agentId: agentB!.id, agentName: agentB?.name || 'B', text: `¡Claro! Mirá, lo que tenés que saber es que...`, emotion: 'Seguro' },
              { id: '3', agentId: agentA!.id, agentName: agentA?.name || 'A', text: `¿Y cómo impacta eso en el ROI?`, emotion: 'Dudoso' },
              { id: '4', agentId: agentB!.id, agentName: agentB?.name || 'B', text: `Directamente. Te explico la estrategia...`, emotion: 'Entusiasta' },
          ]);
          setIsGeneratingScript(false);
          addNotification("Guión generado con éxito", "success");
      }, 2000);
  };
  
  const generateLineAudio = async (line: DialogueLine) => {
      const agent = agents.find(a => a.id === line.agentId);
      if (!agent) return;
      
      // Update line status
      setGeneratedScript(prev => prev.map(l => l.id === line.id ? { ...l, isGenerating: true } : l));
      
      const url = await generateAudioForText(line.text, agent);
      
      if (url) {
           setGeneratedScript(prev => prev.map(l => l.id === line.id ? { ...l, audioUrl: url, isGenerating: false } : l));
           const audio = new Audio(url);
           audio.play();
      } else {
           setGeneratedScript(prev => prev.map(l => l.id === line.id ? { ...l, isGenerating: false } : l));
           addNotification("Error audio", "error");
      }
  };

  const downloadAudio = (url: string, filename: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  // Aladino Handlers
  const handleAladinoSubmit = async () => {
      if ((!aladinoInput.trim() && aladinoAttachments.length === 0) || isAladinoProcessing) return;

      const newUserMsg: AladinoMessage = {
          id: Date.now().toString(),
          role: 'user',
          text: aladinoInput,
          attachments: [...aladinoAttachments],
          timestamp: Date.now()
      };

      setAladinoMessages(prev => [...prev, newUserMsg]);
      setAladinoInput('');
      setAladinoAttachments([]);
      setIsAladinoProcessing(true);

      // Simulate Thinking / API Call
      setTimeout(() => {
          const newModelMsg: AladinoMessage = {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: `He analizado tu solicitud. ${newUserMsg.attachments?.length ? `He procesado ${newUserMsg.attachments.length} archivo(s).` : ''} Aquí tienes mi análisis Omni-Modal basado en el contexto proporcionado.`,
              timestamp: Date.now()
          };
          setAladinoMessages(prev => [...prev, newModelMsg]);
          setIsAladinoProcessing(false);
      }, 2000);
  };

  const handleAladinoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          Array.from(e.target.files).forEach(file => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  const result = ev.target?.result as string;
                  const type = file.type.includes('image') ? 'image' : file.type.includes('pdf') ? 'pdf' : file.type.includes('csv') ? 'csv' : 'other';
                  setAladinoAttachments(prev => [...prev, {
                      id: Date.now() + Math.random().toString(),
                      name: file.name,
                      type,
                      dataUrl: result
                  }]);
              };
              reader.readAsDataURL(file);
          });
      }
  };

  return (
    <div className="min-h-screen text-slate-200 relative overflow-hidden font-sans selection:bg-indigo-500/30">
        
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none stagger-enter stagger-delay-1">
            <div className="pointer-events-auto flex items-center gap-4">
                <h1 className="text-2xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-400">
                    ARGENTO<span className="text-indigo-500">HUB</span> PRO
                </h1>
                <span className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/30 text-[10px] uppercase font-bold tracking-widest text-indigo-300">V14.5</span>
            </div>
            
            <div className="pointer-events-auto gaussian-glass rounded-full p-1 flex gap-1">
                {['home', 'templates', 'dialogues', 'test_lab', 'studio', 'aladino'].map((view) => (
                    <button 
                        key={view}
                        onClick={() => setActiveView(view as any)}
                        className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 ${activeView === view ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]' : 'hover:bg-white/5 text-slate-400'}`}
                    >
                        {view === 'test_lab' ? 'Voice Lab' : view === 'aladino' ? 'Aladino IA' : view === 'dialogues' ? 'Doblaje' : view}
                    </button>
                ))}
            </div>
            
            <div className="pointer-events-auto flex gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/20 animate-pulse"></div>
            </div>
        </nav>

        {/* Notifications */}
        <div className="fixed top-24 right-6 z-50 flex flex-col gap-2 pointer-events-none">
            {notifications.map(n => (
                <div key={n.id} className={`pointer-events-auto px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-right-10 flex items-center gap-3 ${n.type === 'error' ? 'bg-red-900/40 border-red-500/30 text-red-200' : 'bg-slate-900/60 border-indigo-500/30 text-indigo-100'}`}>
                    <span className="text-lg">{n.type === 'success' ? '✅' : n.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                    <span className="text-sm font-medium">{n.msg}</span>
                </div>
            ))}
        </div>

        <main className="pt-24 px-6 h-screen flex flex-col items-center justify-center relative z-10">
            
            {/* --- HOME VIEW (HERO PARALLAX) --- */}
            {activeView === 'home' && (
                <div className="w-full max-w-7xl h-[85vh] flex flex-col items-center justify-center relative stagger-enter">
                    {/* Background Blur & Video */}
                    <div className="absolute inset-0 z-0 rounded-[3rem] overflow-hidden border border-white/5 animate-blur-in">
                         <video autoPlay muted loop className="w-full h-full object-cover opacity-60 scale-110">
                            <source src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-technological-interface-9488-large.mp4" type="video/mp4" />
                        </video>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80"></div>
                        <div className="absolute inset-0 backdrop-blur-[4px]"></div>
                    </div>
                    
                    <div className="relative z-10 text-center flex flex-col items-center max-w-5xl px-6">
                        <div className="mb-4 px-4 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/50 backdrop-blur-sm stagger-delay-1 animate-float-subtle">
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Inteligencia Artificial Generativa V14</span>
                        </div>
                        
                        <h1 className="text-8xl font-black italic tracking-tighter mb-6 leading-tight stagger-delay-2 drop-shadow-2xl animate-tunnel">
                            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">ARGENTO</span><br/>
                            <span className="text-indigo-500 text-7xl"><Typewriter text="HUB PRO CREATOR" speed={150} delay={500} /></span>
                        </h1>
                        
                        <p className="text-xl text-slate-300 max-w-2xl mb-12 leading-relaxed font-light stagger-delay-3">
                            Plataforma de orquestación de Agentes Inteligentes con <span className="text-white font-bold">Acento Nativo</span>, grounding en tiempo real y capacidades cognitivas avanzadas.
                        </p>
                        
                        <div className="flex gap-6 stagger-delay-4">
                             <button 
                                onClick={() => { createNewTemplate(); setActiveView('studio'); }}
                                className="px-10 py-5 rounded-2xl font-black uppercase tracking-widest btn-luxury animate-float-subtle"
                            >
                                + CREAR AGENTE
                            </button>
                            
                            <button 
                                onClick={() => setActiveView('templates')} 
                                className="px-10 py-5 rounded-2xl font-bold uppercase tracking-widest btn-glass-luxury animate-float-subtle"
                            >
                                EXPLORAR PLANTILLAS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ALADINO VIEW (OMNI-MODEL CHAT) --- */}
            {activeView === 'aladino' && (
                <div className="w-full max-w-5xl h-[85vh] flex flex-col stagger-enter">
                    <div className="flex items-end justify-between mb-6">
                        <div>
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                                <span className="text-indigo-500">ALADINO</span> OMNI-MODEL
                            </h2>
                            <p className="text-sm text-slate-400 font-light mt-1 tracking-wide">
                                Tu Genio de Ingeniería Prompt & Análisis Multimodal.
                            </p>
                        </div>
                        <div className="flex gap-2">
                             <span className="px-2 py-1 rounded border border-white/10 text-[10px] bg-black/40 uppercase">Gemini 3 Pro</span>
                             <span className="px-2 py-1 rounded border border-white/10 text-[10px] bg-black/40 uppercase">Thinking Mode</span>
                        </div>
                    </div>

                    <div className="flex-1 flex gap-6 overflow-hidden">
                        {/* LEFT: Capabilities & Info */}
                        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto no-scrollbar">
                             <div className="gaussian-glass p-6 rounded-3xl border border-white/5">
                                 <h3 className="text-xs font-bold uppercase text-indigo-400 mb-4 tracking-widest">Capacidades Omni-Modal</h3>
                                 <div className="grid grid-cols-1 gap-3">
                                     <div className="p-3 bg-white/5 rounded-xl flex items-center gap-3 border border-white/5">
                                         <span className="text-xl">📊</span>
                                         <div>
                                             <div className="text-xs font-bold">Análisis de Datos</div>
                                             <div className="text-[10px] text-slate-500">CSV, Excel, JSON</div>
                                         </div>
                                     </div>
                                     <div className="p-3 bg-white/5 rounded-xl flex items-center gap-3 border border-white/5">
                                         <span className="text-xl">👁️</span>
                                         <div>
                                             <div className="text-xs font-bold">Visión Computarizada</div>
                                             <div className="text-[10px] text-slate-500">PNG, JPG, Diagrams</div>
                                         </div>
                                     </div>
                                     <div className="p-3 bg-white/5 rounded-xl flex items-center gap-3 border border-white/5">
                                         <span className="text-xl">📄</span>
                                         <div>
                                             <div className="text-xs font-bold">Lectura Profunda</div>
                                             <div className="text-[10px] text-slate-500">PDF, Docs, Markdown</div>
                                         </div>
                                     </div>
                                     <div className="p-3 bg-white/5 rounded-xl flex items-center gap-3 border border-white/5">
                                         <span className="text-xl">🎙️</span>
                                         <div>
                                             <div className="text-xs font-bold">Voz Natural</div>
                                             <div className="text-[10px] text-slate-500">Audio Input/Output</div>
                                         </div>
                                     </div>
                                 </div>
                             </div>

                             <div className="gaussian-glass p-6 rounded-3xl border border-white/5 flex-1">
                                 <h3 className="text-xs font-bold uppercase text-pink-400 mb-4 tracking-widest">Sugerencias</h3>
                                 <div className="flex flex-wrap gap-2">
                                     {['Analizar este CSV de ventas', 'Resumir este contrato PDF', 'Describir esta imagen técnica', 'Generar código Python', 'Crear guión viral'].map(s => (
                                         <button key={s} onClick={() => setAladinoInput(s)} className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-[10px] hover:border-indigo-500 hover:text-indigo-300 transition-colors text-left">
                                             {s}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        </div>

                        {/* RIGHT: Chat & Input Area */}
                        <div className="w-2/3 flex flex-col gap-4">
                            {/* Chat Window */}
                            <div className="flex-1 gaussian-glass rounded-[2.5rem] p-8 overflow-y-auto relative no-scrollbar flex flex-col gap-6">
                                {aladinoMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-t from-indigo-500/20 to-transparent flex items-center justify-center mb-4">
                                            <span className="text-4xl">🧞‍♂️</span>
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Esperando tus deseos...</p>
                                    </div>
                                ) : (
                                    aladinoMessages.map(msg => (
                                        <div key={msg.id} className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-slate-200 rounded-bl-none border border-white/5'}`}>
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                                        {msg.attachments.map(att => (
                                                            <div key={att.id} className="w-16 h-16 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 relative group">
                                                                {att.type === 'image' ? (
                                                                    <img src={att.dataUrl} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-xs font-bold uppercase text-slate-500">{att.type}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {msg.text}
                                            </div>
                                            <span className="text-[10px] text-slate-600 uppercase font-bold">{msg.role === 'user' ? 'Tú' : 'Aladino'}</span>
                                        </div>
                                    ))
                                )}
                                {isAladinoProcessing && (
                                    <div className="self-start flex items-center gap-2 text-xs text-indigo-400 font-bold uppercase animate-pulse">
                                        <span>✨ Pensando...</span>
                                    </div>
                                )}
                            </div>

                            {/* Input Area (The Lamp) */}
                            <div className="gaussian-glass p-4 rounded-3xl border border-white/10 flex flex-col gap-4 relative">
                                {/* Attachments Preview */}
                                {aladinoAttachments.length > 0 && (
                                    <div className="flex gap-2 px-2">
                                        {aladinoAttachments.map(att => (
                                            <div key={att.id} className="relative group">
                                                <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden">
                                                    {att.type === 'image' ? <img src={att.dataUrl} className="w-full h-full object-cover" /> : <span className="text-[8px] uppercase">{att.type}</span>}
                                                </div>
                                                <button 
                                                    onClick={() => setAladinoAttachments(prev => prev.filter(p => p.id !== att.id))}
                                                    className="absolute -top-2 -right-2 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-end gap-3">
                                    {/* File Trigger */}
                                    <label className="p-3 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-white/5">
                                        <input type="file" multiple accept=".pdf,.csv,.xlsx,.docx,.txt,.md,.png,.jpg,.jpeg" className="hidden" onChange={handleAladinoFileSelect} />
                                        <span className="text-xl">📎</span>
                                    </label>

                                    {/* Text Input */}
                                    <textarea 
                                        value={aladinoInput}
                                        onChange={e => setAladinoInput(e.target.value)}
                                        onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAladinoSubmit(); }}}
                                        placeholder="Escribe tu prompt o describe el archivo adjunto..."
                                        className="flex-1 bg-transparent border-none outline-none text-sm resize-none max-h-32 py-3 placeholder:text-slate-600"
                                        rows={1}
                                    />

                                    {/* Voice Trigger */}
                                    <button 
                                        onClick={() => setIsAladinoListening(!isAladinoListening)}
                                        className={`p-3 rounded-full transition-all border border-white/5 ${isAladinoListening ? 'bg-red-500/20 text-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-white/5 hover:bg-white/10 text-slate-400'}`}
                                    >
                                        <span className="text-xl">🎙️</span>
                                    </button>

                                    {/* Send Button */}
                                    <button 
                                        onClick={handleAladinoSubmit}
                                        disabled={!aladinoInput.trim() && aladinoAttachments.length === 0}
                                        className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white shadow-lg shadow-indigo-500/30"
                                    >
                                        <span className="text-xl">🚀</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DIALOGUES / DOBLAJE VIEW (UPDATED) --- */}
            {activeView === 'dialogues' && (
                <div className="w-full max-w-6xl h-[85vh] flex flex-col stagger-enter">
                    <h2 className="text-4xl font-black italic uppercase mb-6 flex items-center gap-4">
                        <span className="text-indigo-500">Estudio de</span> Doblaje & Diálogo
                    </h2>
                    
                    <div className="flex gap-8 h-full">
                        <div className="w-1/3 space-y-4">
                            <div className="gaussian-glass p-6 rounded-3xl border border-white/5">
                                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4">Configuración de Escena</h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-indigo-400">Agente A</label>
                                        <select value={dialogueAgentA} onChange={e => setDialogueAgentA(e.target.value)} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none">
                                            <option value="">Seleccionar Agente...</option>
                                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-pink-400">Agente B</label>
                                        <select value={dialogueAgentB} onChange={e => setDialogueAgentB(e.target.value)} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none">
                                            <option value="">Seleccionar Agente...</option>
                                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500">Tópico / Situación</label>
                                        <textarea 
                                            value={dialogueTopic}
                                            onChange={e => setDialogueTopic(e.target.value)}
                                            placeholder="Ej: A le vende un plan de ahorro a B, pero B tiene dudas sobre la entrega..."
                                            className="w-full mt-1 h-32 bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none resize-none"
                                        />
                                    </div>
                                    <button onClick={generateScript} disabled={isGeneratingScript} className="w-full py-4 rounded-xl font-bold uppercase btn-luxury">
                                        {isGeneratingScript ? 'Generando Guión...' : 'Generar Diálogo'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="w-2/3 gaussian-glass rounded-3xl p-8 border border-white/5 overflow-y-auto relative">
                             {generatedScript.length === 0 ? (
                                 <div className="absolute inset-0 flex items-center justify-center text-slate-600 uppercase font-bold tracking-widest">
                                     Esperando Guión...
                                 </div>
                             ) : (
                                 <div className="space-y-6">
                                     {generatedScript.map((line, idx) => (
                                         <div key={idx} className={`flex gap-4 group ${line.agentId === dialogueAgentA ? 'flex-row' : 'flex-row-reverse'}`}>
                                             <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold ${line.agentId === dialogueAgentA ? 'bg-indigo-600' : 'bg-pink-600'}`}>
                                                 {line.agentName[0]}
                                             </div>
                                             <div className={`flex flex-col gap-2 max-w-md ${line.agentId === dialogueAgentA ? 'items-start' : 'items-end'}`}>
                                                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5 w-full relative group-hover:border-white/20 transition-all">
                                                     <div className="flex justify-between items-center mb-2">
                                                         <span className="font-bold text-sm">{line.agentName}</span>
                                                         <span className="text-[10px] uppercase bg-white/10 px-2 py-0.5 rounded text-slate-400">{line.emotion}</span>
                                                     </div>
                                                     {editingLineId === line.id ? (
                                                        <textarea 
                                                            className="w-full bg-black/50 p-2 rounded text-sm outline-none border border-indigo-500"
                                                            value={line.text}
                                                            autoFocus
                                                            onBlur={() => setEditingLineId(null)}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setGeneratedScript(prev => prev.map(l => l.id === line.id ? {...l, text: val} : l));
                                                            }}
                                                        />
                                                     ) : (
                                                        <p className="text-sm leading-relaxed" onDoubleClick={() => setEditingLineId(line.id)}>{line.text}</p>
                                                     )}
                                                 </div>
                                                 
                                                 <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                     <button 
                                                        onClick={() => generateLineAudio(line)} 
                                                        disabled={line.isGenerating}
                                                        className="p-2 rounded-full bg-indigo-600 text-white hover:scale-110 transition-transform"
                                                        title="Generar/Reproducir Audio"
                                                     >
                                                        {line.isGenerating ? '⏳' : '▶️'}
                                                     </button>
                                                     <button 
                                                        onClick={() => setEditingLineId(line.id)}
                                                        className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                                                        title="Editar Texto"
                                                     >
                                                        ✏️
                                                     </button>
                                                     {line.audioUrl && (
                                                         <button 
                                                            onClick={() => downloadAudio(line.audioUrl!, `dialogue_${line.id}.wav`)}
                                                            className="p-2 rounded-full bg-green-600 hover:bg-green-500"
                                                            title="Descargar Audio"
                                                         >
                                                            ⬇️
                                                         </button>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- TEMPLATES VIEW (APPLE STYLE - RECTANGULAR) --- */}
            {activeView === 'templates' && (
                <div className="w-full max-w-6xl h-[85vh] overflow-y-auto no-scrollbar pb-20 stagger-enter">
                     <div className="flex justify-between items-center mb-8 sticky top-0 bg-black/80 backdrop-blur-xl p-4 z-20 rounded-2xl border-b border-white/10">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-widest">Galería de Agentes ({agents.length})</h2>
                            <p className="text-sm text-slate-500 mt-1">Selecciona para editar. Archivos de Github precargados.</p>
                        </div>
                        <button onClick={() => { createNewTemplate(); setActiveView('studio'); }} className="px-8 py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-indigo-500/20 btn-luxury">
                            + Nuevo Agente
                        </button>
                     </div>
                     
                     <div className="flex flex-col gap-4">
                        {agents.map((agent, i) => (
                            <div key={agent.id} onClick={() => { setEditingAgent(agent); setActiveView('studio'); }} className="group relative gaussian-glass rounded-2xl p-4 border border-white/5 hover:border-indigo-500/50 transition-all cursor-pointer flex items-center gap-6 hover:bg-white/5 overflow-hidden">
                                {/* Image Left */}
                                <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 relative">
                                    <img src={agent.avatar} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    {agent.isPro && <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-amber-500 text-black text-[8px] font-black uppercase">PRO</div>}
                                </div>
                                
                                {/* Info Middle */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                                        <span className="px-2 py-0.5 rounded-full border border-white/10 text-[10px] uppercase text-slate-400 bg-black/20">{agent.category}</span>
                                    </div>
                                    <p className="text-indigo-400 text-xs uppercase tracking-widest font-bold mb-1">{agent.occupation}</p>
                                    <p className="text-sm text-slate-400 line-clamp-1">{agent.description}</p>
                                </div>

                                {/* Meta Right */}
                                <div className="flex flex-col items-end gap-2 text-right border-l border-white/5 pl-6">
                                    <div className="text-[10px] uppercase text-slate-500">Voz</div>
                                    <div className="font-mono text-xs text-indigo-300">{agent.voice}</div>
                                    <div className="text-[10px] uppercase text-slate-500 mt-1">Conocimiento</div>
                                    <div className={`w-2 h-2 rounded-full ${agent.instruction.includes('ACTIVE') ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                                </div>
                                
                                {/* Hover Effect */}
                                <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-2xl text-indigo-500">→</span>
                                </div>
                            </div>
                        ))}
                     </div>
                </div>
            )}

            {/* --- TEST LAB --- */}
            {activeView === 'test_lab' && (
                <div className="w-full max-w-4xl h-[80vh] flex flex-col items-center justify-center stagger-enter">
                    <div className="w-full gaussian-glass rounded-[3rem] p-10 border border-white/10 relative overflow-hidden">
                        <div className="flex items-center gap-6 mb-8">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                                <img src={editingAgent?.avatar || currentAgent.avatar} className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black uppercase italic">{editingAgent?.name || currentAgent.name}</h2>
                                <p className="text-indigo-400 text-sm uppercase tracking-widest">Modo Prueba de Voz</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <textarea 
                                value={testInput}
                                onChange={(e) => setTestInput(e.target.value)}
                                placeholder="Escribe algo para que el agente lo diga con su acento y personalidad..."
                                className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-6 text-lg outline-none focus:border-indigo-500 resize-none transition-all placeholder:text-slate-600"
                            />
                            
                            <div className="flex justify-between items-center">
                                <button 
                                    onClick={testAgentVoice}
                                    disabled={isTestThinking}
                                    className={`px-8 py-3 rounded-full font-bold uppercase tracking-widest transition-all ${isTestThinking ? 'bg-slate-700 cursor-wait' : 'bg-white text-black hover:scale-105'}`}
                                >
                                    {isTestThinking ? 'Generando...' : '🔊 Escuchar Preview'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- STUDIO VIEW (REDESIGNED) --- */}
            {activeView === 'studio' && (
                <div className="w-full max-w-6xl h-[85vh] flex flex-col gap-6 stagger-enter">
                     {/* 1. HERO CARD (APPLE STYLE) */}
                     <div className="w-full h-64 rounded-[2.5rem] relative overflow-hidden group border border-white/5 shadow-2xl">
                         {/* Blurred Background */}
                         <div className="absolute inset-0">
                            <img src={editingAgent?.avatar || currentAgent.avatar} className="w-full h-full object-cover opacity-30 blur-xl scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
                         </div>
                         
                         <div className="relative z-10 flex items-center h-full px-12 gap-8">
                             <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/10 relative group-hover:scale-105 transition-transform duration-500">
                                 <img src={editingAgent?.avatar || currentAgent.avatar} className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <label className="cursor-pointer text-[10px] uppercase font-bold text-white bg-indigo-600 px-3 py-1 rounded-full mb-2 hover:scale-105">
                                          Subir Foto
                                          <input type="file" className="hidden" onChange={handleAvatarUpload}/>
                                      </label>
                                      <button onClick={generateAvatar} className="text-[10px] uppercase font-bold text-white border border-white px-3 py-1 rounded-full hover:bg-white hover:text-black">
                                          Generar IA
                                      </button>
                                 </div>
                             </div>
                             
                             <div className="flex-1">
                                 <div className="flex items-center gap-3 mb-2">
                                     <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
                                         {editingAgent?.category || currentAgent.category}
                                     </span>
                                     {editingAgent?.isPro && <span className="text-amber-500 text-xs">★ PRO</span>}
                                 </div>
                                 <h2 className="text-5xl font-black italic tracking-tighter mb-2">{editingAgent?.name || currentAgent.name}</h2>
                                 <p className="text-xl text-slate-300 font-light">{editingAgent?.occupation || currentAgent.occupation}</p>
                             </div>

                             <div className="flex flex-col gap-3">
                                 <button onClick={saveTemplate} className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.3)] btn-luxury">
                                     Guardar Cambios
                                 </button>
                                 <button onClick={() => setActiveView('templates')} className="px-8 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                                     Cancelar
                                 </button>
                             </div>
                         </div>
                     </div>

                     {/* 2. EDITOR TABS PANEL */}
                     <div className="flex-1 flex gap-6 overflow-hidden">
                        {/* Tab Selector Vertical */}
                        <div className="w-48 flex flex-col gap-2 py-4">
                            {['identity', 'knowledge', 'voice', 'tools', 'export'].map(tab => (
                                <button key={tab} onClick={() => setStudioTab(tab as any)} className={`px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest text-left transition-all ${studioTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content Area */}
                        <div className="flex-1 gaussian-glass rounded-[2rem] p-8 border border-white/5 overflow-y-auto no-scrollbar relative">
                            
                            {/* IDENTITY TAB */}
                            {studioTab === 'identity' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Nombre</label>
                                            <input value={editingAgent?.name || currentAgent.name} onChange={e => {
                                                const val = e.target.value;
                                                editingAgent ? setEditingAgent({...editingAgent, name: val}) : setCurrentAgent({...currentAgent, name: val});
                                            }} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 transition-all" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Ocupación</label>
                                            <input value={editingAgent?.occupation || currentAgent.occupation} onChange={e => {
                                                const val = e.target.value;
                                                editingAgent ? setEditingAgent({...editingAgent, occupation: val}) : setCurrentAgent({...currentAgent, occupation: val});
                                            }} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <label className="text-[10px] font-black uppercase text-slate-500">System Instruction & Objetivos</label>
                                            <div className="flex gap-2">
                                                <input value={magicPromptInput} onChange={e => setMagicPromptInput(e.target.value)} placeholder="Ej: Vendedor agresivo..." className="bg-transparent border-b border-white/10 text-xs w-48 outline-none focus:border-indigo-500 placeholder:text-slate-600" />
                                                <button onClick={handleMagicWand} className="text-xs text-purple-400 hover:text-white font-bold">✨ MAGIC WAND</button>
                                            </div>
                                        </div>
                                        <textarea 
                                            value={editingAgent?.instruction || currentAgent.instruction} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                editingAgent ? setEditingAgent({...editingAgent, instruction: val}) : setCurrentAgent({...currentAgent, instruction: val});
                                            }}
                                            className="w-full h-64 bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500 font-mono leading-relaxed resize-none" 
                                        />
                                    </div>
                                </div>
                            )}

                            {/* KNOWLEDGE TAB */}
                            {studioTab === 'knowledge' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="p-6 rounded-2xl border border-dashed border-white/20 hover:border-indigo-500 transition-all text-center cursor-pointer bg-white/5">
                                        <span className="text-4xl block mb-2">📄</span>
                                        <p className="text-sm font-bold uppercase">Arrastrar PDF o TXT aquí</p>
                                        <p className="text-sm font-bold uppercase">Arrastrar PDF o TXT aquí</p>
                                        <p className="text-xs text-slate-500 mt-1">Conocimiento base para RAG</p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold uppercase text-indigo-300">Archivos Cargados</h4>
                                        {(editingAgent?.knowledge || currentAgent.knowledge || []).map((k, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-black/30 border border-white/5">
                                                <span className="text-sm truncate">{k.name}</span>
                                                <button className="text-red-400 hover:text-red-300 text-xs">ELIMINAR</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* VOICE TAB (UPDATED WITH ELEVENLABS & PRESETS) */}
                            {studioTab === 'voice' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                    <div className="flex gap-4 p-4 bg-black/20 rounded-2xl border border-white/5">
                                        {['gemini', 'elevenlabs'].map(p => (
                                            <button 
                                                key={p}
                                                onClick={() => {
                                                    const target = editingAgent || currentAgent;
                                                    const updated = { ...target, voiceSettings: { ...target.voiceSettings, provider: p as any }};
                                                    editingAgent ? setEditingAgent(updated) : setCurrentAgent(updated);
                                                }}
                                                className={`flex-1 py-3 rounded-xl border font-bold uppercase text-xs transition-all ${
                                                    (editingAgent?.voiceSettings.provider || currentAgent.voiceSettings.provider) === p 
                                                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                                                    : 'bg-transparent border-white/10 text-slate-500 hover:border-white/30'
                                                }`}
                                            >
                                                {p === 'gemini' ? 'Gemini Ultra TTS' : 'ElevenLabs API'}
                                            </button>
                                        ))}
                                    </div>

                                    {(editingAgent?.voiceSettings.provider || currentAgent.voiceSettings.provider) === 'elevenlabs' ? (
                                        <div className="space-y-6 p-6 bg-indigo-900/10 rounded-2xl border border-indigo-500/20">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-300">ElevenLabs Integration</h3>
                                                <button 
                                                    onClick={() => fetchElevenLabsVoices((editingAgent?.voiceSettings.elevenLabsApiKey || currentAgent.voiceSettings.elevenLabsApiKey || ''))}
                                                    disabled={isLoadingVoices}
                                                    className="px-4 py-1.5 rounded-lg btn-luxury text-[10px] font-bold uppercase disabled:opacity-50"
                                                >
                                                    {isLoadingVoices ? 'Cargando...' : '🔄 Actualizar Voces'}
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-500">API Key</label>
                                                    <input 
                                                        type="password"
                                                        value={editingAgent?.voiceSettings.elevenLabsApiKey || ''}
                                                        onChange={(e) => {
                                                            const target = editingAgent || currentAgent;
                                                            const updated = { ...target, voiceSettings: { ...target.voiceSettings, elevenLabsApiKey: e.target.value }};
                                                            editingAgent ? setEditingAgent(updated) : setCurrentAgent(updated);
                                                        }}
                                                        placeholder="sk-..."
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                
                                                {elevenLabsVoices.length > 0 ? (
                                                    <div className="space-y-2 animate-in fade-in">
                                                        <label className="text-[10px] font-black uppercase text-slate-500">Explorador de Voces</label>
                                                        <input 
                                                            placeholder="Buscar voz por nombre o acento..."
                                                            value={voiceSearchQuery}
                                                            onChange={e => setVoiceSearchQuery(e.target.value)}
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 mb-2"
                                                        />
                                                        
                                                        <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto no-scrollbar gaussian-glass p-2 rounded-xl">
                                                            {elevenLabsVoices
                                                                .filter(v => v.name.toLowerCase().includes(voiceSearchQuery.toLowerCase()) || v.labels?.accent?.toLowerCase().includes(voiceSearchQuery.toLowerCase()))
                                                                .map(voice => (
                                                                <div 
                                                                    key={voice.voice_id}
                                                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-2 group ${
                                                                        (editingAgent?.voiceSettings.elevenLabsVoiceId || currentAgent.voiceSettings.elevenLabsVoiceId) === voice.voice_id
                                                                        ? 'bg-indigo-600 border-indigo-500' 
                                                                        : 'bg-white/5 border-white/5 hover:border-indigo-500/50'
                                                                    }`}
                                                                >
                                                                    <div className="flex justify-between items-start">
                                                                        <div>
                                                                            <div className="font-bold text-xs">{voice.name}</div>
                                                                            <div className="text-[10px] opacity-60">{voice.category} • {voice.labels?.accent || 'N/A'}</div>
                                                                        </div>
                                                                        {voice.preview_url && (
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handlePlayPreview(voice.preview_url, voice.voice_id); }}
                                                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-colors ${playingVoicePreview === voice.voice_id ? 'bg-white text-indigo-600 animate-pulse' : 'bg-black/40 hover:bg-indigo-500 text-white'}`}
                                                                            >
                                                                                {playingVoicePreview === voice.voice_id ? '⏸' : '▶'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <button 
                                                                        onClick={() => {
                                                                            const target = editingAgent || currentAgent;
                                                                            const updated = { ...target, voiceSettings: { ...target.voiceSettings, elevenLabsVoiceId: voice.voice_id }};
                                                                            editingAgent ? setEditingAgent(updated) : setCurrentAgent(updated);
                                                                        }}
                                                                        className={`w-full py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${
                                                                             (editingAgent?.voiceSettings.elevenLabsVoiceId || currentAgent.voiceSettings.elevenLabsVoiceId) === voice.voice_id
                                                                             ? 'bg-white text-indigo-900'
                                                                             : 'bg-white/10 hover:bg-indigo-500 text-slate-300 hover:text-white'
                                                                        }`}
                                                                    >
                                                                        {(editingAgent?.voiceSettings.elevenLabsVoiceId || currentAgent.voiceSettings.elevenLabsVoiceId) === voice.voice_id ? 'Seleccionada' : 'Seleccionar'}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-slate-500">Voice ID (Manual)</label>
                                                        <input 
                                                            value={editingAgent?.voiceSettings.elevenLabsVoiceId || ''}
                                                            onChange={(e) => {
                                                                const target = editingAgent || currentAgent;
                                                                const updated = { ...target, voiceSettings: { ...target.voiceSettings, elevenLabsVoiceId: e.target.value }};
                                                                editingAgent ? setEditingAgent(updated) : setCurrentAgent(updated);
                                                            }}
                                                            placeholder="Ex: 21m00Tcm4TlvDq8ikWAM"
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-indigo-500"
                                                        />
                                                        <p className="text-[10px] text-slate-500 mt-2">Ingresa tu API Key arriba y haz clic en "Actualizar Voces" para explorar.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase text-indigo-400">🔥 Presets Argentinos (Sin 'Che' Excesivo)</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {ARGENTINE_PRESETS.map(preset => (
                                                    <div 
                                                        key={preset.id}
                                                        onClick={() => {
                                                            const target = editingAgent || currentAgent;
                                                            const updated = { 
                                                                ...target, 
                                                                voiceSettings: { 
                                                                    ...target.voiceSettings, 
                                                                    argentinaPreset: preset.id,
                                                                    pitch: preset.pitch as any,
                                                                    style: preset.style as any
                                                                } 
                                                            };
                                                            editingAgent ? setEditingAgent(updated) : setCurrentAgent(updated);
                                                        }}
                                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                                            (editingAgent?.voiceSettings.argentinaPreset || currentAgent.voiceSettings.argentinaPreset) === preset.id 
                                                            ? 'bg-indigo-600 border-indigo-500 shadow-lg' 
                                                            : 'bg-black/30 border-white/5 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <h4 className="font-bold text-xs uppercase mb-1">{preset.name}</h4>
                                                        <p className="text-[10px] text-slate-400 leading-tight">{preset.desc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* EXPORT TAB */}
                            {studioTab === 'export' && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4">
                                    {AVAILABLE_EXPORTS.map((exp, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => setExpandedExport(exp.platform === expandedExport ? null : exp.platform)}
                                            className={`p-6 rounded-2xl border bg-black/20 transition-all group cursor-pointer ${exp.platform === expandedExport ? 'border-indigo-500 bg-indigo-900/20 col-span-2' : 'border-white/5 hover:border-indigo-500/50'}`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-xl group-hover:bg-indigo-600 transition-colors">
                                                    {exp.platform === 'whatsapp' ? '📱' : exp.platform === 'web' ? '🌐' : exp.platform === 'instagram' ? '📸' : '✈️'}
                                                </div>
                                                <div className={`w-3 h-3 rounded-full ${exp.enabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            </div>
                                            <h4 className="font-bold text-lg uppercase mb-1">{exp.platform} Integration</h4>
                                            
                                            {exp.platform === 'web' && expandedExport === 'web' ? (
                                                <div className="mt-4 animate-in fade-in">
                                                    <p className="text-xs text-slate-300 mb-2">Copia y pega este código en tu `body`:</p>
                                                    <div className="bg-black p-4 rounded-xl border border-white/10 font-mono text-[10px] text-indigo-300 break-all select-all">
                                                        {`<script src="https://cdn.argentohub.pro/widget.js" \n  data-agent-id="${editingAgent?.id || currentAgent.id}" \n  data-theme="dark"></script>`}
                                                    </div>
                                                    <button className="mt-4 w-full py-2 bg-indigo-600 rounded text-xs font-bold uppercase hover:bg-indigo-500">Copiar Código</button>
                                                </div>
                                            ) : (
                                                <button className="w-full py-2 bg-white/5 text-xs font-bold uppercase rounded border border-white/10 hover:bg-white hover:text-black transition-all">
                                                    Conectar
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* TOOLS TAB */}
                            {studioTab === 'tools' && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4">
                                    {AVAILABLE_CONNECTORS.map(conn => {
                                        const target = editingAgent || currentAgent;
                                        const isEnabled = target.connectors?.some(c => c.id === conn.id);
                                        return (
                                            <div key={conn.id} onClick={() => {
                                                 const existing = target.connectors?.find(c => c.id === conn.id);
                                                 let newConnectors;
                                                 if (existing) {
                                                   newConnectors = target.connectors?.filter(c => c.id !== conn.id);
                                                 } else {
                                                   const config = AVAILABLE_CONNECTORS.find(c => c.id === conn.id);
                                                   if (config) newConnectors = [...(target.connectors || []), { ...config, enabled: true }];
                                                 }
                                                 const updated = { ...target, connectors: newConnectors };
                                                 editingAgent ? setEditingAgent(updated) : setCurrentAgent(updated);
                                            }} className={`p-6 rounded-2xl border cursor-pointer transition-all flex items-center gap-4 ${isEnabled ? 'bg-indigo-600/20 border-indigo-500' : 'bg-black/20 border-white/5 hover:border-white/20'}`}>
                                                <span className="text-2xl">{conn.icon}</span>
                                                <div>
                                                    <h4 className="font-bold text-sm">{conn.name}</h4>
                                                    <p className="text-[10px] uppercase text-slate-500">{isEnabled ? 'Conectado' : 'Desconectado'}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                     </div>
                </div>
            )}
        </main>
    </div>
  );
};

export default App;