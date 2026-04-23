import { Brain, Cpu, ShieldCheck, MessageSquare } from 'lucide-react';

export interface VoiceRelay {
  id: string;
  name: string;
  languages: string[];
  provider: string;
  type: string;
  role: string;
  latency: string;
  stability: string;
  gender: 'Female' | 'Male' | 'Non-binary';
  themeColor: string;
  previewUrl?: string;
  tags?: string[];
  tones?: any[];
}

export const VOICES: VoiceRelay[] = [
  {
    id: 'v1',
    name: 'Ananya',
    languages: ['Hindi', 'English', 'Tamil'],
    provider: 'ElevenLabs',
    type: 'Neural',
    role: 'Support Specialist',
    latency: '125ms',
    stability: '92%',
    gender: 'Female',
    themeColor: 'amber',
    tags: ['Empathetic', 'Casual', 'Warm'],
    tones: [
      { id: 'empathetic', name: 'Empathetic', label: 'Warm & Caring', icon: Brain },
      { id: 'casual', name: 'Casual', label: 'Friendly & Chill', icon: MessageSquare },
    ]
  },
  {
    id: 'v2',
    name: 'Aarav',
    languages: ['Hindi'],
    provider: 'Deepgram',
    type: 'Neural',
    role: 'Collection Authority',
    latency: '148ms',
    stability: '88%',
    gender: 'Male',
    themeColor: 'blue',
    tags: ['Firm', 'Analytical', 'Clear'],
    tones: [
      { id: 'firm', name: 'Firm', label: 'Direct & Strong', icon: ShieldCheck },
      { id: 'analytical', name: 'Analytical', label: 'Precise & Calm', icon: Cpu },
    ]
  },
  {
    id: 'v3',
    name: 'Priya',
    languages: ['Hindi', 'English', 'Spanish', 'Tamil'],
    provider: 'ElevenLabs',
    type: 'Neural',
    role: 'Customer Success',
    latency: '135ms',
    stability: '95%',
    gender: 'Female',
    themeColor: 'rose',
    tags: ['Empathetic', 'Casual', 'Friendly'],
    tones: [
      { id: 'empathetic', name: 'Empathetic', label: 'Warm & Caring', icon: Brain },
      { id: 'casual', name: 'Casual', label: 'Friendly & Chill', icon: MessageSquare },
    ]
  },
  {
    id: 'v4',
    name: 'Arjun',
    languages: ['Hindi', 'English'],
    provider: 'Gemini',
    type: 'Neural',
    role: 'Sales Specialist',
    latency: '162ms',
    stability: '82%',
    gender: 'Male',
    themeColor: 'cyan',
    tags: ['Analytical', 'Firm', 'Neutral'],
    tones: [
      { id: 'analytical', name: 'Analytical', label: 'Precise & Calm', icon: Cpu },
      { id: 'firm', name: 'Firm', label: 'Direct & Strong', icon: ShieldCheck },
      { id: 'empathetic', name: 'Empathetic', label: 'Warm & Caring', icon: Brain },

    ]
  },
  {
    id: 'v5',
    name: 'Kavya',
    languages: ['Hindi', 'English'],
    provider: 'ElevenLabs',
    type: 'Neural',
    role: 'Verification Lead',
    latency: '118ms',
    stability: '97%',
    gender: 'Female',
    themeColor: 'purple',
    tags: ['Analytical', 'Direct', 'Task-Oriented'],
    tones: [
      { id: 'analytical', name: 'Analytical', label: 'Precise & Calm', icon: Cpu },
      { id: 'firm', name: 'Firm', label: 'Direct & Strong', icon: ShieldCheck },
    ]
  },
];

export const VOICE_RELAYS = VOICES;