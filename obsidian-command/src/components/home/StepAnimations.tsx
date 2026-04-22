import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Zap, BarChart2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepAnimationsProps {
  type: 'configure' | 'deploy' | 'monitor';
  isActive: boolean;
}

// ─── Configure Animation ─────────────────────────────────────────────────────

function ConfigureWidget({ isActive }: { isActive: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isActive) { setStep(0); return; }
    setStep(0);
    let s = 0;
    const iv = setInterval(() => {
      s++;
      setStep(s);
      if (s >= 5) {
        clearInterval(iv);
      }
    }, 450);
    return () => clearInterval(iv);
  }, [isActive]);

  const rows = [
    { label: 'Agent Name', value: 'Astra', type: 'text' },
    { label: 'Tone',       value: 'Empathetic',   type: 'select' },
    { label: 'Language',   value: null,   type: 'pills' },
    { label: 'Compliance', value: null,   type: 'toggle' },
  ];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-low/80 p-3 space-y-2 font-mono text-[10px]">
      <div className="flex items-center gap-1.5 mb-1">
        <Settings className="size-3 text-primary" />
        <span className="text-on-surface-variant font-sans font-semibold text-[9px] uppercase tracking-widest">Configure Agent</span>
      </div>

      {rows.map((row, i) => (
        <AnimatePresence key={row.label}>
          {step > i && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-on-surface-variant/60 w-20 shrink-0">{row.label}</span>
              <div className="flex-1 flex items-center gap-1">
                {row.type === 'text' && (
                  <span className="flex-1 px-2 py-0.5 rounded bg-surface border border-outline-variant text-on-surface">{row.value}</span>
                )}
                {row.type === 'select' && (
                  <span className="flex-1 px-2 py-0.5 rounded bg-surface border border-outline-variant text-on-surface">{row.value} ▾</span>
                )}
                {row.type === 'pills' && (
                  <div className="flex gap-1">
                    {['Hindi', 'English'].map(l => (
                      <span key={l} className="px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px]">{l}</span>
                    ))}
                  </div>
                )}
                {row.type === 'toggle' && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-4 rounded-full bg-primary flex items-center justify-end pr-0.5">
                      <div className="size-3 rounded-full bg-white" />
                    </div>
                    <span className="text-primary text-[9px] font-semibold">ON</span>
                  </div>
                )}
                <span className="text-emerald-400">✓</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ))}

      <AnimatePresence>
        {step >= 5 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 mt-1"
          >
            <span className="text-emerald-400 text-[9px] font-bold">✓ Config Saved — 0.3s</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Deploy Animation ─────────────────────────────────────────────────────────

const TERMINAL_LINES = [
  { text: '$ sonix deploy --agent astra', color: 'text-primary', prefix: '' },
  { text: 'Config validated', color: 'text-emerald-400', prefix: '✓ ', suffix: '0.3s' },
  { text: 'Telephony webhook set', color: 'text-emerald-400', prefix: '✓ ', suffix: '0.6s' },
  { text: 'Compliance layer active', color: 'text-emerald-400', prefix: '✓ ', suffix: '0.8s' },
  { text: 'Language models loaded', color: 'text-emerald-400', prefix: '✓ ', suffix: '1.1s' },
  { text: 'LIVE  +91-98XXXXXXXX', color: 'text-emerald-400', prefix: '● ', suffix: '1.4s', pulse: true },
];

function DeployWidget({ isActive }: { isActive: boolean }) {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (!isActive) { setVisibleLines(0); return; }
    setVisibleLines(0);
    let l = 0;
    const iv = setInterval(() => {
      l++;
      setVisibleLines(l);
      if (l >= TERMINAL_LINES.length) {
        clearInterval(iv);
      }
    }, 320);
    return () => clearInterval(iv);
  }, [isActive]);

  return (
    <div className="rounded-xl border border-outline-variant bg-[#0d0e12] p-3 space-y-1.5 font-mono text-[10px]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3 text-primary" />
          <span className="text-on-surface-variant/70 font-sans font-semibold text-[9px] uppercase tracking-widest">Terminal</span>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold border border-primary/20">[prod]</span>
      </div>

      {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center justify-between gap-2 ${line.pulse ? 'animate-pulse' : ''}`}
        >
          <span className={line.color}>
            {line.prefix}{line.text}
          </span>
          {line.suffix && (
            <span className="text-on-surface-variant/40 shrink-0">{line.suffix}</span>
          )}
        </motion.div>
      ))}

      {visibleLines === 0 && (
        <div className="text-on-surface-variant/30 animate-pulse">_</div>
      )}
    </div>
  );
}

// ─── Monitor Animation ────────────────────────────────────────────────────────

interface Metric { label: string; value: number; max: number; unit: string; suffix?: string; color: string }

const MONITOR_METRICS: Metric[] = [
  { label: 'Active Calls',  value: 12, max: 15,  unit: '/15',  color: 'bg-primary' },
  { label: 'Sentiment',     value: 78, max: 100, unit: '%',    suffix: '↑ +4%', color: 'bg-emerald-500' },
  { label: 'Resolution',    value: 92, max: 100, unit: '%',    color: 'bg-sky-500' },
  { label: 'Avg Latency',   value: 45, max: 100, unit: 'ms',   suffix: '✓', color: 'bg-amber-500' },
];

function MonitorWidget({ isActive }: { isActive: boolean }) {
  const [animated, setAnimated] = useState(false);
  const [liveVals, setLiveVals] = useState(MONITOR_METRICS.map(m => m.value));

  useEffect(() => {
    if (!isActive) { setAnimated(false); return; }
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, [isActive]);

  // Simulate live ticks every 2s
  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(() => {
      setLiveVals(prev =>
        prev.map((v, i) => {
          const delta = Math.floor(Math.random() * 5) - 2;
          const m = MONITOR_METRICS[i];
          return Math.max(Math.min(v + delta, m.max), 1);
        })
      );
    }, 2000);
    return () => clearInterval(iv);
  }, [isActive]);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-low/80 p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="size-3 text-primary" />
          <span className="text-on-surface-variant font-semibold text-[9px] uppercase tracking-widest">Live Dashboard</span>
        </div>
        <span className="flex items-center gap-1 text-[8px] font-semibold text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Live
        </span>
      </div>

      {MONITOR_METRICS.map((m, i) => {
        const pct = (liveVals[i] / m.max) * 100;
        return (
          <div key={m.label} className="space-y-0.5">
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-on-surface-variant/70">{m.label}</span>
              <span className="font-semibold text-on-surface">
                {m.label === 'Avg Latency' ? `${liveVals[i] * 4 + 200}ms` : `${liveVals[i]}${m.unit}`}
                {m.suffix && <span className="text-emerald-400 ml-1">{m.suffix}</span>}
              </span>
            </div>
            <div className="h-1 rounded-full bg-outline-variant/40 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${m.color}`}
                initial={{ width: 0 }}
                animate={{ width: animated ? `${pct}%` : '0%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.1 }}
              />
            </div>
          </div>
        );
      })}

      {/* Sparkline */}
      <div className="pt-1">
        <svg viewBox="0 0 120 20" className="w-full h-4" preserveAspectRatio="none">
          <motion.polyline
            points="0,18 20,14 40,16 60,8 80,10 100,6 120,4"
            fill="none"
            stroke="var(--primary, #6366f1)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: animated ? 1 : 0, opacity: animated ? 1 : 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function StepAnimations({ type, isActive }: StepAnimationsProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={type}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
      >
        {type === 'configure' && <ConfigureWidget isActive={isActive} />}
        {type === 'deploy'    && <DeployWidget    isActive={isActive} />}
        {type === 'monitor'   && <MonitorWidget   isActive={isActive} />}
      </motion.div>
    </AnimatePresence>
  );
}
