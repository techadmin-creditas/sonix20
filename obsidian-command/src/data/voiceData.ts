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
    name: 'Ananya',
    provider: 'ElevenLabs',
    type: 'Neural',
    tags: ['Warm', 'Empathetic', 'Professional']
  },
  {
    id: 'v2',
    name: 'Aarav',
    provider: 'ElevenLabs',
    type: 'Neural',
    tags: ['Firm', 'Authoritative', 'Clear']
  },
  {
    id: 'v3',
    name: 'Priya',
    provider: 'ElevenLabs',
    type: 'Neural',
    tags: ['Warm', 'Friendly', 'Hindi-English']
  },
  {
    id: 'v4',
    name: 'Arjun',
    provider: 'ElevenLabs',
    type: 'Neural',
    tags: ['Neutral', 'Calm', 'Hindi']
  },
  {
    id: 'v5',
    name: 'Kavya',
    provider: 'ElevenLabs',
    type: 'Neural',
    tags: ['Fast', 'Low-Latency', 'Task-Oriented']
  }
];
