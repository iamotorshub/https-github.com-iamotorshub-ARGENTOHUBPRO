
export interface TranscriptionEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingLinks?: { title: string; uri: string }[];
}

export interface VoiceSettings {
  speed: number; // 0.5 a 2.0
  pitch: 'Grave' | 'Medio' | 'Agudo';
  style: 'Profesional' | 'Canchero' | 'Agresivo' | 'Empático' | 'Seductor' | 'Amigable' | 'Serio' | 'Entusiasta' | 'Nostálgico' | 'Enérgico' | 'Inspirador' | 'Seguro' | 'Alegre' | 'Calmado';
  provider: 'gemini' | 'elevenlabs';
  elevenLabsVoiceId?: string;
  elevenLabsApiKey?: string;
  accentLevel: number; // 0 a 100
  argentinaPreset?: string; // Nuevo campo para presets argentinos
}

export interface ConnectorConfig {
  id: string; // 'gmail', 'calendar', 'drive'
  name: string;
  enabled: boolean;
  apiKey?: string;
  icon: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'url' | 'file' | 'text';
  name: string;
  content: string;
  timestamp: number;
}

export interface ExportConfig {
  platform: 'web' | 'whatsapp' | 'instagram' | 'telegram';
  enabled: boolean;
  integrationId?: string;
}

export interface Agent {
  id: string;
  name: string;
  category: string;
  instruction: string;
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Custom';
  voiceSettings: VoiceSettings;
  connectors?: ConnectorConfig[];
  knowledge?: KnowledgeItem[];
  exports?: ExportConfig[];
  description: string;
  age: string;
  gender: 'Hombre' | 'Mujer';
  occupation: string;
  avatar: string;
  website?: string;
  isFavorite?: boolean;
  isPro?: boolean;
  capabilitiesSummary?: string;
}

export interface Connector {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  icon: string;
}

// Tipos para Doblaje/Diálogo
export interface DialogueLine {
  id: string;
  agentId: string; // ID del agente para saber qué voz usar
  agentName: string;
  text: string;
  emotion: string;
  audioUrl?: string; // URL del Blob generado
  duration?: number; // Duración en segundos
  isGenerating?: boolean;
}

export interface DialogueSession {
  id: string;
  agentAId: string;
  agentBId: string;
  topic: string;
  lines: DialogueLine[];
}

export interface Scene {
  id: string;
  title: string;
  agentA: Agent;
  agentB: Agent;
  scriptLines: DialogueLine[]; 
  timestamp: number;
  topic?: string;
}

// Tipos para Aladino
export interface AladinoAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'csv' | 'code' | 'other';
  dataUrl: string; // Base64 preview or content
}

export interface AladinoMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachments?: AladinoAttachment[];
  timestamp: number;
  agentId?: string; // Nuevo: ID del agente que generó la respuesta (si aplica)
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: {
    accent?: string;
    description?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
  preview_url?: string;
}