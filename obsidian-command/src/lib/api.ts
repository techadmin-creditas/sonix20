/** REST API base (override with VITE_API_BASE, e.g. http://localhost:8000/api/v1) */
const BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';

/** HTTP origin for the voice gateway (no /api/v1), used to build default ws:// URL */
export function getApiOrigin(): string {
  try {
    const u = new URL(BASE_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:8000';
  }
}

/**
 * Full WebSocket URL for /ws/voice/...
 * Set VITE_VOICE_WS_BASE to override (e.g. ws://127.0.0.1:8000 or wss://api.example.com).
 */
export function getVoiceWebSocketUrl(websocketPath: string): string {
  const path = websocketPath.startsWith('/') ? websocketPath : `/${websocketPath}`;
  const wsBase = import.meta.env.VITE_VOICE_WS_BASE as string | undefined;
  if (wsBase?.trim()) {
    return `${wsBase.replace(/\/$/, '')}${path}`;
  }
  const origin = getApiOrigin();
  try {
    const u = new URL(origin);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${u.host}${path}`;
  } catch {
    return `ws://localhost:8000${path}`;
  }
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  persona: string;
  role: string;
  icon: string;
  color: string;
  greeting?: string;
  tools_enabled: string[];
  llm_model: string;
  voice_id?: string;
  temperature?: number;
  max_tokens?: number;
  workflow_id?: string;
  is_active: boolean;
  created_at: number;
  /** classic | speech_speech (S2S falls back to classic until provider wired) */
  pipeline_mode?: string;
  guardrail_policy?: Record<string, unknown>;
  data_access_policy?: Record<string, unknown>;
  conversation_policy?: Record<string, unknown>;
  /** Optional structured task contract (rendered into system prompt on server) */
  agent_task_spec?: Record<string, unknown>;
  /** Webhook fired with {session_id, transcript, reason} when user requests human agent */
  escalate_webhook_url?: string;
  /** Receives SMS/email action payloads from workflow action nodes */
  actions_webhook_url?: string;
  /** Receives {session_id, summary, intent} after every session ends */
  post_call_webhook_url?: string;
  /** Min Deepgram confidence (0-1). Below this on short utterances, bot asks to repeat */
  min_stt_confidence?: number;
  tts_provider?: string;
  default_language?: string;
  proactive_prompts?: string[];
  topic_restriction?: string;
  refuse_off_topic?: boolean;
}

export interface SessionFeedback {
  outcome: 'resolved' | 'escalated' | 'abandoned';
  csat_score: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface UserFact {
  id: number;
  session_id?: string;
  user_id?: string;
  fact: string;
  category?: string;
  created_at: number;
}

export interface LatencyRecord {
  session_id: string;
  stt_ms: number;
  llm_ms: number;
  tts_ms: number;
  total_ms: number;
  first_audio_ms: number;
}

export interface IntentRecord {
  intent: string;
  count: number;
}

export interface DashboardStats {
  metrics: {
    totalSessions: number;
    activeBots: number;
    avgLatency: string;
    successRate: string;
    avgDuration: string;
  };
  botUsage: { name: string; value: number }[];
  peakHours: { hour: string; sessions: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface SessionRecord {
  id: string;
  bot_id: string;
  bot_name: string;
  user_id: string;
  language: string;
  started_at: number;
  ended_at: number | null;
  turn_count: number;
  metadata?: any;
}

export interface KnowledgeEntry {
  id: number;
  bot_id?: string;
  topic: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  created_at: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  is_active: boolean;
  created_at: number;
  updated_at?: number;
}

export interface RawVectorEntry {
  id: string;
  content: string;
  metadata: any;
}

export interface QACacheEntry {
  id: string;
  question: string;
  answer: string;
  bot_id: string;
  cached_at: string;
}

export const api = {
  async getBots(): Promise<Bot[]> {
    const res = await fetch(`${BASE_URL}/bots`);
    if (!res.ok) throw new Error('Failed to fetch bots');
    const data = await res.json();
    return data.bots;
  },
  
  async getBot(id: string): Promise<Bot> {
    const res = await fetch(`${BASE_URL}/bots/${id}`);
    if (!res.ok) throw new Error('Failed to fetch bot');
    return res.json();
  },

  async getModels(): Promise<{id: string, name: string, provider: string}[]> {
    const res = await fetch(`${BASE_URL}/metadata/models`);
    if (!res.ok) throw new Error('Failed to fetch models');
    const data = await res.json();
    return data.models;
  },

  async getVoices(): Promise<{id: string, name: string, provider: string}[]> {
    const res = await fetch(`${BASE_URL}/metadata/voices`);
    if (!res.ok) throw new Error('Failed to fetch voices');
    const data = await res.json();
    return data.voices;
  },

  async createBot(data: Partial<Bot>): Promise<any> {
    const res = await fetch(`${BASE_URL}/bots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bot');
    return res.json();
  },

  async createSession(
    botId?: string,
    transport: 'websocket' | 'webrtc' | 'livekit' = 'websocket',
    userId?: string
  ): Promise<{
    session_id: string;
    websocket_url: string;
    transport?: string;
    livekit?: { url: string; token: string; room_name: string } | null;
    livekit_error?: string;
  }> {
    const url = new URL(`${BASE_URL}/sessions`);
    if (botId) url.searchParams.append('bot_id', botId);
    url.searchParams.append('transport', transport);
    if (userId) url.searchParams.append('user_id', userId);
    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  },

  async updateBot(id: string, data: Partial<Bot>): Promise<any> {
    const res = await fetch(`${BASE_URL}/bots/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bot');
    return res.json();
  },

  async deleteBot(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/bots/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete bot');
    return res.json();
  },

  async deleteWorkflow(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/workflows/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete workflow');
    return res.json();
  },

  async deleteSession(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/sessions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete session');
    return res.json();
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${BASE_URL}/analytics/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  async getSessions(limit = 50): Promise<SessionRecord[]> {
    const res = await fetch(`${BASE_URL}/sessions?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch sessions');
    const data = await res.json();
    return data.sessions;
  },

  async getSessionDetails(id: string): Promise<SessionRecord> {
    const res = await fetch(`${BASE_URL}/sessions/${id}`);
    if (!res.ok) throw new Error('Failed to fetch session details');
    return res.json();
  },

  async getSessionTranscript(id: string): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/sessions/${id}/log`);
    if (!res.ok) throw new Error('Failed to fetch session transcript');
    const data = await res.json();
    return data.turns;
  },

  async getKnowledgeEntries(limit = 100): Promise<KnowledgeEntry[]> {
    const res = await fetch(`${BASE_URL}/knowledge?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch knowledge base');
    const data = await res.json();
    return data.entries;
  },

  async addKnowledgeEntry(entry: Partial<KnowledgeEntry>): Promise<any> {
    const res = await fetch(`${BASE_URL}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to add knowledge entry');
    return res.json();
  },

  async deleteKnowledgeEntry(id: number): Promise<any> {
    const res = await fetch(`${BASE_URL}/knowledge/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete knowledge entry');
    return res.json();
  },

  async getWorkflows(): Promise<Workflow[]> {
    const res = await fetch(`${BASE_URL}/workflows`);
    if (!res.ok) throw new Error('Failed to fetch workflows');
    const data = await res.json();
    return data.workflows;
  },

  async getWorkflow(id: string): Promise<Workflow> {
    const res = await fetch(`${BASE_URL}/workflows/${id}`);
    if (!res.ok) throw new Error('Failed to fetch workflow');
    return res.json();
  },

  async saveWorkflow(data: Partial<Workflow>): Promise<{status: string, id: string}> {
    const res = await fetch(`${BASE_URL}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save workflow');
    return res.json();
  },

  async testWorkflow(workflow_data: any, user_input: string, current_node_id?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/workflows/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_data, user_input, current_node_id }),
    });
    if (!res.ok) throw new Error('Failed to test workflow');
    return res.json();
  },

  async submitFeedback(sessionId: string, data: SessionFeedback): Promise<any> {
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit feedback');
    return res.json();
  },

  async getSessionFacts(sessionId: string): Promise<UserFact[]> {
    const res = await fetch(`${BASE_URL}/sessions/${sessionId}/facts`);
    if (!res.ok) throw new Error('Failed to fetch session facts');
    const data = await res.json();
    return data.facts;
  },

  async getLatencyAnalytics(): Promise<LatencyRecord[]> {
    const res = await fetch(`${BASE_URL}/analytics/latency`);
    if (!res.ok) throw new Error('Failed to fetch latency analytics');
    const data = await res.json();
    return data.records;
  },

  async getIntentAnalytics(): Promise<IntentRecord[]> {
    const res = await fetch(`${BASE_URL}/analytics/intents`);
    if (!res.ok) throw new Error('Failed to fetch intent analytics');
    const data = await res.json();
    return data.intents;
  },

  async getHealth(): Promise<any> {
    const res = await fetch(`${BASE_URL.replace('/api/v1', '')}/health`);
    if (!res.ok) throw new Error('Failed to fetch health');
    return res.json();
  },

  async getVectorHealth(): Promise<{ status: string; doc_count: number }> {
    const res = await fetch(`${BASE_URL}/health/vector`);
    if (!res.ok) throw new Error('Failed to fetch vector health');
    return res.json();
  },

  async getLearnedMemory(botId: string): Promise<KnowledgeEntry[]> {
    const res = await fetch(`${BASE_URL}/bots/${botId}/memory`);
    if (!res.ok) throw new Error('Failed to fetch learned memory');
    const data = await res.json();
    return data.facts;
  },

  async deleteLearnedMemory(factId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/memory/${factId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete memory fact');
    return res.json();
  },

  async getAllVectorMemory(limit = 100): Promise<RawVectorEntry[]> {
    const res = await fetch(`${BASE_URL}/memory/all?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch raw vector memory');
    const data = await res.json();
    return data.items;
  },

  async getQACacheMemory(limit = 100): Promise<QACacheEntry[]> {
    const res = await fetch(`${BASE_URL}/memory/qa?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch QA cache memory');
    const data = await res.json();
    return data.items;
  },
};
