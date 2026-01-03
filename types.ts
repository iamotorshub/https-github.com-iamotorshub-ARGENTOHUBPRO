
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
}

export interface Agent {
  id: string;
  name: string;
  category: string;
  instruction: string;
  voice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  description: string;
  age: string;
  gender: 'Hombre' | 'Mujer';
  occupation: string;
  avatar: string;
  website?: string;
  isFavorite?: boolean;
}

export interface Connector {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  icon: string;
}
