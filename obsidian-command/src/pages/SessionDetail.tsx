import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { api, UserFact } from '../lib/api';
import { cn } from '../lib/utils';
import {
  ArrowLeft, Play, Pause, Download,
  MessageSquare, BarChart3, FileText, Lightbulb,
  Clock, Timer, Zap, ShieldCheck, Cpu,
  User, Bot, Calendar, Smile, Loader2, Tags,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'bg-emerald-400',
  neutral: 'bg-yellow-400',
  negative: 'bg-red-400',
};

/** Stored when no LLM summary exists yet — triggers bind to bot LLM via POST /summarize */
const SUMMARY_PLACEHOLDERS = new Set([
  'No summary generated for this session.',
  'No meaningful conversation occurred.',
]);

function needsGeneratedSummary(summary: string | undefined): boolean {
  const t = (summary ?? '').trim();
  return !t || SUMMARY_PLACEHOLDERS.has(t);
}

function normalizeInsights(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0
  );
}

/** UI label for user_facts.category (hides internal session_extracted.* prefix). */
function formatEntityCategory(category: string | undefined): string {
  if (!category) return '';
  if (category.startsWith('session_extracted.')) {
    return category.slice('session_extracted.'.length);
  }
  return category;
}

type LatencyMetrics = {
  sttLatency: number | null;
  llmLatency: number | null;
  ttsLatency: number | null;
  totalRtt: number | null;
  metricsSampleCount: number;
};

