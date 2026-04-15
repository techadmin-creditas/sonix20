import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../components/Header';
import { api, DiyPersonaDraft, getVoiceWebSocketUrl } from '../lib/api';
import { cn } from '../lib/utils';
import { ArrowRight, Bot as BotIcon, Download, Loader2, Mic2, Pause, Play, Sparkles, Wand2, UserRound, Smile, Angry, Focus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

type StepId = 1 | 2 | 3 | 4;

type PersonaPreset = {
  key: string;
  title: string;
  tags: string[];
  default_language: 'hi' | 'en';
  persona: string;
  system_prompt: string;
  tts_provider?: string;
};

const PERSONA_PRESETS: PersonaPreset[] = [
  {
    key: 'female_hi_soft_focus',
    title: 'Female · Hindi · Soft · Focus',
    tags: ['female', 'hindi', 'soft', 'focused'],
    default_language: 'hi',
    persona: 'A calm, focused, soft-spoken female Hindi voice agent. Polite, efficient, and empathetic.',
    system_prompt:
      'You are a calm, focused female Hindi voice agent. Speak briefly and clearly. Ask one question at a time. Confirm key details. End with clear next steps.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'female_en_hard_direct',
    title: 'Female · English · Hard · Direct',
    tags: ['female', 'english', 'direct', 'firm'],
    default_language: 'en',
    persona: 'A firm, direct female English voice agent. No fluff; outcome-oriented.',
    system_prompt:
      'You are a firm, direct English voice agent. Be concise. Drive the conversation to a resolution with clear options. Avoid filler.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'male_hi_soft_empathy',
    title: 'Male · Hindi · Soft · Empathetic',
    tags: ['male', 'hindi', 'soft', 'empathetic'],
    default_language: 'hi',
    persona: 'An empathetic male Hindi voice agent. Patient, reassuring, and helpful.',
    system_prompt:
      'You are an empathetic male Hindi voice agent. Acknowledge feelings, reassure, then ask focused questions. Keep responses short.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'male_en_soft_support',
    title: 'Male · English · Soft · Support',
    tags: ['male', 'english', 'support', 'gentle'],
    default_language: 'en',
    persona: 'A gentle male English support agent. Friendly and helpful, with structured troubleshooting.',
    system_prompt:
      'You are a gentle English support agent. Ask clarifying questions, provide step-by-step guidance, confirm outcomes, and summarize next steps.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'female_hi_hard_collection',
    title: 'Female · Hindi · Hard · Collections',
    tags: ['female', 'hindi', 'firm', 'collections'],
    default_language: 'hi',
    persona: 'A firm female Hindi collections agent. Polite but assertive.',
    system_prompt:
      'You are a firm Hindi collections agent. Verify identity, state the issue clearly, offer payment options, handle objections briefly, and close with an action.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'female_en_soft_sales',
    title: 'Female · English · Soft · Sales',
    tags: ['female', 'english', 'sales', 'warm'],
    default_language: 'en',
    persona: 'A warm female English sales agent. Curious, confident, and persuasive.',
    system_prompt:
      'You are a warm English sales agent. Discover needs, highlight benefits, handle objections, and propose the next step. Keep it short and confident.',
    tts_provider: 'elevenlabs',
  },
];

const DIY_PERSONA_STORAGE_KEY = 'diy.persona.draft';

type TranscriptEntry = {
  role: 'user' | 'bot';
  content: string;
  atSec?: number;
};

type LatencyMetrics = {
  sttLatency: number | null;
  llmLatency: number | null;
  ttsLatency: number | null;
  totalRtt: number | null;
};

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function toEpochSeconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value > 1_000_000_000_000 ? value / 1000 : value;
}

