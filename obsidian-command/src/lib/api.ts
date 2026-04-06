/** REST API base (override with VITE_API_BASE, e.g. http://localhost:8000/api/v1) */
const BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';
const AUTH_TOKEN_KEY = 'voicebot.auth.token';

export type AuthUser = {
  id: string;
  username: string;
  role: 'admin' | 'user';
  is_active?: number;
};

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

const nativeFetch = globalThis.fetch.bind(globalThis);

async function authedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return nativeFetch(input, { ...(init || {}), headers });
}
const fetch = authedFetch;

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  } catch {}
  return fallback;
}

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
  llm_provider?: string;
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



export interface SandboxStageResult {
  original: string;
  sanitized: string;
  blocked: boolean;
  block_rule: string | null;
  block_message: string | null;
  was_masked: boolean;
}

export interface RuleOption {
  id: string;
  label: string;
  description: string;
  requires?: string;
}

export interface GuardrailMetadata {
  triggers: RuleOption[];
  actions: RuleOption[];
  scopes: RuleOption[];
}

export interface GuardrailRule {
  id: string;
  name: string;
  description?: string;
  scope: 'input' | 'output' | 'both';
  trigger: string;
  pattern: string;
  action: string;
  params: Record<string, any>;
  is_active?: boolean;
  priority?: number;
}

export interface GuardrailPolicy {
  rules: GuardrailRule[];
  injection_check_enabled?: boolean;
  injection_action?: 'log' | 'block';
  injection_block_message?: string;
  kb_only_factual?: boolean;
  semantic_cache_ttl_seconds?: number;
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
  async login(username: string, password: string): Promise<{ access_token: string; token_type: string; user: AuthUser }> {
    const res = await nativeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid username or password');
    const data = await res.json();
    if (data?.access_token) setAuthToken(data.access_token);
    return data;
  },

  async me(): Promise<AuthUser> {
    const res = await fetch(`${BASE_URL}/auth/me`);
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  async listUsers(): Promise<AuthUser[]> {
    const res = await fetch(`${BASE_URL}/admin/users`);
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return data.users || [];
  },

  async createUser(data: { username: string; password: string; role?: 'admin' | 'user' }): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create user'));
    return res.json();
  },

  async updateUser(userId: string, data: { username?: string; role?: 'admin' | 'user'; is_active?: boolean }): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to update user'));
    return res.json();
  },

  async changeUserPassword(userId: string, password: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to change password'));
    return res.json();
  },

  async getBots(): Promise<Bot[]> {
    const res = await authedFetch(`${BASE_URL}/bots`);
    if (!res.ok) throw new Error('Failed to fetch bots');
    const data = await res.json();
    return data.bots;
  },

  async getBot(id: string): Promise<Bot> {
    const res = await fetch(`${BASE_URL}/bots/${id}`);
    if (!res.ok) throw new Error('Failed to fetch bot');
    return res.json();
  },

  async getModels(): Promise<{ id: string, name: string, provider: string }[]> {
    const res = await fetch(`${BASE_URL}/metadata/models`);
    if (!res.ok) throw new Error('Failed to fetch models');
    const data = await res.json();
    return data.models;
  },

  async getVoices(): Promise<{ id: string, name: string, provider: string }[]> {
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

  async saveWorkflow(data: Partial<Workflow>): Promise<{ status: string, id: string }> {
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

  async getGuardrailSuggestions(botId: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/bots/${botId}/suggest-rules`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to fetch guardrail suggestions');
    return res.json();
  },

  async getGuardrailMetadata(): Promise<GuardrailMetadata> {
    const res = await fetch(`${BASE_URL}/metadata/guardrails`);
    if (!res.ok) throw new Error('Failed to fetch guardrail metadata');
    return res.json();
  },

  async getScopes(): Promise<Record<string, string[]>> {
    const res = await fetch(`${BASE_URL}/scopes`);
    if (!res.ok) throw new Error('Failed to fetch scopes');
    const data = await res.json();
    return data.scopes;
  },

  /** STT test: DeepgramStreamingProvider (live WebSocket path), no LLM/TTS. */
  async sttSandbox(
    botId: string,
    audioBlob: Blob,
    filename = 'capture.pcm',
    opts?: { rawPcm?: boolean }
  ): Promise<{
    transcript: string;
    confidence: number | null;
    resolved_stt_language: string;
    default_language: string;
    deepgram_query_params: Record<string, string>;
  }> {
    const url = new URL(`${BASE_URL}/bots/${botId}/stt-sandbox`);
    if (opts?.rawPcm) url.searchParams.set('raw_pcm', 'true');
    const fd = new FormData();
    fd.append('file', audioBlob, filename);
    const res = await fetch(url.toString(), {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      let msg = 'STT sandbox failed';
      try {
        const j = await res.json();
        if (j?.detail) msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch {
        msg = (await res.text()) || msg;
      }
      throw new Error(msg);
    }
    return res.json();
  },

  async sandboxTest(payload: {
    user_input: string;
    guardrail_policy: Record<string, unknown>;
    system_prompt: string;
    llm_model: string;
    llm_provider?: string;
    temperature?: number;
    max_tokens?: number;
    test_mode: 'guardrail_only' | 'full_pipeline';
  }): Promise<{
    input_result: SandboxStageResult;
    llm_result: { response?: string; error?: string } | null;
    output_result: SandboxStageResult | null;
    final_output: string | null;
  }> {
    const res = await fetch(`${BASE_URL}/guardrails/sandbox-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Sandbox test failed');
    return res.json();
  },

  async suggestDataAccessPolicy(botContext: {
    name: string;
    role: string;
    system_prompt: string;
    available_scopes: Record<string, string[]>;
  }): Promise<{
    enabled_scopes: string[];
    appointments_match_session_user: boolean;
    integrations: Record<string, { url_template: string; method: string }>;
    reasoning: string;
  }> {
    const res = await fetch(`${BASE_URL}/guardrails/suggest-data-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(botContext),
    });
    if (!res.ok) throw new Error('Failed to get data access suggestions');
    return res.json();
  },

  // ─── 🛡️ Dynamic Tools ───
  async getCustomTools(): Promise<any[]> {
    const res = await fetch(`${BASE_URL}/tools/custom`);
    if (!res.ok) throw new Error('Failed to fetch custom tools');
    const data = await res.json();
    return data.tools;
  },

  async createCustomTool(data: any): Promise<any> {
    const res = await fetch(`${BASE_URL}/tools/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create custom tool');
    return res.json();
  },

  // ─── 📚 Knowledge Ingestion ───
  async ingestUrl(url: string, botId?: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/knowledge/ingest/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, bot_id: botId }),
    });
    if (!res.ok) throw new Error('Failed to ingest URL');
    return res.json();
  },

  async ingestPdf(file: File, botId?: string): Promise<any> {
    const fd = new FormData();
    fd.append('file', file);
    if (botId) fd.append('bot_id', botId);
    const res = await fetch(`${BASE_URL}/knowledge/ingest/upload`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) throw new Error('Failed to upload PDF');
    return res.json();
  },
};
