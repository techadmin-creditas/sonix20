import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { Header } from '../components/Header';
import { SESSIONS } from '../constants';
import { Users, Bot, Calendar, Timer, Activity, ArrowUpRight, PlusCircle, Sparkles, BarChart3, TrendingUp, Smile, Clock, Loader2, Globe, Volume2, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { NeuralBackground } from '../components/NeuralBackground';
import { api, DashboardStats, SessionRecord, Bot as BotType } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const CHART_DATA = [
  { name: 'Oct 01', value: 400 },
  { name: 'Oct 05', value: 300 },
  { name: 'Oct 10', value: 600 },
  { name: 'Oct 15', value: 800 },
  { name: 'Oct 20', value: 500 },
  { name: 'Oct 25', value: 900 },
  { name: 'Oct 30', value: 1100 },
];

const PIE_DATA = [
  { name: 'Alex (Support)', value: 52, color: '#ffb77b' },
  { name: 'Nova (Booking)', value: 31, color: '#ffb68e' },
  { name: 'Max (Inquiry)', value: 17, color: '#343538' },
];

const SENTIMENT_DATA = [
  { name: 'Positive', value: 65, color: '#10b981' },
  { name: 'Neutral', value: 25, color: '#827568' },
  { name: 'Negative', value: 10, color: '#ef4444' },
];

const DURATION_DATA = [
  { range: '0-1m', count: 120 },
  { range: '1-3m', count: 450 },
  { range: '3-5m', count: 320 },
  { range: '5-10m', count: 180 },
  { range: '10m+', count: 95 },
];

const SUCCESS_RATE_DATA = [
  { name: 'Alex', rate: 94 },
  { name: 'Nova', rate: 88 },
  { name: 'Max', rate: 91 },
];

const PEAK_HOURS_DATA = [
  { hour: '00:00', sessions: 20 },
  { hour: '04:00', sessions: 10 },
  { hour: '08:00', sessions: 80 },
  { hour: '12:00', sessions: 150 },
  { hour: '16:00', sessions: 120 },
  { hour: '20:00', sessions: 60 },
  { hour: '23:59', sessions: 30 },
];

const CASE_SCENARIOS = [
  { name: 'The Negotiator', description: 'High-Stakes Debt Settlement', percentage: 94, color: '#fb8c00', language: 'Hindi/EN', tools: ['settlement', 'logic'] },
  { name: 'The EMI Converter', description: 'Bounce Probability Reduction', percentage: 88, color: '#06b6d4', language: 'Hindi', tools: ['restructure', 'payment'] },
  { name: 'The Settlement Specialist', description: 'NPA Resolution Protocol', percentage: 82, color: '#8f4e00', language: 'English', tools: ['legal', 'waiver'] },
  { name: 'The Regional Connect', description: 'Vernacular Linguistic Link', percentage: 76, color: '#10b981', language: 'Tamil', tools: ['local', 'honors'] },
  { name: 'The Gentle Nudge', description: 'Early-Stage Pre-Emptive Care', percentage: 71, color: '#ffb77b', language: 'Multi', tools: ['reminder', 'soft'] },
];

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
          api.getSessions(5),
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-12 text-primary animate-spin" />
          <p className="text-outline font-bold uppercase tracking-widest text-sm">Synchronizing Mission Control...</p>
        </div>
      </div>
    );
  }
  const totalSessionsValue = stats?.metrics.totalSessions || 0;
  const pieData = stats?.botUsage
    .filter(b => {
      const meta = allBots.find(bot => bot.name === b.name);
      if (!meta) return true;
      // Show only bots assigned to this user
      return (meta as any).owner_user_id === currentUser?.id;
    })
    .map((b, i) => {
      const meta = allBots.find(bot => bot.name === b.name);
      return {
        ...b,
        description: meta?.description || 'Autonomous Intelligence Unit',
        language: meta?.default_language || 'en',
        voice: meta?.voice_id || 'Default Neural',
        role: meta?.role || 'System Agent',
        tools: (meta as any)?.tools_enabled || [],
        percentage: totalSessionsValue > 0 ? Math.round((b.value / totalSessionsValue) * 100) : 0,
        color: ['#ffb77b', '#ffb68e', '#8f4e00', '#fb8c00', '#06b6d4'][i % 5]
      };
    }) || [];

  const sentimentData = stats ? [
    { name: 'Positive', value: stats.sentiment.positive, color: '#10b981' },
    { name: 'Neutral', value: stats.sentiment.neutral, color: '#827568' },
    { name: 'Negative', value: stats.sentiment.negative, color: '#ef4444' },
  ] : SENTIMENT_DATA;

  return (
    <div className="flex-1 flex flex-col relative min-h-screen">
      <NeuralBackground />

      <Header
        title="Dashboard"
        subtitle="Real-time analytics and performance metrics"
      />

      <div className="relative z-10 p-10 flex flex-col gap-10">
        {/* TOP PERFORMERS SECTION */}
        {pieData.length > 0 && (
          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.98 },
              visible: { opacity: 1, scale: 1 }
            }}
            className="bg-surface-lowest rounded-4xl premium-forge-border p-8 relative overflow-hidden group shadow-sm hover:shadow-2xl dark:hover:shadow-primary/5 transition-all duration-700"
          >
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">Top Case Scenarios</h3>
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Highest Performing Agents</p>
              </div>
              {/* <button 
                  onClick={() => navigate('/personas')} 
                  className="text-[10px] font-black text-outline uppercase tracking-[widest] hover:text-primary transition-colors flex items-center gap-2"
               >
                  Global Fleet
                  <ArrowUpRight className="size-3" />
               </button> */}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
              {CASE_SCENARIOS.map((bot, idx) => (
                <motion.div
                  key={bot.name}
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/sessions/live', { state: { initialBotName: bot.name } })}
                  className="relative group/bot cursor-pointer"
                >
                  <div className="flex flex-col items-center p-6 rounded-4xl bg-surface-low/80 border border-outline-variant/10 group-hover/bot:border-primary/30 group-hover/bot:bg-primary/5 transition-all text-center h-full">
                    <div className="relative mb-5">
                      <div className="size-16 rounded-[1.25rem] flex items-center justify-center shadow-2xl transition-all duration-500 group-hover/bot:scale-110 group-hover/bot:rotate-6 group-hover/bot:shadow-primary/20" style={{ backgroundColor: `${bot.color}15`, border: `1px solid ${bot.color}30` }}>
                        <Bot className="size-8" style={{ color: bot.color }} />
                      </div>
                      {/* <div className="absolute -top-2 -right-2 size-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-black text-on-primary-fixed border-4 border-surface-lowest shadow-lg">
                           #{idx + 1}
                        </div> */}
                    </div>

                    <h4 className="text-sm font-black text-on-surface uppercase tracking-tight truncate w-full mb-1">{bot.name}</h4>
                    <p className="text-[9px] font-bold text-outline uppercase tracking-widest mb-4 line-clamp-1">{bot.description}</p>

                    <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                      <div className="px-2 py-0.5 rounded-full bg-surface-low border border-outline-variant/10 flex items-center gap-1">
                        <Globe className="size-2.5 text-primary" />
                        <span className="text-[8px] font-black uppercase text-on-surface/70">{bot.language}</span>
                      </div>
                      <div className="px-2 py-0.5 rounded-full bg-surface-low border border-outline-variant/10 flex items-center gap-1">
                        <Volume2 className="size-2.5 text-primary" />
                        <span className="text-[8px] font-black uppercase text-on-surface/70 truncate max-w-[40px]">Voice</span>
                      </div>
                    </div>

                    <div className="mt-auto w-full">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[9px] font-black text-outline uppercase tracking-tighter">Performance</span>
                        <span className="text-[10px] font-mono font-bold text-primary">{bot.percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-outline-variant/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${bot.percentage}%` }}
                          transition={{ duration: 1.5, delay: idx * 0.1, ease: "circOut" }}
                          className="h-full bg-primary shadow-[0_0_12px_var(--primary)]"
                        />
                      </div>
                    </div>

                    {/* Capabilities Hover Hint */}
                    <div className="absolute inset-x-4 bottom-4 translate-y-4 opacity-0 group-hover/bot:translate-y-0 group-hover/bot:opacity-100 transition-all duration-300 pointer-events-none">
                      <div className="flex justify-center gap-1">
                        {bot.tools.slice(0, 3).map((t: string) => (
                          <div key={t} className="size-5 rounded-md bg-primary/20 flex items-center justify-center">
                            <Zap className="size-3 text-primary" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Decorative Elements */}
            <div className="absolute -bottom-20 -right-20 size-80 bg-primary/5 blur-[120px] rounded-full group-hover:bg-primary/10 transition-colors" />
          </motion.div>
        )}

        {/* KPI Row */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <StatCard
            icon={Users}
            label="Total Sessions"
            value={stats?.metrics.totalSessions.toLocaleString() || "0"}
            trend="+12% Active"
            trendColor="text-emerald-500"
            onClick={() => navigate('/sessions')}
          />
          <StatCard
            icon={Bot}
            label="Active Bots"
            value={allBots.filter(b => (b as any).owner_user_id === currentUser?.id).length.toString()}
            trend="Available now"
            trendColor="text-primary"
            onClick={() => navigate('/personas')}
          />
          <StatCard
            icon={Calendar}
            label="Avg Duration"
            value={stats?.metrics.avgDuration || "0s"}
            trend="P99 Latency"
            trendColor="text-on-surface-variant"
            onClick={() => navigate('/sessions')}
          />
          <StatCard
            icon={Activity}
            label="Success Rate"
            value={stats?.metrics.successRate || "0%"}
            trend="Performance"
            trendColor="text-emerald-500"
            onClick={() => navigate('/analytics')}
          />
        </motion.div>



        {/* Charts Row 1 */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.2 }
            }
          }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="lg:col-span-2 bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col cursor-pointer hover:border-primary/30 transition-all hover:shadow-2xl dark:hover:shadow-primary/5 group"
            onClick={() => navigate('/sessions')}
          >
            <div className="flex justify-between items-center mb-10">
              <div>
                <h4 className="font-headline text-xl font-bold text-on-surface">Sessions Over Time</h4>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">Traffic volume across last 30 days</p>
              </div>
              <div className="flex gap-2 p-1 bg-surface-low rounded-xl border border-outline-variant/10">
                <button className="px-5 py-2 rounded-lg ember-gradient text-[9px] font-bold uppercase tracking-widest shadow-lg">Monthly</button>
                <button className="px-5 py-2 rounded-lg text-outline text-[9px] font-bold uppercase tracking-widest hover:bg-surface-highest transition-all">Weekly</button>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.sessionHistory && stats.sessionHistory.length > 0 ? stats.sessionHistory : CHART_DATA}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb8c00" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#fb8c00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#121316', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px', fontFamily: 'Manrope' }}
                    itemStyle={{ color: '#ffb77b', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#fb8c00" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col cursor-pointer hover:border-primary/30 transition-all hover:shadow-2xl dark:hover:shadow-primary/5"
            onClick={() => navigate('/personas')}
          >
            <div className="mb-8">
              <h4 className="font-headline text-xl font-bold text-on-surface">Bot Usage</h4>
              <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">Performance distribution</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-headline font-extrabold text-on-surface leading-none">{stats?.metrics.successRate || '0%'}</span>
                <span className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-1">Success Rate</span>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-4 overflow-y-auto max-h-[140px] pr-2 custom-scrollbar">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between group/item">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(251,140,0,0.4)]" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[11px] font-bold text-on-surface/80 group-hover/item:text-on-surface transition-colors">{item.name}</span>
                  </div>
                  <span className="text-[11px] font-black text-primary">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Charts Row 2 - New Charts */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.3 }
            }
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col cursor-pointer hover:border-primary/30 transition-all hover:shadow-2xl dark:hover:shadow-primary/5 group min-h-[480px]"
            onClick={() => navigate('/sessions')}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Smile className="size-5" />
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">Sentiment Analysis</h4>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">Distribution of user emotions</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sentimentData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 9, fill: '#827568', fontWeight: 700 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: '#121316', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-auto pt-8 flex justify-around p-4 bg-surface-low rounded-2xl border border-outline-variant/10">
                {sentimentData.map(item => (
                  <div key={item.name} className="text-center">
                    <p className="text-[8px] uppercase font-black text-outline tracking-wider">{item.name}</p>
                    <p className="text-xl font-headline font-extrabold" style={{ color: item.color }}>{Math.round(item.value)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col cursor-pointer hover:border-primary/30 transition-all hover:shadow-2xl dark:hover:shadow-primary/5 group min-h-[480px]"
            onClick={() => navigate('/sessions')}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="size-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20 shadow-inner group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <Clock className="size-5" />
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">Call Duration Distribution</h4>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">Time spent on active calls</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(stats?.durationDistribution && stats.durationDistribution.some(d => d.count > 0)) ? stats.durationDistribution : DURATION_DATA}>
                    <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#827568', fontWeight: 700 }} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: '#121316', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                      {((stats?.durationDistribution && stats.durationDistribution.some(d => d.count > 0)) ? stats.durationDistribution : DURATION_DATA).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#fb8c00', '#ffb68e', '#8f4e00', '#fb8c00'][index % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-auto p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider italic">Most calls conclude within the 1-3 minute window.</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Charts Row 3 - NEW */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.4 }
            }
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col cursor-pointer hover:border-primary/30 transition-all hover:shadow-2xl dark:hover:shadow-primary/5 group min-h-[480px]"
            onClick={() => navigate('/personas')}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:bg-primary group-hover:text-on-primary-fixed transition-colors">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">Bot Success Rate</h4>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">Performance by agent</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.botPerformance && stats.botPerformance.length > 0 ? stats.botPerformance : SUCCESS_RATE_DATA}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#827568', fontWeight: 700 }} />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ backgroundColor: '#121316', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="rate" fill="#fb8c00" radius={[6, 6, 0, 0]} barSize={40}>
                      {(stats?.botPerformance && stats.botPerformance.length > 0 ? stats.botPerformance : SUCCESS_RATE_DATA).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#fb8c00' : index === 1 ? '#ffb68e' : '#8f4e00'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-auto pt-8 grid grid-cols-3 gap-4">
                {(stats?.botPerformance && stats.botPerformance.length > 0 ? stats.botPerformance : SUCCESS_RATE_DATA).map(item => (
                  <div key={item.name} className="text-center p-4 rounded-2xl bg-surface-low border border-outline-variant/10 group-hover:border-primary/20 transition-all">
                    <p className="text-[8px] uppercase font-black text-outline tracking-wider">{item.name}</p>
                    <p className="text-xl font-headline font-extrabold text-primary">{Math.round(item.rate)}%</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col cursor-pointer hover:border-primary/30 transition-all hover:shadow-2xl dark:hover:shadow-primary/5 group min-h-[480px]"
            onClick={() => navigate('/sessions')}
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 border border-cyan-500/20 shadow-inner group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                  <BarChart3 className="size-5" />
                </div>
                <div>
                  <h4 className="font-headline text-lg font-bold text-on-surface">Peak Activity Hours</h4>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">Peak traffic times today</p>
                </div>
              </div>
              <div className="text-[9px] font-black px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 uppercase tracking-widest">
                {stats?.peakHours.reduce((acc, curr) => acc + curr.sessions, 0) || 0} Sessions
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats?.peakHours && stats.peakHours.length > 0 ? stats.peakHours : PEAK_HOURS_DATA}>
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#827568', fontWeight: 700 }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#121316', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      itemStyle={{ color: '#06b6d4', fontSize: '11px' }}
                    />
                    <Line type="monotone" dataKey="sessions" stroke="#06b6d4" strokeWidth={4} dot={{ fill: '#06b6d4', r: 5, strokeWidth: 0 }} activeDot={{ r: 7, strokeWidth: 0, fill: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-auto">
                {stats?.peakHours && stats.peakHours.length > 0 ? (
                  <div className="mt-8 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10 text-center">
                    <p className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider italic">
                      Peak usage detected at <strong>{
                        stats.peakHours.reduce((max, cur) => cur.sessions > max.sessions ? cur : max, stats.peakHours[0])?.hour
                      }</strong> today.
                    </p>
                  </div>
                ) : (
                  <div className="mt-8 p-3 rounded-xl bg-surface-low border border-outline-variant/10 text-center">
                    <p className="text-[10px] text-outline font-bold uppercase tracking-wider italic">Awaiting initial traffic capture for today.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.5 }
            }
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col group"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="font-headline text-xl font-bold text-on-surface">Tool Call Breakdown</h4>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">Distribution of bot actions</p>
              </div>
              <div className="text-[9px] font-black px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest">
                {stats?.toolUsage.reduce((acc, curr) => acc + curr.count, 0) || 0} Total
              </div>
            </div>
            <div className="flex flex-col gap-8 overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '320px' }}>
              {stats?.toolUsage && stats.toolUsage.length > 0 ? (
                (() => {
                  const maxCount = Math.max(...stats.toolUsage.map(t => t.count), 1);
                  return stats.toolUsage.map((tool, idx) => (
                    <ProgressBar
                      key={tool.name}
                      label={tool.name}
                      value={(tool.count / maxCount) * 100}
                      count={`${tool.count} calls`}
                      color={['bg-primary', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'][idx % 4]}
                    />
                  ));
                })()
              ) : (
                <>
                  <ProgressBar label="search_knowledge" value={85} count="842 calls" color="bg-primary shadow-[0_0_8px_rgba(251,140,0,0.4)]" />
                  <ProgressBar label="book_appointment" value={45} count="412 calls" color="bg-amber-500" />
                  <ProgressBar label="get_appointments" value={25} count="210 calls" color="bg-blue-500" />
                  <ProgressBar label="remember_user_fact" value={15} count="188 calls" color="bg-emerald-500" />
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="bg-surface-lowest p-8 rounded-4xl premium-forge-border flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="font-headline text-xl font-bold text-on-surface">Recent Sessions</h4>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">Latest user interactions</p>
              </div>
              <button
                onClick={() => navigate('/sessions')}
                className="text-[10px] font-black text-primary uppercase tracking-widest px-4 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary hover:text-on-primary-fixed transition-all shadow-sm"
              >
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[9px] uppercase tracking-[0.2em] text-outline font-black">
                    <th className="pb-2 px-4">Session ID</th>
                    <th className="pb-2 px-4">Bot</th>
                    <th className="pb-2 px-4">Status</th>
                    <th className="pb-2 px-4 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {recentSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="group bg-surface-low/30 hover:bg-primary/5 transition-all cursor-pointer"
                      onClick={() => navigate(`/sessions/${session.id}`)}
                    >
                      <td className="py-4 px-4 rounded-l-2xl border-l border-y border-outline-variant/5">
                        <span className="font-mono text-[10px] text-primary font-bold">{session.id.slice(0, 8)}</span>
                      </td>
                      <td className="py-4 px-4 border-y border-outline-variant/5">
                        <span className="text-xs font-bold text-on-surface/80 group-hover:text-on-surface transition-colors">{session.bot_name || 'System Operator'}</span>
                      </td>
                      <td className="py-4 px-4 border-y border-outline-variant/5">
                        <span className={cn(
                          "flex items-center gap-2 font-black text-[9px] uppercase tracking-widest",
                          !session.ended_at ? "text-emerald-500" : "text-outline"
                        )}>
                          <span className={cn("size-1.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]", !session.ended_at ? "bg-emerald-500 animate-pulse" : "bg-outline")}></span>
                          {!session.ended_at ? 'Active' : 'Ended'}
                        </span>
                      </td>
                      <td className="py-4 px-4 rounded-r-2xl border-r border-y border-outline-variant/5 text-right font-medium text-on-surface-variant text-[10px]">
                        {new Date(session.started_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend, trendColor, onClick }: any) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [0, 1], [10, -10]);
  const rotateY = useTransform(mouseXSpring, [0, 1], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width);
    y.set(mouseY / height);
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      style={{ perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative"
    >
      <motion.div
        style={{ rotateX, rotateY }}
        onClick={onClick}
        className={cn(
          "bg-surface-lowest p-6 rounded-3xl premium-forge-border flex flex-col gap-6 cursor-pointer relative overflow-hidden transition-all duration-300",
          "hover:border-primary/40 hover:shadow-2xl dark:hover:shadow-primary/10",
          onClick && "active:scale-95"
        )}
      >
        {/* Background Glow */}
        <div className="absolute -top-12 -right-12 size-32 bg-primary/5 blur-3xl rounded-full group-hover:bg-primary/10 transition-colors" />

        <div className="flex justify-between items-start">
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="p-3 rounded-2xl bg-surface-low text-primary border border-outline-variant/10 shadow-inner group-hover:bg-primary group-hover:text-on-primary-fixed transition-colors"
          >
            <Icon className="size-5" />
          </motion.div>
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-surface-low border border-outline-variant/5 shadow-sm",
            trendColor
          )}>
            {trend}
          </span>
        </div>

        <div>
          <p className="text-outline text-[10px] font-bold uppercase tracking-[0.2em] mb-1">{label}</p>
          <h3 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight leading-none">{value}</h3>
        </div>

        {/* Shine Overlay */}
        <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </motion.div>
    </motion.div>
  );
}

function ProgressBar({ label, value, count, color }: any) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-[10px] font-black text-on-surface uppercase tracking-widest">{label}</span>
          <p className="text-[8px] font-bold text-outline uppercase tracking-tighter">Bot Action Breakdown</p>
        </div>
        <span className="text-[10px] font-mono text-primary font-black bg-primary/5 px-2 py-0.5 rounded border border-primary/10">{count}</span>
      </div>
      <div className="w-full h-2.5 bg-surface-low rounded-full overflow-hidden border border-outline-variant/5 p-0.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={cn("h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(251,140,0,0.2)]", color)}
        />
      </div>
    </div>
  );
}