/** Maps API session metadata (including tool_logs aggregates from GET /sessions/:id) to UI metrics. */
function buildLatencyMetrics(meta: Record<string, unknown>): LatencyMetrics {
  const countRaw = meta.metrics_turn_count;
  const count = typeof countRaw === 'number' ? countRaw : null;

  if (count === 0) {
    return {
      sttLatency: null,
      llmLatency: null,
      ttsLatency: null,
      totalRtt: null,
      metricsSampleCount: 0,
    };
  }

  const pick = (avgKey: string, legacyKey: string): number | null => {
    const v = (meta[avgKey] ?? meta[legacyKey]) as unknown;
    if (v == null || v === '') return null;
    return Math.round(Number(v));
  };

  if (count !== null && count > 0) {
    return {
      sttLatency: pick('avg_stt_ms', 'stt_ms'),
      llmLatency: pick('avg_llm_ms', 'llm_ms'),
      ttsLatency: pick('avg_tts_ms', 'tts_ms'),
      totalRtt: pick('avg_total_ms', 'total_ms'),
      metricsSampleCount: count,
    };
  }

  const stt = pick('avg_stt_ms', 'stt_ms');
  const llm = pick('avg_llm_ms', 'llm_ms');
  const tts = pick('avg_tts_ms', 'tts_ms');
  const total = pick('avg_total_ms', 'total_ms');
  const any = [stt, llm, tts, total].some((x) => x != null);
  if (!any) {
    return {
      sttLatency: null,
      llmLatency: null,
      ttsLatency: null,
      totalRtt: null,
      metricsSampleCount: 0,
    };
  }
  return {
    sttLatency: stt,
    llmLatency: llm,
    ttsLatency: tts,
    totalRtt: total,
    metricsSampleCount: 0,
  };
}

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [facts, setFacts] = useState<UserFact[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'insights' | 'stats' | 'entities'>('transcript');
  const [sessionAnalysisBinding, setSessionAnalysisBinding] = useState(false);
  const routeSessionIdRef = useRef<string | undefined>(undefined);
  routeSessionIdRef.current = id;

  useEffect(() => {
    let cancelled = false;
    const routeId = id;
    if (!routeId) return;

    setLoading(true);
    setSession(null);

    async function loadData() {
      let details: Awaited<ReturnType<typeof api.getSessionDetails>> | null = null;
      try {
        const [d, transcript, factsData] = await Promise.all([
          api.getSessionDetails(routeId),
          api.getSessionTranscript(routeId),
          api.getSessionFacts(routeId).catch(() => [] as UserFact[]),
        ]);
        if (
          cancelled ||
          routeSessionIdRef.current !== routeId ||
          d.id !== routeId
        ) {
          return;
        }
        details = d;

        setFacts(factsData);

        const meta = details.metadata || {};
        const metrics = buildLatencyMetrics(meta);
        const sentimentScore = meta.sentiment_score ?? null;

        const stData = {
          id: details.id,
          user_id: details.user_id,
          bot: details.bot_name || 'System',
          date: new Date(details.started_at * 1000).toLocaleDateString(),
          time: new Date(details.started_at * 1000).toLocaleTimeString(),
          duration: details.ended_at ? `${Math.round(details.ended_at - details.started_at)}s` : 'Active',
          transcript: transcript.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'bot' : msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sentiment: (msg.metadata as any)?.sentiment as string | undefined,
          })),
          summary: meta.summary || 'No summary generated for this session.',
          intent: meta.intent || 'Unknown Intent',
          insights: normalizeInsights(meta.insights),
          turns: details.turn_count || 0,
          sentimentScore,
          metrics,
        };
        setSession(stData);
      } catch (e) {
        console.error("Failed to load session details", e);
        details = null;
        if (routeSessionIdRef.current === routeId) {
          setSession(null);
        }
      } finally {
        if (!cancelled && routeSessionIdRef.current === routeId) {
          setLoading(false);
        }
      }

      if (cancelled || !details || routeSessionIdRef.current !== routeId) return;

      const metaAfter = details.metadata || {};
      const hasLlmAnalysis = typeof metaAfter.llm_analysis_at === 'number';
      const needSummary = needsGeneratedSummary(metaAfter.summary as string | undefined);
      const nlpVersion =
        typeof metaAfter.session_nlp_version === 'number'
          ? metaAfter.session_nlp_version
          : 0;
      const shouldRunSessionNlp =
        (details.turn_count || 0) > 1 &&
        (!hasLlmAnalysis || needSummary || nlpVersion < 2);

      if (shouldRunSessionNlp) {
        setSessionAnalysisBinding(true);
        try {
          const out = await api.summarizeSession(routeId);
          if (
            !cancelled &&
            routeSessionIdRef.current === routeId
          ) {
            setSession((prev) =>
              prev && prev.id === routeId
                ? {
                    ...prev,
                    summary: out.summary,
                    intent: out.intent || prev.intent,
                    insights: normalizeInsights(out.insights),
                  }
                : prev
            );
            try {
              const refreshedFacts = await api.getSessionFacts(routeId);
              if (!cancelled && routeSessionIdRef.current === routeId) {
                setFacts(refreshedFacts);
              }
            } catch {
              /* ignore */
            }
          }
        } catch (e) {
          console.error('Failed to generate session analysis with bot LLM', e);
        } finally {
          if (!cancelled && routeSessionIdRef.current === routeId) {
            setSessionAnalysisBinding(false);
          }
        }
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Live refresh Latency & Performance while the session is still active and the stats tab is open.
  useEffect(() => {
    if (!id || activeTab !== 'stats') return;
    const isActive = session?.duration === 'Active';
    if (!isActive) return;

    const tick = async () => {
      try {
        const details = await api.getSessionDetails(id);
        const meta = details.metadata || {};
        const metrics = buildLatencyMetrics(meta);
        setSession((prev: Record<string, unknown> | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            duration: details.ended_at
              ? `${Math.round(details.ended_at - details.started_at)}s`
              : 'Active',
            turns: details.turn_count ?? (prev.turns as number),
            metrics,
            sentimentScore: meta.sentiment_score ?? (prev.sentimentScore as number | null),
          };
        });
      } catch {
        /* ignore */
      }
    };

    const t = window.setInterval(tick, 4000);
    void tick();
    return () => window.clearInterval(t);
  }, [id, activeTab, session?.duration]);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(session, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.id}-log.json`;
    a.click();
  };

  const handleEscalate = () => {
    if (confirm('Are you sure you want to escalate this session to a human agent?')) {
      alert('Session escalated. A team member will be notified.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col ">
        <Header title="Loading Session..." subtitle="Please wait" />
        <div className="flex items-center justify-center p-20 flex-col gap-4">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-outline text-xs font-bold uppercase tracking-widest">Accessing Detail Records...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col ">
        <Header title="404" subtitle="Session not found" />
        <div className="p-8">Session not found.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col ">
      <Header
        title={`Session ${session.id}`}
        subtitle={`Conversation with ${session.bot}`}
        actions={
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/sessions')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-low ghost-border text-xs font-bold hover:bg-surface-high transition-all"
            >
              <ArrowLeft className="size-4" />
              Back to List
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl ember-gradient text-on-primary-fixed text-xs font-bold shadow-lg active:scale-95 transition-all"
            >
              <Download className="size-4" />
              Export Log
            </button>
          </div>
        }
      />

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recording & Main Content */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Recording Player */}
          <div className="bg-surface-low p-8 rounded-3xl ghost-border flex flex-col gap-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Play className="size-6" />
                </div>
                <div>
                  <h4 className="font-headline font-bold text-lg">Session Recording</h4>
                  <p className="text-outline text-sm">Recorded on {session.date} · {session.duration}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="p-2 rounded-xl bg-surface-highest text-outline hover:text-primary transition-colors"
                >
                  <Download className="size-5" />
                </button>
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-6 bg-surface-high/50 p-6 rounded-2xl">
              <button
                onClick={togglePlayback}
                className="size-14 rounded-full ember-gradient flex items-center justify-center text-on-primary-fixed shadow-xl shadow-primary/20 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="size-6" /> : <Play className="size-6 fill-current" />}
              </button>
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-1.5 bg-surface-highest rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 bg-primary/20 animate-pulse"></div>
                  <div className="h-full bg-primary w-1/3 relative z-10"></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-outline uppercase tracking-widest">
                  <span>01:22</span>
                  <span>{session.duration}</span>
                </div>
              </div>
              <audio ref={audioRef} src={session.recordingUrl} onEnded={() => setIsPlaying(false)} />
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex gap-2 p-1.5 bg-surface-low rounded-2xl ghost-border w-fit flex-wrap">
            {[
              { id: 'transcript', label: 'Transcript', icon: MessageSquare },
              { id: 'summary', label: 'Summary', icon: FileText },
              { id: 'insights', label: 'Insights', icon: Lightbulb },
              { id: 'entities', label: `Entities${facts.length > 0 ? ` (${facts.length})` : ''}`, icon: Tags },
              { id: 'stats', label: 'Stats', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-on-primary-fixed shadow-lg shadow-primary/20"
                    : "text-outline hover:bg-surface-highest"
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-surface-low rounded-3xl ghost-border min-h-[500px] relative overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'transcript' && (
                <motion.div
                  key="transcript"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-8 flex flex-col gap-8"
                >
                  {session.transcript.map((msg: any, i: number) => (
                    <div key={i} className={cn(
                      "flex gap-4 max-w-[80%]",
                      msg.role === 'bot' ? "self-start" : "self-end flex-row-reverse"
                    )}>
                      <div className={cn(
                        "size-10 rounded-xl flex items-center justify-center shrink-0",
                        msg.role === 'bot' ? "bg-primary/10 text-primary" : "bg-surface-highest text-outline"
                      )}>
                        {msg.role === 'bot' ? <Bot className="size-5" /> : <User className="size-5" />}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className={cn(
                          "p-4 rounded-2xl text-sm leading-relaxed",
                          msg.role === 'bot' ? "bg-surface-high border border-outline-variant/10" : "bg-primary text-on-primary-fixed font-medium"
                        )}>
                          {msg.content}
                        </div>
                        <div className={cn("flex items-center gap-2 px-1", msg.role === 'user' && "flex-row-reverse")}>
                          <span className="text-[10px] font-bold text-outline uppercase tracking-widest">
                            {msg.timestamp}
                          </span>
                          {msg.sentiment && (
                            <div
                              className={cn("size-1.5 rounded-full", SENTIMENT_COLOR[msg.sentiment] ?? 'bg-outline')}
                              title={`Sentiment: ${msg.sentiment}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-10 flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-primary">
                      <FileText className="size-6" />
                      <h4 className="font-headline font-bold text-xl">Conversation Summary</h4>
                      {sessionAnalysisBinding && (
                        <Loader2 className="size-5 text-primary animate-spin ml-1" aria-hidden />
                      )}
                    </div>
                    <p className="text-outline text-xs font-medium max-w-xl">
                      Summary and intent are produced with the same LLM provider and model configured for &quot;{session.bot}&quot;.
                    </p>
                  </div>
                  <div className="p-8 rounded-2xl bg-surface-high/50 border border-outline-variant/10 text-on-surface-variant leading-loose text-lg font-medium italic">
                    "{session.summary}"
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-6 rounded-2xl bg-surface-low ghost-border">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">Primary Intent</p>
                      <p className="text-lg font-bold text-primary">{session.intent}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-surface-low ghost-border">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">Resolution Status</p>
                      <p className="text-lg font-bold text-emerald-500">Completed</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'insights' && (
                <motion.div
                  key="insights"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-10 flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-primary">
                      <Lightbulb className="size-6" />
                      <h4 className="font-headline font-bold text-xl">AI-Generated Insights</h4>
                      {sessionAnalysisBinding && (
                        <Loader2 className="size-5 text-primary animate-spin ml-1" aria-hidden />
                      )}
                    </div>
                    <p className="text-outline text-xs font-medium max-w-xl">
                      Generated with the same LLM as &quot;{session.bot}&quot; (one pass after summary and intent).
                    </p>
                  </div>
                  {session.insights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 opacity-40">
                      <Lightbulb className="size-10 text-outline mb-4" />
                      <p className="text-sm font-medium text-center max-w-sm">
                        {sessionAnalysisBinding
                          ? 'Generating insights…'
                          : 'No insights yet. Open a session with at least two transcript turns.'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {session.insights.map((insight: string, i: number) => (
                        <div key={i} className="flex gap-4 p-6 rounded-2xl bg-surface-high/50 border border-outline-variant/10 group hover:border-primary/30 transition-all">
                          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-on-primary-fixed transition-colors">
                            <Zap className="size-5" />
                          </div>
                          <p className="text-on-surface-variant font-medium leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'entities' && (
                <motion.div
                  key="entities"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-10 flex flex-col gap-6"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-primary">
                      <Tags className="size-6" />
                      <h4 className="font-headline font-bold text-xl">Extracted Entities</h4>
                      {sessionAnalysisBinding && (
                        <Loader2 className="size-5 text-primary animate-spin ml-1" aria-hidden />
                      )}
                    </div>
                    <p className="text-outline text-xs font-medium max-w-xl">
                      Includes facts from the live <code className="text-primary/80">remember_user_fact</code> tool plus entities inferred from the transcript with the same LLM as &quot;{session.bot}&quot; (saved when you open this page or after a call ends).
                    </p>
                  </div>
                  {facts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 opacity-40">
                      <Tags className="size-10 text-outline mb-4" />
                      <p className="text-sm font-medium text-center max-w-sm">
                        {sessionAnalysisBinding
                          ? 'Extracting entities…'
                          : 'No entities for this session yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {facts.map((fact) => (
                        <div key={fact.id} className="p-5 rounded-2xl bg-surface-high/50 border border-outline-variant/10 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            {fact.category && (
                              <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {formatEntityCategory(fact.category)}
                              </span>
                            )}
                            <span className="text-[9px] text-outline font-mono ml-auto">
                              {new Date(fact.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-on-surface">{fact.fact}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'stats' && (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-10 flex flex-col gap-8"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-primary">
                      <BarChart3 className="size-6" />
                      <h4 className="font-headline font-bold text-xl">Latency & Performance</h4>
                    </div>
                    <p className="text-outline text-xs font-medium leading-relaxed max-w-xl">
                      {(() => {
                        const m = session.metrics;
                        const hasNumbers = [m.sttLatency, m.llmLatency, m.ttsLatency, m.totalRtt].some(
                          (x) => x != null && !Number.isNaN(x)
                        );
                        if (m.metricsSampleCount > 0) {
                          return `Averages over ${m.metricsSampleCount} completed turn${m.metricsSampleCount === 1 ? '' : 's'} (STT → LLM → TTS pipeline).`;
                        }
                        if (hasNumbers) {
                          return 'Pipeline averages from stored session data.';
                        }
                        if (session.duration === 'Active') {
                          return 'Waiting for completed turns. Values refresh every few seconds while the call is live.';
                        }
                        return 'No per-turn latency samples were recorded for this session.';
                      })()}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LatencyCard label="Avg STT" value={session.metrics.sttLatency} icon={Clock} color="text-indigo-500" />
                    <LatencyCard label="Avg LLM TTFT" value={session.metrics.llmLatency} icon={Cpu} color="text-primary" />
                    <LatencyCard label="Avg TTS" value={session.metrics.ttsLatency} icon={Zap} color="text-emerald-500" />
                    <LatencyCard label="Avg Total RTT" value={session.metrics.totalRtt} icon={Timer} color="text-on-surface" />
                  </div>
                  <div className="p-8 rounded-2xl bg-surface-high/50 border border-outline-variant/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <ShieldCheck className="size-6" />
                      </div>
                      <div>
                        <h5 className="font-bold">System Health</h5>
                        <p className="text-outline text-xs">All services operational during this session</p>
                      </div>
                    </div>
                    <span className="text-emerald-500 font-bold text-sm">99.9% Uptime</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Metadata & Quick Stats */}
        <div className="flex flex-col gap-8">
          <div className="bg-surface-low p-8 rounded-3xl ghost-border flex flex-col gap-8">
            <h4 className="font-headline font-bold text-lg">Session Metadata</h4>

            <div className="flex flex-col gap-6">
              <MetaItem icon={Calendar} label="Date" value={session.date} />
              <MetaItem icon={Clock} label="Time" value={session.time} />
              <MetaItem icon={Timer} label="Duration" value={session.duration} />
              <MetaItem icon={MessageSquare} label="Total Turns" value={session.turns.toString()} />
              <MetaItem icon={Smile} label="Sentiment" value={
                session.sentimentScore != null
                  ? `${(session.sentimentScore * 100).toFixed(0)}% Positive`
                  : '—'
              } />
              {session.user_id && (
                <MetaItem icon={User} label="Caller ID" value={session.user_id} />
              )}
            </div>

            <div className="h-px bg-outline-variant/10 my-2"></div>

            <div className="flex flex-col gap-4">
              <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Assigned Bot</p>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-high border border-outline-variant/10">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-headline font-bold">
                  {session.bot[0]}
                </div>
                <div>
                  <h5 className="font-bold text-sm">{session.bot}</h5>
                  <p className="text-outline text-xs">AI Concierge</p>
                </div>
              </div>
            </div>
          </div>

          {/* <div className="bg-primary p-8 rounded-3xl shadow-xl shadow-primary/20 flex flex-col gap-4 text-on-primary-fixed">
            <div className="size-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Zap className="size-6" />
            </div>
            <h4 className="font-headline font-bold text-xl">Action Required?</h4>
            <p className="text-sm opacity-80 leading-relaxed">This session had high sentiment but unresolved intent. Would you like to escalate this to a human agent for follow-up?</p>
            <button
              onClick={handleEscalate}
              className="mt-4 w-full py-3 rounded-xl bg-white text-primary font-bold text-sm hover:bg-opacity-90 transition-all active:scale-95"
            >
              Escalate to Human
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4">
      <div className="size-10 rounded-xl bg-surface-highest flex items-center justify-center text-outline">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-outline uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function LatencyCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | null;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const display = value == null || Number.isNaN(value) ? '—' : String(value);
  const barPct =
    value != null && !Number.isNaN(value) ? Math.min(100, (value / 1000) * 100) : 0;
  return (
    <div className="p-6 rounded-2xl bg-surface-low ghost-border flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className={cn("p-2 rounded-lg bg-surface-highest", color)}>
          <Icon className="size-5" />
        </div>
        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">ms</span>
      </div>
      <div>
        <p className="text-[10px] font-bold text-outline uppercase tracking-widest">{label}</p>
        <h3 className="text-2xl font-headline font-extrabold mt-1 tabular-nums">{display}</h3>
      </div>
      <div className="w-full h-1 bg-surface-highest rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-[width] duration-500", color.replace('text-', 'bg-'))}
          style={{ width: `${barPct}%` }}
        ></div>
      </div>
    </div>
  );
}
