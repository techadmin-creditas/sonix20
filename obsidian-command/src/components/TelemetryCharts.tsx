import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { Zap, Activity, ShieldAlert } from 'lucide-react';

interface TurnMetric {
  turn: number;
  stt: number;
  llm: number;
  tts: number;
  total: number;
  sentiment: number;
  is_fast_track?: boolean;
  interruptType?: 'clean' | 'noise_filter' | 'barge_in';
}

interface TelemetryChartsProps {
  data: TurnMetric[];
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ data }) => {
  // Compute True TTFS Average (Excluding noise_filter events to prevent jitter)
  const validTurns = data.filter(d => d.total > 0 && d.interruptType !== 'noise_filter');
  const avgTTFS = validTurns.length > 0 
    ? Math.round(validTurns.reduce((acc, d) => acc + d.total, 0) / validTurns.length) 
    : 0;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-outline/40 space-y-4 py-12">
        <Activity className="size-12 opacity-20" />
        <p className="text-sm font-medium">Waiting for neural activity data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* TTFS Heatmap Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Pipeline Heatmap (TTFS)</h4>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Avg: {avgTTFS}ms</span>
            <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">Target: &lt;500ms</span>
          </div>
        </div>
        
        <div className="h-48 glass-panel rounded-2xl p-4 overflow-hidden border-primary/5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} stackOffset="none">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis 
                dataKey="turn" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} 
                unit="ms"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '10px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value: any, name: string, props: any) => {
                  const entry = props.payload as TurnMetric;
                  if (entry.interruptType === 'noise_filter') {
                    return [value, `${name} (System Interference)`];
                  }
                  return [value, name];
                }}
              />
              <Bar dataKey="stt" name="STT" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} fillOpacity={0.8} />
              <Bar dataKey="llm" name="LLM" stackId="a" radius={[0, 0, 0, 0]} fillOpacity={0.8}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.is_fast_track ? '#22d3ee' : '#10b981'} 
                    fillOpacity={entry.is_fast_track ? 1 : 0.8}
                  />
                ))}
              </Bar>
              <Bar dataKey="tts" name="TTS" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
              
              {/* Highlight turns with noise filtering (Yellow) or Barge-in (Green) */}
              {data.map((entry, index) => {
                if (entry.interruptType === 'noise_filter') {
                  return <ReferenceLine key={`ref-${index}`} x={entry.turn} stroke="#f59e0b" strokeDasharray="3 3" />;
                }
                if (entry.interruptType === 'barge_in') {
                  return <ReferenceLine key={`ref-${index}`} x={entry.turn} stroke="#10b981" strokeDasharray="3 3" strokeWidth={2} />;
                }
                return null;
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Sentiment Velocity Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Activity className="size-4 text-cyan-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Sentiment Velocity</h4>
        </div>
        
        <div className="h-48 glass-panel rounded-2xl p-4 overflow-hidden border-cyan-500/5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
              <XAxis 
                dataKey="turn" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} 
              />
              <YAxis 
                domain={[-1, 1]} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '10px'
                }}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="sentiment" 
                stroke="#22d3ee" 
                fillOpacity={1} 
                fill="url(#colorSentiment)" 
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Interruption Audit Widget */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-emerald-500/5">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-outline uppercase tracking-widest">Barge-ins (Success)</p>
            <p className="text-lg font-headline font-black text-on-surface">
              {data.filter(d => d.interruptType === 'barge_in').length}
              <span className="text-[10px] font-normal text-outline/50 ml-1">Wins</span>
            </p>
          </div>
          <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Zap className="size-5 text-emerald-400" />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-cyan-500/10">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-outline uppercase tracking-widest">Semantic Fast-Tracks</p>
            <p className="text-lg font-headline font-black text-cyan-400">
              {data.filter(d => d.is_fast_track).length}
              <span className="text-[10px] font-normal text-outline/50 ml-1">Boosts</span>
            </p>
          </div>
          <div className="size-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <Zap className="size-5 text-cyan-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
