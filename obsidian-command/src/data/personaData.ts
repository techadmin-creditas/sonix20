export interface PersonaProfile {
  id: string;
  name: string;
  gender: 'Female' | 'Male' | 'Non-binary';
  language: string;
  tone: string;
  useCase: string;
  psychology: string;
  themeColor: string; // Tailwinds class border-X / text-X / shadow-X
  avatar?: string;
  description: string;
  isPrebuilt?: boolean;
  provider?: string;
  // Neural Parameters
  emotion?: string;
  urgency?: number;
  empathy?: number;
  stability?: number;
  clarity?: number;
  styleExaggeration?: number;
  baseModel?: string;
  selectedVoice?: string;
}

export const VOICE_PERSONAS: PersonaProfile[] = [
  // --- CORE SYSTEM PERSONAS (Original 8) ---
  {
    id: 'ananya',
    name: 'Ananya',
    gender: 'Female',
    language: 'Hindi/Hinglish',
    tone: 'Warm · Empathetic',
    useCase: 'Soft collections (DPD 1-30)',
    psychology: 'Helpful sister persona. Trust-builder.',
    themeColor: 'amber',
    description: 'Nurturing tone for early defaults.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 30, empathy: 85, stability: 80, baseModel: 'Sonix-Flash-1', selectedVoice: 'v1'
  },
  {
    id: 'arjun',
    name: 'Arjun',
    gender: 'Male',
    language: 'Hindi/Hinglish',
    tone: 'Firm · Professional',
    useCase: 'Mid-stage (DPD 30-90)',
    psychology: 'Senior RM energy.',
    themeColor: 'blue',
    description: 'Authoritative yet professional.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 70, empathy: 40, stability: 90, baseModel: 'Sonix-Pro-3', selectedVoice: 'v2'
  },
  {
    id: 'priya',
    name: 'Priya',
    gender: 'Female',
    language: 'English',
    tone: 'Upbeat · Professional',
    useCase: 'Cards acquisition',
    psychology: 'Smart financial advisor.',
    themeColor: 'emerald',
    description: 'High-energy math-focused persona.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 60, empathy: 50, stability: 70, baseModel: 'Sonix-Flash-1', selectedVoice: 'v1'
  },
  {
    id: 'ravi',
    name: 'Ravi',
    gender: 'Male',
    language: 'Hindi',
    tone: 'Authoritative · Measured',
    useCase: 'NPA settlement',
    psychology: 'Data-driven pressure.',
    themeColor: 'rose',
    description: 'Measured tone for complex negotiations.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 85, empathy: 20, stability: 95, baseModel: 'Sonix-Pro-3', selectedVoice: 'v2'
  },
  {
    id: 'kavitha',
    name: 'Kavitha',
    gender: 'Female',
    language: 'Tamil + English',
    tone: 'Patient · Respectful',
    useCase: 'Regional collections',
    psychology: 'Cultural respect + patience.',
    themeColor: 'purple',
    description: 'Culturally attuned using honorifics.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 40, empathy: 90, stability: 85, baseModel: 'Sonix-Flash-1', selectedVoice: 'v3'
  },
  {
    id: 'vikram',
    name: 'Vikram',
    gender: 'Male',
    language: 'English',
    tone: 'Energetic · Consultative',
    useCase: 'Cross-sell, upsell',
    psychology: 'Consultative expert.',
    themeColor: 'cyan',
    description: 'ROI and logical value-propositions.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 55, empathy: 45, stability: 75, baseModel: 'Sonix-Flash-1', selectedVoice: 'v1'
  },
  {
    id: 'diya',
    name: 'Diya',
    gender: 'Female',
    language: 'Hinglish',
    tone: 'Calm · Supportive',
    useCase: 'Hardship cases',
    psychology: 'Dignity-preserving.',
    themeColor: 'teal',
    description: 'Supportive, non-judgmental voice.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 20, empathy: 95, stability: 88, baseModel: 'Sonix-Flash-1', selectedVoice: 'v3'
  },
  {
    id: 'aditya',
    name: 'Aditya',
    gender: 'Male',
    language: 'English/Hindi',
    tone: 'Friendly · Celebratory',
    useCase: 'Relationship building',
    psychology: 'Positive reinforcement logic.',
    themeColor: 'orange',
    description: 'Post-recovery retention expert.',
    isPrebuilt: true,
    provider: 'System',
    urgency: 10, empathy: 80, stability: 60, baseModel: 'Sonix-Flash-1', selectedVoice: 'v2'
  },

  // --- EXTENDED FLEET (42 NEW PERSONAS) ---
  ...(() => {
    const fleet: PersonaProfile[] = [];
    const names = [
      'Aarav', 'Ishaan', 'Vihaan', 'Saanvi', 'Kiara', 'Myra', 'Kabir', 'Rohan',
      'Sanya', 'Ishita', 'Arnav', 'Siddharth', 'Meera', 'Zara', 'Karthik', 'Madhav',
      'Surya', 'Lakshmi', 'Meenakshi', 'Swaroop', 'Sarah', 'David', 'Emily', 'Leo',
      'Maya', 'Neha', 'Rahul', 'Sameer', 'Tanvi', 'Vikas', 'Yash', 'Zoya',
      'Abhinav', 'Bhavya', 'Chaitra', 'Daksh', 'Eesha', 'Faizan', 'Gauri', 'Hritik',
      'Ira', 'Jiya'
    ];

    for (let i = 0; i < 42; i++) {
      const stage = i % 4;
      const name = names[i % names.length];
      const gender = i % 2 === 0 ? 'Female' : 'Male';
      const model = i % 2 === 0 ? 'Sonix-Flash-1' : 'Sonix-Pro-3';
      const engine = `v${(i % 6) + 1}`;

      const configs = [
        { use: 'Early Debt', tone: 'Polite Reminder', color: 'emerald', u: 25, e: 80 },
        { use: 'Mid Debt', tone: 'Consistent Follow-up', color: 'blue', u: 55, e: 45 },
        { use: 'Late Debt', tone: 'Commanding Authority', color: 'rose', u: 85, e: 15 },
        { use: 'Sales', tone: 'Persuasive Advisor', color: 'amber', u: 40, e: 60 }
      ];

      const conf = configs[stage];

      fleet.push({
        id: `fleet-${i}`,
        name: name,
        gender: gender as any,
        language: i % 3 === 0 ? 'Hinglish' : i % 3 === 1 ? 'Hindi' : 'English',
        tone: conf.tone,
        useCase: conf.use,
        psychology: `Neural profile for ${conf.tone}.`,
        themeColor: conf.color,
        description: `Fleet agent ${i + 1}.`,
        isPrebuilt: true,
        provider: 'Fleet',
        urgency: conf.u + (i % 10),
        empathy: conf.e + (i % 10),
        stability: 70 + (i % 20),
        baseModel: model,
        selectedVoice: engine
      });
    }
    return fleet;
  })()
];

