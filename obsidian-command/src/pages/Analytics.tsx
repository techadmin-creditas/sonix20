import React from 'react';
import { Header } from '../components/Header';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Smile, 
  Frown, 
  Meh,
  Target,
  Zap,
  Clock,
  Loader2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { cn } from '../lib/utils';
import { api, LatencyRecord, IntentRecord } from '../lib/api';

export default function Analytics() {
  const [latencyData, setLatencyData] = React.useState<LatencyRecord[]>([]);
  const [intentData, setIntentData] = React.useState<IntentRecord[]>([]);
  const [dashStats, setDashStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadAll() {
      try {
        const [latency, intents, stats] = await Promise.all([
          api.getLatencyAnalytics().catch(() => [] as LatencyRecord[]),
          api.getIntentAnalytics().catch(() => [] as IntentRecord[]),
          api.getDashboardStats().catch(() => null),
        ]);
        setLatencyData(latency);
        setIntentData(intents);
        setDashStats(stats);
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    loadAll();
  }, []);

  // Build chart-friendly latency records (short session ids)
  const latencyChartData = latencyData.map(r => ({
    name: r.session_id.slice(0, 6),
    STT: r.stt_ms,
    LLM: r.llm_ms,
    TTS: r.tts_ms,
  }));

  // Sentiment pie from dashboard stats
  const sentimentPie = dashStats ? [
    { name: 'Positive', value: dashStats.sentiment?.positive ?? 0 },
    { name: 'Neutral',  value: dashStats.sentiment?.neutral  ?? 0 },
    { name: 'Negative', value: dashStats.sentiment?.negative ?? 0 },
  ] : [];

  const totalSessions = dashStats?.total_sessions ?? 0;
  const avgTurns = dashStats?.avg_turns ?? 0;
  const completionRate = dashStats?.completion_rate ?? null;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header title="Conversational Intelligence" subtitle="Analytics" />

      <div className="p-10 flex flex-col gap-10">
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InsightCard 
            label="Total Sessions" 
            value={loading ? '…' : totalSessions.toString()} 
            subValue="All time" 
            icon={Smile} 
            color="text-emerald-500"
            trend="From voicebot database"
          />
          <InsightCard 
            label="Completion Rate" 
            value={loading ? '…' : completionRate != null ? `${Math.round(completionRate * 100)}%` : 'N/A'} 
            subValue="Sessions ended cleanly" 
            icon={Target} 
            color="text-primary"
            trend="Based on ended_at field"
          />
          <InsightCard 
            label="Avg. Turn Count" 
            value={loading ? '…' : avgTurns ? avgTurns.toFixed(1) : '—'} 
            subValue="Per session" 
            icon={Zap} 
            color="text-cyan-500"
            trend="Conversation depth"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-10 text-outline">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest">Loading Analytics Data...</span>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sentiment Pie */}
          <div className="bg-surface-low p-8 rounded-3xl ghost-border">
            <h4 className="font-headline text-xl font-bold mb-8">Sentiment Distribution</h4>
            {sentimentPie.every(s => s.value === 0) ? (
              <div className="h-[350px] flex items-center justify-center text-outline text-sm">No sentiment data yet.</div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={80} outerRadius={140} dataKey="value" nameKey="name">
                      {sentimentPie.map((entry, i) => (
                        <Cell key={i} fill={['#10b981', '#fb8c00', '#ef4444'][i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-6 flex justify-center gap-8">
              <LegendItem label="Positive" color="bg-emerald-500" />
              <LegendItem label="Neutral" color="bg-primary" />
              <LegendItem label="Negative" color="bg-red-500" />
            </div>
          </div>

          {/* Intent Distribution — real data */}
          <div className="bg-surface-low p-8 rounded-3xl ghost-border">
            <h4 className="font-headline text-xl font-bold mb-8">Intent Distribution</h4>
            {intentData.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-outline text-sm">
                {loading ? 'Loading…' : 'No intent data yet. Intents are set per session.'}
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={intentData.map(d => ({ name: d.intent, value: d.count }))} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#e3e2e5', fontSize: 13, fontWeight: 'bold' }} width={120} />
                    <Tooltip 
                      cursor={{ fill: '#292a2d' }}
                      contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }}
                    />
                    <Bar dataKey="value" fill="#fb8c00" radius={[0, 12, 12, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section — Latency Chart (real data) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-surface-low p-8 rounded-3xl ghost-border">
            <div className="flex items-center justify-between mb-8">
              <h4 className="font-headline text-xl font-bold">Pipeline Latency — Last 30 Sessions (ms)</h4>
            </div>
            {latencyChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-outline text-sm">
                {loading ? 'Loading…' : 'No latency data yet. Complete some voice sessions to populate this chart.'}
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#343538" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a48c7a', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a48c7a', fontSize: 11 }} unit="ms" />
                    <Tooltip
                      cursor={{ fill: '#292a2d' }}
                      contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }}
                      formatter={(v: number, name: string) => [`${v}ms`, name]}
                    />
                    <Bar dataKey="STT" stackId="l" fill="#ffb68e" />
                    <Bar dataKey="LLM" stackId="l" fill="#fb8c00" />
                    <Bar dataKey="TTS" stackId="l" fill="#6b7280" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 flex justify-center gap-8">
              <LegendItem label="STT" color="bg-[#ffb68e]" />
              <LegendItem label="LLM" color="bg-primary" />
              <LegendItem label="TTS" color="bg-gray-500" />
            </div>
          </div>

          <div className="bg-surface-low p-8 rounded-3xl ghost-border flex flex-col">
            <h4 className="font-headline text-xl font-bold mb-6">Key Insights</h4>
            <div className="space-y-6">
              <InsightItem 
                title="Latency data" 
                desc="STT/LLM/TTS breakdown from per-turn metrics logged after each voice turn." 
                icon={Clock}
              />
              <InsightItem 
                title="Intent distribution" 
                desc="Aggregated from session metadata.intent field set at session close." 
                icon={Frown}
                warning={intentData.length === 0}
              />
              <InsightItem 
                title="Sentiment tracking" 
                desc="Per-turn sentiment is scored live; session-level score persisted in metadata." 
                icon={TrendingUp}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ label, value, subValue, icon: Icon, color, trend }: any) {
  return (
    <div className="bg-surface-low p-8 rounded-3xl ghost-border flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div className={cn("p-3 rounded-2xl bg-surface-high shadow-inner", color)}>
          <Icon className="size-6" />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-headline font-black">{value}</span>
          <span className={cn("text-xs font-bold uppercase tracking-widest", color)}>{subValue}</span>
        </div>
      </div>
      <div className="pt-6 border-t border-outline-variant/10">
        <p className="text-xs text-outline font-medium">{trend}</p>
      </div>
    </div>
  );
}

function LegendItem({ label, color }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("size-3 rounded-full", color)}></div>
      <span className="text-xs font-bold text-outline uppercase tracking-widest">{label}</span>
    </div>
  );
}

function InsightItem({ title, desc, icon: Icon, warning }: any) {
  return (
    <div className="flex gap-4">
      <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", warning ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary")}>
        <Icon className="size-5" />
      </div>
      <div>
        <h5 className="text-sm font-bold text-on-surface">{title}</h5>
        <p className="text-xs text-outline mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
