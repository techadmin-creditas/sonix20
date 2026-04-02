import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { Header } from '../components/Header';
import { SESSIONS } from '../constants';
import { Users, Bot, Calendar, Timer, ArrowUpRight, PlusCircle, Sparkles, BarChart3, TrendingUp, Smile, Clock, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { api, DashboardStats, SessionRecord } from '../lib/api';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = React.useState<SessionRecord[]>([]);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [s, rs] = await Promise.all([
          api.getDashboardStats(),
          api.getSessions(5)
        ]);
        setStats(s);
        setRecentSessions(rs);
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

  const pieData = stats?.botUsage.map((b, i) => ({
    ...b,
    color: ['#ffb77b', '#ffb68e', '#8f4e00', '#fb8c00', '#06b6d4'][i % 5]
  })) || [];

  const sentimentData = stats ? [
    { name: 'Positive', value: stats.sentiment.positive, color: '#10b981' },
    { name: 'Neutral', value: stats.sentiment.neutral, color: '#827568' },
    { name: 'Negative', value: stats.sentiment.negative, color: '#ef4444' },
  ] : SENTIMENT_DATA;

  return (
    <div className="flex-1 flex flex-col ">
      {/* <Header
        title="Overview"
        subtitle="Mission Control"
        actions={
          <Link
            to="/personas/create"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold tracking-tight shadow-lg active:scale-95 transition-all"
          >
            <PlusCircle className="size-5" />
            <span>New Bot</span>
          </Link>
        }
      /> */}

      <div className="p-10 flex flex-col gap-10">
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            label="Total Sessions"
            value={stats?.metrics.totalSessions.toLocaleString() || "0"}
            trend="+0%"
            trendColor="text-emerald-500"
            onClick={() => navigate('/sessions')}
          />
          <StatCard
            icon={Bot}
            label="Active Bots"
            value={stats?.metrics.activeBots.toString() || "0"}
            trend="Live"
            trendColor="text-primary"
            onClick={() => navigate('/personas')}
          />
          <StatCard
            icon={Calendar}
            label="Avg Duration"
            value={stats?.metrics.avgDuration || "0s"}
            trend="Sessions"
            trendColor="text-on-surface-variant"
            onClick={() => navigate('/sessions')}
          />
          <StatCard
            icon={Timer}
            label="Success Rate"
            value={stats?.metrics.successRate || "0%"}
            trend="Target 95%"
            trendColor="text-emerald-500"
            onClick={() => navigate('/sessions')}
          />
        </div>

        {/* Quick Actions / Featured Section */}
        <div className="bg-surface-low rounded-3xl ghost-border p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group cursor-pointer" onClick={() => navigate('/personas/create')}>
          <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="size-5" />
              </div>
              <h3 className="text-2xl font-headline font-extrabold">Ready to expand?</h3>
            </div>
            <p className="text-outline text-sm max-w-md">Deploy a new specialized AI agent to handle customer inquiries, bookings, or technical support in minutes.</p>
          </div>
          <div className="relative z-10 flex items-center gap-3 px-8 py-4 rounded-2xl ember-gradient text-on-primary-fixed font-bold tracking-tight shadow-xl shadow-primary/20 active:scale-95 transition-all hover:shadow-primary/40">
            <PlusCircle className="size-6" />
            <span className="text-lg">Create New Bot</span>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-low p-8 rounded-2xl ghost-border flex flex-col cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/sessions')}>
            <div className="flex justify-between items-center mb-10">
              <div>
                <h4 className="font-headline text-lg font-bold">Sessions Over Time</h4>
                <p className="text-outline text-sm">Traffic volume across last 30 days</p>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-1.5 rounded-lg bg-surface-highest text-xs font-bold ghost-border">Monthly</button>
                <button className="px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-surface-highest transition-all">Weekly</button>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART_DATA}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb8c00" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#fb8c00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }}
                    itemStyle={{ color: '#ffb77b' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#fb8c00" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface-low p-8 rounded-2xl ghost-border flex flex-col cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/personas')}>
            <h4 className="font-headline text-lg font-bold mb-1">Bot Usage</h4>
            <p className="text-outline text-sm mb-8">Performance distribution</p>
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-headline font-extrabold">100%</span>
                <span className="text-[10px] text-outline font-bold uppercase tracking-widest">Load</span>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-on-surface">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 - New Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-low p-8 rounded-2xl ghost-border flex flex-col cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/sessions')}>
            <div className="flex items-center gap-3 mb-6">
              <Smile className="size-5 text-emerald-500" />
              <h4 className="font-headline text-lg font-bold">Sentiment Analysis</h4>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-around">
              {sentimentData.map(item => (
                <div key={item.name} className="text-center">
                  <p className="text-[10px] uppercase font-bold text-outline">{item.name}</p>
                  <p className="text-lg font-extrabold" style={{ color: item.color }}>{item.value}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-low p-8 rounded-2xl ghost-border flex flex-col cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/sessions')}>
            <div className="flex items-center gap-3 mb-6">
              <Clock className="size-5 text-indigo-500" />
              <h4 className="font-headline text-lg font-bold">Call Duration Distribution</h4>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={DURATION_DATA}>
                  <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#827568' }} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }}
                  />
                  <Bar dataKey="count" fill="#8f4e00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-outline mt-4 italic">Most calls conclude within the 1-3 minute window.</p>
          </div>
        </div>

        {/* Charts Row 3 - NEW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-low p-8 rounded-2xl ghost-border flex flex-col cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/personas')}>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="size-5 text-primary" />
              <h4 className="font-headline text-lg font-bold">Bot Success Rate</h4>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SUCCESS_RATE_DATA}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#827568' }} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }}
                  />
                  <Bar dataKey="rate" fill="#fb8c00" radius={[4, 4, 0, 0]}>
                    {SUCCESS_RATE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#fb8c00' : index === 1 ? '#ffb68e' : '#8f4e00'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {SUCCESS_RATE_DATA.map(item => (
                <div key={item.name} className="text-center p-3 rounded-xl bg-surface-high/50">
                  <p className="text-[10px] uppercase font-bold text-outline">{item.name}</p>
                  <p className="text-lg font-extrabold text-primary">{item.rate}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-low p-8 rounded-2xl ghost-border flex flex-col cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/sessions')}>
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="size-5 text-cyan-500" />
              <h4 className="font-headline text-lg font-bold">Peak Activity Hours</h4>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.peakHours || PEAK_HOURS_DATA}>
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#827568' }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#121316', border: '1px solid #343538', borderRadius: '12px' }}
                    itemStyle={{ color: '#06b6d4' }}
                  />
                  <Line type="monotone" dataKey="sessions" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-outline mt-4">Traffic peaks significantly during midday (12:00 - 16:00).</p>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-low p-8 rounded-2xl ghost-border flex flex-col cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/workflows')}>
            <h4 className="font-headline text-lg font-bold mb-6">Tool Call Breakdown</h4>
            <div className="flex flex-col gap-6">
              <ProgressBar label="search_knowledge" value={85} count="842 calls" color="bg-secondary" />
              <ProgressBar label="book_appointment" value={45} count="412 calls" color="bg-primary" />
              <ProgressBar label="get_appointments" value={25} count="210 calls" color="bg-tertiary" />
              <ProgressBar label="remember_user_fact" value={15} count="188 calls" color="bg-outline" />
            </div>
          </div>

          <div className="bg-surface-low p-8 rounded-2xl ghost-border flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-headline text-lg font-bold">Recent Sessions</h4>
              <button onClick={() => navigate('/sessions')} className="text-xs font-bold text-primary hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-outline border-b border-outline-variant/10">
                    <th className="pb-4 font-extrabold">Session ID</th>
                    <th className="pb-4 font-extrabold">Bot</th>
                    <th className="pb-4 font-extrabold">Status</th>
                    <th className="pb-4 font-extrabold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {recentSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="group hover:bg-surface-high transition-all cursor-pointer"
                      onClick={() => navigate(`/sessions/${session.id}`)}
                    >
                      <td className="py-4 font-mono text-xs text-primary">{session.id.slice(0, 8)}</td>
                      <td className="py-4">{session.bot_name || 'System'}</td>
                      <td className="py-4">
                        <span className={cn(
                          "flex items-center gap-1.5 font-bold text-[10px] uppercase",
                          !session.ended_at ? "text-emerald-500" : "text-outline"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", !session.ended_at ? "bg-emerald-500" : "bg-outline")}></span>
                          {!session.ended_at ? 'Active' : 'Ended'}
                        </span>
                      </td>
                      <td className="py-4 text-on-surface-variant text-xs">{new Date(session.started_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend, trendColor, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className="bg-surface-low p-6 rounded-2xl ghost-border flex flex-col gap-4 cursor-pointer hover:border-primary/40 hover:bg-surface-high transition-all group"
    >
      <div className="flex justify-between items-start">
        <div className="p-2 rounded-lg bg-surface-highest text-primary group-hover:bg-primary group-hover:text-on-primary-fixed transition-colors">
          <Icon className="size-5" />
        </div>
        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-highest", trendColor)}>
          {trend}
        </span>
      </div>
      <div>
        <p className="text-outline text-xs font-semibold uppercase tracking-wider">{label}</p>
        <h3 className="text-3xl font-headline font-extrabold mt-1">{value}</h3>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, count, color }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs font-bold text-outline">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="w-full h-2 bg-surface-highest rounded-full overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}
