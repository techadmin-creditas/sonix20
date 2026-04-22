export interface VoiceRelay {
  id: string;
  name: string;
  provider: 'ElevenLabs' | 'Azure' | 'OpenAI' | 'Sonix' | 'PlayHT';
  type: 'Neural' | 'Cloned' | 'Standard';
  previewUrl?: string;
  tags?: string[];
}

export const VOICE_RELAYS: VoiceRelay[] = [
  { 
    id: 'v1', 
    name: 'Rachel', 
    provider: 'ElevenLabs', 
    type: 'Neural', 
    tags: ['Warm', 'Empathetic', 'Professional']
  },
  { 
    id: 'v2', 
    name: 'Marcus', 
    provider: 'ElevenLabs', 
    type: 'Neural', 
    tags: ['Firm', 'Authoritative', 'Clear']
  },
  { 
    id: 'v3', 
    name: 'Saira', 
    provider: 'Sonix', 
    type: 'Cloned', 
    tags: ['Warm', 'Friendly', 'Hindi-English']
  },
  { 
    id: 'v4', 
    name: 'Aditya', 
    provider: 'Azure', 
    type: 'Standard', 
    tags: ['Neutral', 'Calm', 'Hindi']
  },
  { 
    id: 'v5', 
    name: 'Neural-Core-1', 
    provider: 'Sonix', 
    type: 'Neural', 
    tags: ['Fast', 'Low-Latency', 'Task-Oriented']
  },
  { 
    id: 'v6', 
    name: 'Sam', 
    provider: 'OpenAI', 
    type: 'Neural', 
    tags: ['Conversational', 'Casual', 'Breathable']
  }
];
