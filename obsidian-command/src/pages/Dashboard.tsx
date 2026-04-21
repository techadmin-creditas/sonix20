import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from 'recharts';
import { Header } from '../components/Header';
import { 
  Users, Bot, Activity, BarChart3, TrendingUp, 
  Smile, Clock, Loader2, Zap, ExternalLink, 
  ShieldCheck, Cpu, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { NeuralBackground } from '../components/NeuralBackground';
import { api, DashboardStats, SessionRecord, Bot as BotType } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../lib/theme';

// --- Shared Types ---
interface ProgressProps {
  label: string;
  value: number;
  count: number | string;
  color: string;
}

// --- Professional UI Components ---

function StatusBadge({ active }: { active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
      active ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-surface-high text-outline border border-outline-variant/10"
    )}>
      <div className={cn("size-1 rounded-full", active ? "bg-emerald-500 animate-pulse" : "bg-outline/40")} />
      {active ? 'Live' : 'Standby'}
    </div>
  );
}

function DashboardCard({ title, subtitle, children, icon: Icon, action, className }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative bg-surface border border-outline-variant/10 rounded-2xl flex flex-col shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden",
        className
      )}
    >
      <div className="p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="size-9 rounded-lg bg-surface-low border border-outline-variant/10 flex items-center justify-center text-primary/80 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Icon className="size-5" />
              </div>
            )}
            <div>
              <h4 className="font-headline text-base font-bold text-on-surface tracking-tight leading-tight">{title}</h4>
              {subtitle && <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, trend, isPositive, onClick }: any) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "p-6 rounded-2xl bg-surface border border-outline-variant/10 shadow-sm transition-all cursor-pointer group",
        "hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="size-10 rounded-xl bg-surface-low border border-outline-variant/5 flex items-center justify-center text-outline group-hover:text-primary transition-colors">
          <Icon className="size-5" />
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black",
          isPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
        )}>
          {isPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-on-surface/60 uppercase tracking-[0.15em] mb-1 group-hover:text-primary/60 transition-colors">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-headline font-extrabold tracking-tight tabular-nums text-gradient-display">
            {value}
          </h3>
          <StatusBadge active />
        </div>
      </div>
    </motion.div>
  );
}