export interface PersonaTemplate {
  id: string;
  label: string;
  description: string;
  defaultGender: 'Female' | 'Male' | 'Non-binary';
  defaultTone: string;
  behavior: {
    emotion: string;
    style: string;
    stability: number;
    clarity: number;
  };
}

export const PERSONA_TEMPLATES: PersonaTemplate[] = [
  {
    id: 'nurturer',
    label: 'Helpful Nurturer',
    description: 'Soft, empathetic tone for early-stage defaults.',
    defaultGender: 'Female',
    defaultTone: 'Warm · Empathetic',
    behavior: { emotion: 'Empathetic', style: 'consultative', stability: 80, clarity: 60 }
  },
  {
    id: 'professional',
    label: 'Firm Professional',
    description: 'Measured, authoritative tone for mid-stage cases.',
    defaultGender: 'Male',
    defaultTone: 'Firm · Professional',
    behavior: { emotion: 'Firm', style: 'short', stability: 90, clarity: 80 }
  },
  {
    id: 'advisor',
    label: 'Smart Advisor',
    description: 'Upbeat, data-driven for sales and EMI conversion.',
    defaultGender: 'Female',
    defaultTone: 'Upbeat · Professional',
    behavior: { emotion: 'Calm', style: 'detailed', stability: 70, clarity: 90 }
  },
  {
    id: 'closer',
    label: 'Direct Closer',
    description: 'Urgent, high-confidence for late-stage NPA settlement.',
    defaultGender: 'Male',
    defaultTone: 'Authoritative · Measured',
    behavior: { emotion: 'Urgent', style: 'persuasive', stability: 85, clarity: 75 }
  }
];