function buildLatencyMetrics(meta: Record<string, unknown>): LatencyMetrics {
  const pick = (avgKey: string, legacyKey: string): number | null => {
    const v = (meta[avgKey] ?? meta[legacyKey]) as unknown;
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  return {
    sttLatency: pick('avg_stt_ms', 'stt_ms'),
    llmLatency: pick('avg_llm_ms', 'llm_ms'),
    ttsLatency: pick('avg_tts_ms', 'tts_ms'),
    totalRtt: pick('avg_total_ms', 'total_ms'),
  };
}

function demoPostCall(goalPrompt: string): { latency: LatencyMetrics; transcript: TranscriptEntry[] } {
  const base = (goalPrompt || '').trim() || 'Assist the user politely and efficiently.';
  return {
    latency: { sttLatency: 180, llmLatency: 920, ttsLatency: 260, totalRtt: 1360 },
    transcript: [
      { role: 'bot', content: 'Hi! I’m ready. How can I help today?' },
      { role: 'user', content: 'I need help understanding my pending payment.' },
      { role: 'bot', content: 'Sure. Is this for a bill, a subscription, or a one-time purchase?' },
      { role: 'user', content: 'It’s for my credit card bill.' },
      { role: 'bot', content: `Got it. ${base} Can you confirm the last 4 digits and the due date?` },
      { role: 'user', content: '1234, due on the 15th.' },
      { role: 'bot', content: 'Thanks. I can help you complete payment or set a reminder. Which do you prefer?' },
    ],
  };
}

export default function DiyWithAI() {
  const [step, setStep] = useState<StepId>(1);
  const [params] = useSearchParams();
  const [demoMode] = useState(true);
  const demoTimersRef = useRef<number[]>([]);

  // Step 1
  const [goalPrompt, setGoalPrompt] = useState('');

  // Step 2 (persona presets only)
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(null);
  const [customPersonaDraft, setCustomPersonaDraft] = useState<DiyPersonaDraft | null>(null);
  const selectedPreset = useMemo(
    () => PERSONA_PRESETS.find((p) => p.key === selectedPresetKey) ?? null,
    [selectedPresetKey],
  );

  // Live session (websocket only in v1)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Mic capture (simple ScriptProcessor for v1; SessionControl uses AudioWorklet but this is sufficient)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const liveSectionRef = useRef<HTMLDivElement | null>(null);

  const [liveTranscript, setLiveTranscript] = useState<TranscriptEntry[]>([]);

  // Step 3 (post-call)
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | undefined>(undefined);
  const [postTranscript, setPostTranscript] = useState<TranscriptEntry[]>([]);
  const [latency, setLatency] = useState<LatencyMetrics>({ sttLatency: null, llmLatency: null, ttsLatency: null, totalRtt: null });

  // Player
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCurrentSec, setPlaybackCurrentSec] = useState(0);
  const [playbackDurationSec, setPlaybackDurationSec] = useState(0);

  // Step 4 (recommendations)
  const [recLoading, setRecLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [presetCreatingKey, setPresetCreatingKey] = useState<string | null>(null);
  const [recommendationConsumed, setRecommendationConsumed] = useState(false);

  // Recommended config (used for the second run)
  const [recommendedConfig, setRecommendedConfig] = useState<{
    persona: string;
    system_prompt: string;
    llm_provider: string;
    llm_model: string;
  } | null>(null);

  const stopDemoTimers = () => {
    demoTimersRef.current.forEach((id) => window.clearTimeout(id));
    demoTimersRef.current = [];
  };

  useEffect(() => {
    // If we returned with ?bot_id from old flows, ignore in this scenario.
  }, []);

  // Ignore legacy query param usage for this scenario.
  useEffect(() => {
    void params;
  }, [params]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DIY_PERSONA_STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return;
      if (!obj.title || !obj.persona || !obj.system_prompt) return;
      setCustomPersonaDraft(obj as DiyPersonaDraft);
    } catch {
      // ignore
    }
  }, []);

  const buildSystemPromptForRun = (presetPrompt: string) => {
    const user = goalPrompt.trim();
    if (!user) return presetPrompt;
    return `${user}\n\n---\n${presetPrompt}`;
  };

  const createPresetBot = async (p: PersonaPreset, overrides?: Partial<{
    persona: string;
    system_prompt: string;
    llm_provider: string;
    llm_model: string;
    default_language: 'en' | 'hi';
    tts_provider?: string;
    voice_id?: string;
    name?: string;
    description?: string;
  }>) => {
    setApplyError(null);
    setPresetCreatingKey(p.key);
    try {
      const suffix = Math.random().toString(16).slice(2, 6);
      const name = overrides?.name ?? `DIY · ${p.title} · ${suffix}`;
      const persona = overrides?.persona ?? p.persona;
      const system_prompt = overrides?.system_prompt ?? buildSystemPromptForRun(p.system_prompt);
      const llm_provider = overrides?.llm_provider ?? 'gemini';
      const llm_model = overrides?.llm_model ?? 'gemini-2.0-flash-001';
      const default_language = overrides?.default_language ?? p.default_language;
      const tts_provider = overrides?.tts_provider ?? p.tts_provider;
      const voice_id = overrides?.voice_id;
      const res = await api.createBot({
        name,
        description: overrides?.description ?? 'Created from DIY With AI persona preset.',
        role: 'Voice Agent',
        persona,
        system_prompt,
        llm_provider,
        llm_model,
        tts_provider,
        voice_id,
        default_language,
        tools_enabled: ['search_knowledge', 'book_appointment', 'get_appointments', 'remember_user_fact'],
        temperature: 0.7,
        max_tokens: 2048,
        is_active: true,
      });
      const id = res?.id || res?.bot?.id;
      if (!id) throw new Error('Bot create did not return id');
      return String(id);
    } catch (e: any) {
      setApplyError(e?.message || 'Failed to create persona preset.');
      return null;
    } finally {
      setPresetCreatingKey(null);
    }
  };

  const cleanupAudio = () => {
    try {
      if (procRef.current) procRef.current.disconnect();
    } catch { }
    procRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => { });
      audioCtxRef.current = null;
    }
  };

  const runDemoLiveSession = () => {
    stopDemoTimers();
    setApplyError(null);
    setIsConnecting(true);
    setIsLive(false);
    setLiveTranscript([]);
    setSessionId(`demo-${Date.now()}`);
    setActiveBotId('demo');

    demoTimersRef.current.push(
      window.setTimeout(() => {
        setIsConnecting(false);
        setIsLive(true);
        try {
          liveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          // ignore
        }
      }, 600),
    );

    const scripted: TranscriptEntry[] = [
      { role: 'bot', content: 'Hi! This is a demo live call. How can I help?' },
      { role: 'user', content: 'I want to understand my pending payment.' },
      { role: 'bot', content: 'Got it. Is this about a bill, a subscription, or a one-time purchase?' },
      { role: 'user', content: 'It’s for my credit card bill.' },
      { role: 'bot', content: 'Thanks. Please confirm the last 4 digits and due date.' },
      { role: 'user', content: '1234, due on the 15th.' },
      { role: 'bot', content: 'Great. I can help you pay now or set a reminder. Which one?' },
    ];

    scripted.forEach((entry, i) => {
      demoTimersRef.current.push(
        window.setTimeout(() => setLiveTranscript((prev) => [...prev, entry]), 1200 + i * 900),
      );
    });

    demoTimersRef.current.push(
      window.setTimeout(() => {
        setIsLive(false);
        cleanupAudio();
        setStep(3);
      }, 1200 + scripted.length * 900 + 800),
    );
  };

  const startMic = async (ws: WebSocket) => {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextCtor({ sampleRate: 16000 });
    audioCtxRef.current = ctx;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    procRef.current = proc;

    src.connect(proc);
    proc.connect(ctx.destination);

    proc.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i += 1) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      ws.send(pcm16.buffer);
    };
  };

  const endSession = () => {
    stopDemoTimers();
    try {
      wsRef.current?.close();
    } catch { }
    wsRef.current = null;
    cleanupAudio();
    setIsLive(false);
  };

  const startSession = async () => {
    if (demoMode) {
      runDemoLiveSession();
      return;
    }
    if ((!selectedPresetKey && !recommendedConfig) || (selectedPresetKey === 'custom' && !customPersonaDraft && !recommendedConfig)) return;
    setApplyError(null);
    setIsConnecting(true);
    setLiveTranscript([]);
    setSessionId(null);
    setActiveBotId(null);
    setRecommendations(null);

    try {
      // Create a fresh bot for each run (do not use existing project bots).
      let botId: string | null = null;
      const base = selectedPreset ?? PERSONA_PRESETS[0];
      if (recommendedConfig) {
        // Second run uses the recommended config (no further recommendations).
        botId = await createPresetBot(base, {
          persona: recommendedConfig.persona,
          system_prompt: recommendedConfig.system_prompt,
          llm_provider: recommendedConfig.llm_provider,
          llm_model: recommendedConfig.llm_model,
        });
      } else if (selectedPresetKey === 'custom' && customPersonaDraft) {
        botId = await createPresetBot(base, {
          name: `DIY · ${customPersonaDraft.title}`,
          description: 'Created from DIY Persona Builder.',
          persona: customPersonaDraft.persona,
          system_prompt: buildSystemPromptForRun(customPersonaDraft.system_prompt),
          default_language: customPersonaDraft.default_language,
          tts_provider: customPersonaDraft.tts_provider,
          voice_id: customPersonaDraft.voice_id,
        });
      } else {
        botId = await createPresetBot(selectedPreset!);
      }
      if (!botId) throw new Error('Failed to create run persona.');

      const created = await api.createSession(botId, 'websocket');
      setSessionId(created.session_id);
      setActiveBotId(botId);
      const wsUrl = created.websocket_url.startsWith('ws')
        ? created.websocket_url
        : getVoiceWebSocketUrl(created.websocket_url);

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsConnecting(false);
        setIsLive(true);
        try {
          await startMic(ws);
        } catch {
          setApplyError('Microphone permission blocked. Please allow mic access and try again.');
        }
        try {
          liveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
          // ignore
        }
      };

      ws.onmessage = (evt) => {
        if (typeof evt.data !== 'string') return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'transcript' || msg.type === 'bot_transcript') {
            const role: TranscriptEntry['role'] = msg.type === 'transcript' ? 'user' : 'bot';
            const text = String(msg.text || '').trim();
            if (!text) return;
            setLiveTranscript((prev) => [...prev, { role, content: text }]);
          }
          if (msg.type === 'session_ended') {
            setIsLive(false);
            cleanupAudio();
            setStep(3);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setApplyError('Live session connection error. Please retry.');
      };

      ws.onclose = (evt) => {
        setIsLive(false);
        setIsConnecting(false);
        cleanupAudio();
        if (step === 2) {
          const reason = (evt as any)?.reason ? String((evt as any).reason) : '';
          const code = (evt as any)?.code ? String((evt as any).code) : '';
          const extra = [code && `code=${code}`, reason && `reason=${reason}`].filter(Boolean).join(' ');
          setApplyError(`Call ended automatically. ${extra}`.trim());
        }
      };
    } catch (e: any) {
      setIsConnecting(false);
      setIsLive(false);
      cleanupAudio();
      setApplyError(e?.message || 'Failed to start session.');
    }
  };

  const loadPostCall = async () => {
    if (demoMode) {
      const demo = demoPostCall(goalPrompt);
      setRecordingUrl(undefined);
      setLatency(demo.latency);
      setPostTranscript(demo.transcript);
      return;
    }
    if (!sessionId) {
      const demo = demoPostCall(goalPrompt);
      setRecordingUrl(undefined);
      setLatency(demo.latency);
      setPostTranscript(demo.transcript);
      return;
    }
    setDetailsLoading(true);
    try {
      const [d, t] = await Promise.all([
        api.getSessionDetails(sessionId),
        api.getSessionTranscript(sessionId),
      ]);
      const meta = (d as any).metadata || {};
      setRecordingUrl((meta.recording_url as string | undefined) || undefined);
      setLatency(buildLatencyMetrics(meta));
      setPostTranscript(
        (t || []).map((m: any) => {
          const atSec = toEpochSeconds(m.timestamp);
          return {
            role: m.role === 'assistant' ? 'bot' : 'user',
            content: String(m.content || ''),
            atSec,
          } as TranscriptEntry;
        }),
      );
    } catch (e: any) {
      // Demo fallback so the UX can still be explored even if providers are down / tokens exhausted.
      const demo = demoPostCall(goalPrompt);
      setRecordingUrl(undefined);
      setLatency(demo.latency);
      setPostTranscript(demo.transcript);
      setApplyError(e?.message ? `Post-call demo data shown. (${e.message})` : 'Post-call demo data shown.');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3) void loadPostCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, sessionId]);

  const generateRecommendations = async () => {
    if (demoMode) {
      const basePrompt = (goalPrompt || '').trim() || 'Be concise, ask one question at a time, end with next steps.';
      setRecommendations({
        recommended_prompt: basePrompt,
        recommended_persona: selectedPreset?.persona || customPersonaDraft?.persona || 'A helpful, confident voice agent.',
        recommended_llm_provider: 'gemini',
        recommended_llm_model: 'gemini-2.0-flash-001',
        why: [
          'Tighten questions to reduce user confusion',
          'Confirm key details before proposing actions',
          'End each call with a clear next step',
        ],
      });
      setStep(4);
      return;
    }
    if (!sessionId || recommendationConsumed) return;
    setRecLoading(true);
    try {
      const res = await api.recommendSession(sessionId, { goal: goalPrompt.trim() });
      setRecommendations(res.recommendations);
      setStep(4);
    } catch (e: any) {
      setApplyError(e?.message || 'Failed to generate recommendations.');
    } finally {
      setRecLoading(false);
    }
  };

  const applyRecommendation = async () => {
    if (!recommendations) return;
    setApplyError(null);
    setApplyLoading(true);
    try {
      // Apply locally: update prompt & the next-run config. Second run should not show recommendations.
      setGoalPrompt(recommendations.recommended_prompt);
      setRecommendedConfig({
        persona: recommendations.recommended_persona,
        system_prompt: recommendations.recommended_prompt,
        llm_provider: recommendations.recommended_llm_provider,
        llm_model: recommendations.recommended_llm_model,
      });
      setRecommendationConsumed(true);
      setStep(2);
    } catch (e: any) {
      setApplyError(e?.message || 'Failed to apply recommendation.');
    } finally {
      setApplyLoading(false);
    }
  };

  const togglePlayback = () => {
    if (!audioElRef.current || !recordingUrl) return;
    if (isPlaying) audioElRef.current.pause();
    else void audioElRef.current.play();
  };

  const exportRecording = () => {
    if (!recordingUrl || !sessionId) return;
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `session-${sessionId}-recording.wav`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="DIY With AI"
        subtitle="Build a flow, run a call, then improve with recommendations."
        actions={
          <div className="flex items-center gap-2">
            {step >= 3 && recordingUrl && (
              <button
                onClick={exportRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-low ghost-border text-xs font-bold hover:bg-surface-high transition-all"
              >
                <Download className="size-4" />
                Download recording
              </button>
            )}
          </div>
        }
      />

      <div className="p-6 lg:p-10 w-full">
        {/* Step 1 */}
        {step === 1 && (
          <div className="mx-auto w-full max-w-4xl bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                <Sparkles className="size-4 text-primary" />
                DIY With AI
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Step 1/4</span>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 p-5">
              <p className="text-sm font-bold">Add prompt</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Describe goal, constraints, and how the agent should behave.
              </p>
              <textarea
                value={goalPrompt}
                onChange={(e) => setGoalPrompt(e.target.value)}
                placeholder="Example: You are a bank collections agent. Be polite, concise, verify intent, propose payment options, and end with clear next steps."
                className="mt-4 w-full min-h-[200px] rounded-xl border border-outline-variant/15 bg-surface-highest p-3 text-sm outline-none focus:border-primary/40"
              />
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-xl ember-gradient px-6 py-3 text-xs font-bold text-on-primary-fixed"
                >
                  Next
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="mx-auto w-full max-w-6xl flex flex-col gap-6">
            {(isLive || isConnecting) && (
              <div className="bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                    <Sparkles className="size-4 text-primary" />
                    Live session
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-outline">
                    {isConnecting ? 'Connecting…' : 'Live'}
                  </span>
                </div>

                {applyError && (
                  <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                    {applyError}
                  </div>
                )}

                <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/40 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                      <Mic2 className="size-4 text-primary" />
                      Speak now
                    </div>
                    <button
                      onClick={endSession}
                      disabled={!isLive}
                      className={cn(
                        'rounded-xl border border-outline-variant/20 bg-surface-highest px-6 py-3 text-xs font-bold',
                        !isLive && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      End
                    </button>
                  </div>

                  {sessionId && <p className="mt-3 text-[10px] text-outline font-mono">session_id: {sessionId}</p>}
                </div>
              </div>
            )}

            {(isLive || isConnecting) ? (
              <div ref={liveSectionRef} className="bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-outline">Live transcript</p>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{isLive ? 'Live' : 'Standby'}</span>
                </div>
                <div className="min-h-[520px] rounded-2xl border border-outline-variant/15 bg-surface-high/50 p-4 overflow-y-auto space-y-3">
                  {liveTranscript.length === 0 ? (
                    <div className="h-full min-h-[420px] flex items-center justify-center text-xs text-outline">
                      {isConnecting ? 'Connecting…' : 'Start speaking to see the transcript.'}
                    </div>
                  ) : (
                    liveTranscript.slice(-80).map((t, idx) => (
                      <div key={idx} className={cn('max-w-[85%]', t.role === 'bot' ? 'mr-auto' : 'ml-auto')}>
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 text-sm',
                            t.role === 'bot'
                              ? 'bg-surface-high border border-outline-variant/10'
                              : 'bg-primary text-on-primary-fixed',
                          )}
                        >
                          {t.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                    <Sparkles className="size-4 text-primary" />
                    DIY With AI
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Step 2/4</span>
                </div>

                <div className="rounded-2xl border border-outline-variant/15 p-5">
                  <p className="text-sm font-bold">{isLive || isConnecting ? 'Live session' : 'Select persona + start'}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {isLive || isConnecting ? 'Speak normally. Your transcript will appear below.' : 'Pick a persona and start a live session.'}
                  </p>

                  {!isLive && !isConnecting && (
                    <>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Quick picks</p>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {customPersonaDraft && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPresetKey('custom');
                              setRecommendedConfig(null);
                            }}
                            className={cn(
                              'text-left rounded-2xl border border-outline-variant/15 bg-surface-highest/60 p-4 hover:bg-surface-highest transition-all',
                              selectedPresetKey === 'custom' && 'ring-2 ring-primary/50 border-primary/30',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-extrabold">{customPersonaDraft.title}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(customPersonaDraft.tags || []).slice(0, 8).map((t) => (
                                    <span
                                      key={t}
                                      className="rounded-full border border-outline-variant/20 bg-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-outline"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <TileAvatar label={customPersonaDraft.title} tags={customPersonaDraft.tags} />
                            </div>
                            <p className="mt-3 text-xs text-on-surface-variant leading-relaxed line-clamp-3">{customPersonaDraft.persona}</p>
                          </button>
                        )}
                        {PERSONA_PRESETS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                              setSelectedPresetKey(p.key);
                              setRecommendedConfig(null);
                            }}
                            className={cn(
                              'text-left rounded-2xl border border-outline-variant/15 bg-surface-highest/60 p-4 hover:bg-surface-highest transition-all',
                              selectedPresetKey === p.key && 'ring-2 ring-primary/50 border-primary/30',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-extrabold">{p.title}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {p.tags.map((t) => (
                                    <span
                                      key={t}
                                      className="rounded-full border border-outline-variant/20 bg-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-outline"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <TileAvatar label={p.title} tags={p.tags} active={selectedPresetKey === p.key} />
                            </div>
                            <p className="mt-3 text-xs text-on-surface-variant leading-relaxed line-clamp-3">{p.persona}</p>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {applyError && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                      {applyError}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      onClick={startSession}
                      disabled={(!selectedPresetKey && !recommendedConfig) || isConnecting || isLive || (selectedPresetKey === 'custom' && !customPersonaDraft)}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-xl ember-gradient px-6 py-3 text-xs font-bold text-on-primary-fixed',
                        ((!selectedPresetKey && !recommendedConfig) || isConnecting || isLive || (selectedPresetKey === 'custom' && !customPersonaDraft)) && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      {isConnecting ? <Loader2 className="size-4 animate-spin" /> : <Mic2 className="size-4" />}
                      {isLive ? 'Live…' : 'Start session'}
                    </button>
                    <button
                      onClick={endSession}
                      disabled={!isLive}
                      className={cn(
                        'rounded-xl border border-outline-variant/20 bg-surface-highest px-6 py-3 text-xs font-bold',
                        !isLive && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      End
                    </button>
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-xl border border-outline-variant/20 bg-surface-highest px-6 py-3 text-xs font-bold"
                    >
                      Back
                    </button>
                  </div>

                  {sessionId && <p className="mt-3 text-[10px] text-outline font-mono">session_id: {sessionId}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="mx-auto w-full max-w-6xl bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                <Sparkles className="size-4 text-primary" />
                DIY With AI
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Step 3/4</span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/50 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Session recording</p>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-outline">
                    <span>STT {latency.sttLatency ?? '--'}ms</span>
                    <span>LLM {latency.llmLatency ?? '--'}ms</span>
                    <span>TTS {latency.ttsLatency ?? '--'}ms</span>
                    <span>Total {latency.totalRtt ?? '--'}ms</span>
                  </div>
                </div>
                {!recordingUrl ? (
                  <div className="mt-4 text-xs text-outline">Recording unavailable.</div>
                ) : (
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={togglePlayback}
                      className="size-12 rounded-full ember-gradient flex items-center justify-center text-on-primary-fixed"
                    >
                      {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 fill-current" />}
                    </button>
                    <div className="flex-1">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(playbackDurationSec, 0)}
                        step={0.1}
                        value={Math.min(playbackCurrentSec, playbackDurationSec || 0)}
                        onChange={(e) => {
                          const nextSec = Number(e.target.value);
                          if (!audioElRef.current || !Number.isFinite(nextSec)) return;
                          audioElRef.current.currentTime = nextSec;
                          setPlaybackCurrentSec(nextSec);
                        }}
                        className="w-full accent-primary cursor-pointer"
                        aria-label="Seek recording"
                      />
                      <div className="mt-1 flex justify-between text-[10px] font-bold text-outline uppercase tracking-widest">
                        <span>{formatPlaybackTime(playbackCurrentSec)}</span>
                        <span>{formatPlaybackTime(playbackDurationSec)}</span>
                      </div>
                    </div>
                    <audio
                      ref={audioElRef}
                      src={recordingUrl}
                      preload="none"
                      onLoadedMetadata={(e) => {
                        const dur = e.currentTarget.duration;
                        setPlaybackDurationSec(Number.isFinite(dur) ? dur : 0);
                      }}
                      onTimeUpdate={(e) => setPlaybackCurrentSec(e.currentTarget.currentTime || 0)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/50 p-5 flex flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Transcript</p>
                  <button
                    onClick={loadPostCall}
                    disabled={detailsLoading}
                    className="text-xs font-bold text-primary hover:opacity-90"
                  >
                    {detailsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
                <div className="mt-4 flex-1 min-h-[420px] rounded-2xl border border-outline-variant/10 bg-surface p-4 overflow-y-auto space-y-3">
                  {postTranscript.length === 0 ? (
                    <div className="h-full min-h-[320px] flex items-center justify-center text-xs text-outline">
                      {detailsLoading ? 'Loading transcript…' : 'Transcript unavailable.'}
                    </div>
                  ) : (
                    postTranscript.map((t, idx) => (
                      <div key={idx} className={cn('max-w-[85%]', t.role === 'bot' ? 'mr-auto' : 'ml-auto')}>
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 text-sm',
                            t.role === 'bot'
                              ? 'bg-surface-high border border-outline-variant/10'
                              : 'bg-primary text-on-primary-fixed',
                          )}
                        >
                          {t.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <button
                onClick={() => setStep(2)}
                className="rounded-xl border border-outline-variant/20 bg-surface-highest px-6 py-3 text-xs font-bold"
              >
                Back
              </button>
              <button
                onClick={generateRecommendations}
                disabled={!sessionId || recLoading || recommendationConsumed}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl ember-gradient px-6 py-3 text-xs font-bold text-on-primary-fixed',
                  (!sessionId || recLoading || recommendationConsumed) && 'opacity-60 cursor-not-allowed',
                )}
              >
                {recLoading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {recommendationConsumed ? 'Recommendations disabled (2nd run)' : 'Generate recommendations'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="mx-auto w-full max-w-4xl bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                <Sparkles className="size-4 text-primary" />
                DIY With AI
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Step 4/4</span>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/50 p-6">
              <p className="text-sm font-bold">AI recommended</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Apply an improved prompt/persona/LLM for your next run. After applying, recommendations will be disabled.
              </p>
              {!recommendations ? (
                <div className="mt-6 text-xs text-outline">No recommendations loaded.</div>
              ) : (
                <>
                  <div className="mt-6 space-y-3 text-sm">
                    <div className="rounded-xl border border-outline-variant/15 bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-widest text-outline font-bold">LLM</p>
                      <p className="mt-1 font-semibold">
                        {recommendations.recommended_llm_provider} / {recommendations.recommended_llm_model}
                      </p>
                    </div>
                    <div className="rounded-xl border border-outline-variant/15 bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Persona</p>
                      <p className="mt-1 text-sm text-on-surface-variant">{recommendations.recommended_persona}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant/15 bg-surface p-4">
                      <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Why</p>
                      <ul className="mt-2 list-disc pl-5 text-sm text-on-surface-variant space-y-1">
                        {(recommendations.why || []).map((w: string) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {applyError && (
                    <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                      {applyError}
                    </div>
                  )}

                  <div className="mt-6 flex justify-between gap-3">
                    <button
                      onClick={() => setStep(3)}
                      className="rounded-xl border border-outline-variant/20 bg-surface-highest px-6 py-3 text-xs font-bold"
                    >
                      Back
                    </button>
                    <button
                      onClick={applyRecommendation}
                      disabled={applyLoading}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl ember-gradient px-6 py-3 text-xs font-bold text-on-primary-fixed',
                        applyLoading && 'opacity-70 cursor-not-allowed',
                      )}
                    >
                      {applyLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                      Apply & go to Step 2
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TileAvatar({
  label,
  tags,
  active,
}: {
  label: string;
  tags: string[];
  active?: boolean;
}) {
  const text = `${label} ${(tags || []).join(' ')}`.toLowerCase();
  const isFemale = /\bfemale\b/.test(text);
  const isMale = /\bmale\b/.test(text);
  const style: 'soft' | 'firm' | 'focus' =
    /focus|focused/.test(text) ? 'focus' : /firm|direct|hard|collections/.test(text) ? 'firm' : 'soft';

  const AccentIcon = style === 'firm' ? Angry : style === 'focus' ? Focus : Smile;
  const badge = isFemale ? 'F' : isMale ? 'M' : 'AI';

  return (
    <div className={cn("relative size-9 rounded-xl border border-outline-variant/15 bg-primary/10 flex items-center justify-center text-primary shrink-0", active && "border-primary/30")}>
      <UserRound className="size-4" />
      <div className="absolute -bottom-1 -right-1 rounded-full border border-outline-variant/20 bg-surface-highest px-1.5 py-0.5 flex items-center gap-1">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-on-surface">{badge}</span>
        <AccentIcon className="size-3 text-primary" />
      </div>
    </div>
  );
}