function ProgressBar({ label, value, count, color }: ProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <span className="text-[11px] font-bold text-on-surface/70 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono font-black text-on-surface/40">{count}</span>
      </div>
      <div className="w-full h-1.5 bg-surface-low rounded-full overflow-hidden border border-outline-variant/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: "circOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// --- Professional Dashboard Entry ---

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = React.useState<SessionRecord[]>([]);
  const [allBots, setAllBots] = React.useState<BotType[]>([]);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [s, rs, bots] = await Promise.all([
          api.getDashboardStats(),
          api.getSessions(6),
          api.getBots()
        ]);
        setStats(s);
        setRecentSessions(rs);
        setAllBots(bots);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5">
          <Loader2 className="size-8 text-primary animate-spin opacity-40" />
          <p className="text-outline font-bold uppercase tracking-[0.3em] text-[10px]">Loading Core Telemetry</p>
        </div>
      </div>
    );
  }

  const totalSessionsValue = stats?.metrics.totalSessions || 0;
  // Analytical color palette
  const botColors = ['#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'];

  const pieData = stats?.botUsage
    .filter(b => {
      const meta = allBots.find(bot => bot.name === b.name);
      if (!meta) return true;
      return (meta as any).owner_user_id === currentUser?.id;
    })
    .map((b, i) => {
      const meta = allBots.find(bot => bot.name === b.name);
      return {
        ...b,
        percentage: totalSessionsValue > 0 ? Math.round((b.value / totalSessionsValue) * 100) : 0,
        trend: `+${((b.value % 5) + 1.2 + (i * 0.4)).toFixed(1)}%`,
        color: botColors[i % botColors.length]
      };
    }) || [];

  const sentimentData = stats ? [
    { name: 'Positive', value: stats.sentiment.positive, color: '#10b981' },
    { name: 'Neutral', value: stats.sentiment.neutral, color: '#f59e0b' },
    { name: 'Negative', value: stats.sentiment.negative, color: '#ef4444' },
  ] : [
    { name: 'Positive', value: 65, color: '#10b981' },
    { name: 'Neutral', value: 25, color: '#f59e0b' },
    { name: 'Negative', value: 10, color: '#ef4444' },
  ];

  return (
    <div className="flex-1 flex flex-col relative min-h-screen bg-background text-on-surface">
      <NeuralBackground opacity={0.3} />

      <Header
        title="Dashboard"
        subtitle="System Performance & Fleet Telemetry"
      />

      <div className="relative z-10 p-6 lg:p-10 flex flex-col gap-10 max-w-[1600px] mx-auto w-full">
        
          {/* Fleet Performance Grid */}
        {pieData.length > 0 && (
          <DashboardCard 
            title="Persona performance" 
            subtitle="Efficiency benchmarks across active modules"
            icon={ShieldCheck}
            action={
              <button 
                onClick={() => navigate('/personas')} 
                className="flex items-center gap-2 text-[10px] font-black text-outline hover:text-primary uppercase tracking-widest px-3 py-1.5 rounded-lg bg-surface-low border border-outline-variant/5 transition-all"
              >
                Persona Manager <ExternalLink className="size-3" />
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {pieData.slice(0, 5).map((bot, idx) => (
                <div 
                  key={bot.name}
                  onClick={() => navigate('/sessions/live', { state: { initialBotName: bot.name } })}
                  className="p-5 rounded-xl bg-surface-low/80 border border-outline-variant/10 hover:border-primary/40 hover:bg-surface hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col group/card"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div 
                      className="size-10 rounded-lg flex items-center justify-center text-white shadow-lg shadow-black/10 group-hover/card:scale-110 transition-transform"
                      style={{ backgroundColor: bot.color }}
                    >
                      <Bot className="size-5" />
                    </div>
                    {/* <span className="text-[10px] font-bold text-on-surface/30 group-hover/card:text-primary transition-colors">0{idx + 1}</span> */}
                  </div>
                  <h5 className="font-bold text-sm text-on-surface truncate mb-1">{bot.name}</h5>
                  <p className="text-[9px] text-on-surface/50 font-medium leading-relaxed mb-6 line-clamp-2 min-h-[2.5em]">
                    {allBots.find(b => b.name === bot.name)?.description || 'Neural core initializing...'}
                  </p>
                  
                  <div className="mt-auto">
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-xl font-headline font-black tabular-nums text-gradient-display">{bot.percentage}%</span>
                       <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">{bot.trend}</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-high rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${bot.percentage}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className="h-full bg-primary"
                        style={{ backgroundColor: bot.color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            label="Total Sessions"
            value={stats?.metrics.totalSessions.toLocaleString() || "0"}
            trend="12.4%"
            isPositive={true}
            onClick={() => navigate('/sessions')}
          />
          <StatCard
            icon={Bot}
            label="Neural Persona Fleet"
            value={allBots.filter(b => (b as any).owner_user_id === currentUser?.id).length.toString()}
            trend="Live"
            isPositive={true}
            onClick={() => navigate('/personas')}
          />
          <StatCard
            icon={Clock}
            label="Avg Resolution Time"
            value={stats?.metrics.avgDuration || "0s"}
            trend="2.1%"
            isPositive={false}
            onClick={() => navigate('/sessions')}
          />
          <StatCard
            icon={Activity}
            label="System Health"
            value={stats?.metrics.successRate || "0%"}
            trend="Stable"
            isPositive={true}
            onClick={() => navigate('/analytics')}
          />
        </div>

        {/* Analytical Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <DashboardCard 
            className="lg:col-span-8"
            title="Session Throughput"
            subtitle="Aggregated volume telemetry (30D)"
            icon={TrendingUp}
          >
            <div className="h-[360px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.sessionHistory?.length ? stats.sessionHistory : CHART_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.1} />
                  <defs>
                    <linearGradient id="colorWave" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--outline)', fontWeight: 600 }}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#4f46e5" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorWave)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          <DashboardCard 
            className="lg:col-span-4"
            title="Resource allocation"
            subtitle="Workload distribution matrix"
            icon={BarChart3}
          >
            <div className="h-[280px] relative flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-headline font-black text-on-surface leading-none tabular-nums">{stats?.metrics.successRate || '0%'}</span>
                <span className="text-[10px] text-outline font-bold uppercase tracking-[0.2em] mt-1">Efficiency</span>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              {pieData.slice(0, 4).map((item) => (
                <div key={item.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-low/30 border border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <div className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-bold text-on-surface truncate w-32">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-primary">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        {/* Sentiment & Engagement */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <DashboardCard 
            className="lg:col-span-6"
            title="Vocal Sentiment spectrum"
            subtitle="Aggregated emotional feedback analysis"
            icon={Smile}
          >
            <div className="h-[260px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--outline-variant)" opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={85} tick={{ fontSize: 10, fill: 'var(--outline)', fontWeight: 700 }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--surface-low)', opacity: 0.5 }}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px' }}
                  />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={34}>
                    {sentimentData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-6 mt-8">
              {sentimentData.map(item => (
                <div key={item.name} className="text-center">
                  <p className="text-[9px] font-bold text-outline uppercase tracking-wider mb-2">{item.name}</p>
                  <p className="text-xl font-headline font-black" style={{ color: item.color }}>{Math.round(item.value)}%</p>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard 
            className="lg:col-span-6"
            title="Session tenure distribution"
            subtitle="Aggregated user engagement depth"
            icon={Clock}
          >
            <div className="h-[280px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.durationDistribution?.length ? stats.durationDistribution : [
                   { range: '0-1m', count: 120 }, { range: '1-3m', count: 450 }, { range: '3-5m', count: 320 }, { range: '5-10m', count: 180 }, { range: '10m+', count: 95 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" opacity={0.1} />
                  <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--outline)', fontWeight: 700 }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                    {[1,2,3,4,5].map((_, idx) => <Cell key={idx} fill={idx === 1 ? '#4f46e5' : '#e2e8f0'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </div>

        {/* Global Activity Stream */}
        <DashboardCard 
          className="lg:col-span-12"
          title="Global Event Log"
          subtitle="Real-time operational session stream"
          icon={Zap}
          action={
            <button 
              onClick={() => navigate('/sessions')}
              className="px-4 py-2 rounded-xl bg-surface-low border border-outline-variant/10 text-on-surface font-black text-[10px] uppercase tracking-widest hover:bg-surface-high transition-all"
            >
              Session Archive
            </button>
          }
        >
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-bold text-outline/50 uppercase tracking-[0.2em]">
                  <th className="pb-3 px-6">Trace ID</th>
                  <th className="pb-3 px-6">Neural Identity</th>
                  <th className="pb-3 px-6">Activity State</th>
                  <th className="pb-3 px-6 text-right">Initiation Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr 
                    key={session.id}
                    onClick={() => navigate(`/sessions/${session.id}`)}
                    className="group bg-surface-low/20 hover:bg-surface-high/30 transition-all cursor-pointer"
                  >
                    <td className="py-4 px-6 rounded-l-xl border-l border-y border-outline-variant/5">
                      <span className="font-mono text-[10px] text-primary/70 font-bold tracking-tight">{session.id.slice(0, 12).toUpperCase()}</span>
                    </td>
                    <td className="py-4 px-6 border-y border-outline-variant/5">
                      <div className="flex items-center gap-3">
                         <div className="size-7 rounded bg-primary/5 flex items-center justify-center text-primary/60 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <Bot className="size-3.5" />
                         </div>
                         <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">{session.bot_name || 'System Core'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 border-y border-outline-variant/5">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider",
                        !session.ended_at 
                          ? "bg-emerald-500/10 text-emerald-600" 
                          : "bg-surface-low text-outline opacity-60"
                      )}>
                        <div className={cn("size-1 rounded-full", !session.ended_at ? "bg-emerald-500 animate-pulse" : "bg-outline/50")} />
                        {!session.ended_at ? 'Active stream' : 'Concluded'}
                      </div>
                    </td>
                    <td className="py-4 px-6 rounded-r-xl border-r border-y border-outline-variant/5 text-right">
                      <span className="font-bold text-outline text-[11px] tabular-nums tracking-normal opacity-60 group-hover:opacity-100 transition-all">
                        {new Date(session.started_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </div>
      
      {/* Structural Grain */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50" />
    </div>
  );
}

const CHART_DATA = [
  { name: '01', value: 400 },
  { name: '05', value: 300 },
  { name: '10', value: 600 },
  { name: '15', value: 800 },
  { name: '20', value: 500 },
  { name: '25', value: 900 },
  { name: '30', value: 1100 },
];
