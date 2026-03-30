export interface Teammate {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  status: 'Active Now' | 'Away' | 'Offline' | string;
  avatar: string;
}

export interface Session {
  id: string;
  bot: string;
  status: 'Active' | 'Ended';
  time: string;
  duration: string;
  turns: number;
  sentiment: number;
  intent: string;
  date: string;
}

export interface TranscriptMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

export interface SessionDetail extends Session {
  transcript: TranscriptMessage[];
  summary: string;
  insights: string[];
  metrics: {
    sttLatency: number;
    llmLatency: number;
    ttsLatency: number;
    totalRtt: number;
  };
  recordingUrl?: string;
}

export interface KnowledgeEntry {
  id: string;
  category: string;
  priority: number;
  question: string;
  answer: string;
  tags: string[];
  hits: string;
  confidence: string;
  lastUpdated: string;
  author: string;
  path: string;
}

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'Active' | 'Inactive';
  sessions: string;
  rating: number;
  completion: string;
  tools: string[];
  icon: string;
  color: string;
}

export interface WorkflowStep {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'speech' | 'userInput' | 'logic' | 'sentiment' | 'language' | 'backtrack' | 'knowledge';
  label: string;
  description: string;
  icon: string;
  config?: any;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Draft' | 'Inactive';
  lastUpdated: string;
  steps: WorkflowStep[];
}
