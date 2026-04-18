import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Zap, Sparkles, RefreshCw,
  Timer, Phone, PhoneOff, ChevronDown, Mic,
} from 'lucide-react';
import { useTheme } from '../lib/theme';

interface LiveAgentStudioProps {
  className?: string;
  agent?: any;
}

const PROCESS_LOGS = [
  "Synthesizing vocal resonance...",
  "Mapping behavioral matrix...",
  "Calibrating personality: Empathetic",
  "Enforcing compliance protocols...",
  "Calculating resolution probability...",
  "Optimizing interaction flow...",
  "Synchronizing dialect: Hinglish",
  "Applying disclosure standards...",
  "Maximizing performance outcome...",
  "Session synthesis finalized.",
];

const MOCK_CALL = [
  { speaker: 'bot',    text: 'Namaste, Rohan ji. Main Sonix Finance se baat kar rahi hoon.',         lang: 'hindi'    },
  { speaker: 'user',   text: 'Haan ji, kahiye. Kya baat hai?',                                       lang: 'hindi'    },
  { speaker: 'bot',    text: 'Aapka loan account update ke baare mein inform karna tha. Good time?',  lang: 'hinglish' },
  { speaker: 'user',   text: 'Mera payment toh ho gaya hai last week!',                               lang: 'hinglish' },
  { speaker: 'bot',    text: 'Bilkul, hum use verify kar lete hain. Ek minute dijiyega.',             lang: 'hinglish' },
  { speaker: 'system', text: 'Cross-referencing payment gateway logs...',                             lang: 'system'   },
];

const SESSION_INSIGHTS = [
  "Customer Identity Verified",
  "Employment Status: Update Pending",
  "Sentiment: Moderately Cooperative",
  "Resolution Path: PTP Confirmed",
  "Compliance: Full verbal disclosure",
  "Call Outcome: Positive Transition",
];

// ─── SessionTimer ─────────────────────────────────────────────────────────────

const SessionTimer = React.memo(({ isActive }: { isActive: boolean }) => {
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    if (isActive) {
      const t = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(t);
    } else {
      setDuration(0);
    }
  }, [isActive]);
  return (
    <div className="flex items-center gap-1.5 font-mono text-sm tabular-nums text-on-surface-variant">
      <Timer className="size-3.5 text-primary" />
      <span>
        {Math.floor(duration / 60).toString().padStart(2, '0')}:
        {(duration % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
});

// ─── LiveWaveform ─────────────────────────────────────────────────────────────

const LiveWaveform = React.memo(({ isActive, isDark }: { isActive: boolean; isDark: boolean }) => {
  const svgRef   = useRef<SVGSVGElement>(null);
  const rafRef   = useRef<number>(0);
  const phaseRef = useRef(0);
  const ampRef   = useRef(2);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const p1 = svg.querySelector<SVGPathElement>('#lw1');
    const p2 = svg.querySelector<SVGPathElement>('#lw2');
    if (!p1 || !p2) return;

    const primaryColor  = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()  || (isDark ? '#38bdf8' : '#6366f1');
    const tertiaryColor = getComputedStyle(document.documentElement).getPropertyValue('--tertiary').trim() || (isDark ? '#0ea5e9' : '#a78bfa');
    p1.setAttribute('stroke', `#${primaryColor.replace('#','')}` === '#' ? (isDark ? '#38bdf8' : '#6366f1') : primaryColor);
    p2.setAttribute('stroke', `#${tertiaryColor.replace('#','')}` === '#' ? (isDark ? '#0ea5e9' : '#a78bfa') : tertiaryColor);

    const W = 280, H = 40, cy = H / 2;
    const targetAmp = isActive ? 14 : 2;

    const buildPath = (phase: number, amp: number) => {
      let d = '';
      for (let x = 0; x <= W; x += 3) {
        const y = cy + Math.sin(x * 0.045 + phase) * amp * (1 + Math.sin(x * 0.015) * 0.3);
        d += x === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      return d;
    };

    const tick = () => {
      ampRef.current += (targetAmp - ampRef.current) * 0.05;
      const noise = isActive ? (Math.random() - 0.5) * 3 : 0;
      phaseRef.current += isActive ? 0.07 : 0.015;
      p1.setAttribute('d', buildPath(phaseRef.current, ampRef.current + noise));
      p2.setAttribute('d', buildPath(phaseRef.current + 1.8, ampRef.current * 0.55));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, isDark]);

  return (
    <svg ref={svgRef} width="280" height="40" viewBox="0 0 280 40" className="overflow-visible">
      <path id="lw2" strokeWidth="1.5" fill="none" strokeOpacity="0.45" strokeLinecap="round" />
      <path id="lw1" strokeWidth="2"   fill="none" strokeOpacity="0.8"  strokeLinecap="round" />
    </svg>
  );
});

// ─── GradientOrb ──────────────────────────────────────────────────────────────

interface OrbProps {
  isActive: boolean;
  isConnecting: boolean;
  isDark: boolean;
  onClick: () => void;
  size?: number;
}

export const GradientOrb: React.FC<OrbProps> = ({ isActive, isConnecting, isDark, onClick, size = 192 }) => {
  const blob1 = isDark ? 'bg-cyan-400' : 'bg-sky-300';
  const blob2 = isDark ? 'bg-sky-400'  : 'bg-violet-300';
  const blob3 = isDark ? 'bg-blue-300' : 'bg-indigo-200';
  const base  = isDark
    ? 'bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600'
    : 'bg-gradient-to-br from-indigo-400 via-violet-500 to-purple-600';
  const ringStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer select-none"
      onClick={onClick}
    >
      {/* Glow halo */}
      <motion.div
        className="absolute rounded-full bg-primary/20 blur-2xl"
        animate={{ scale: isActive ? [1, 1.18, 1] : 1, opacity: isActive ? 0.7 : 0.3 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: size * 1.2, height: size * 1.2 }}
      />

      {/* Pulse rings */}
      <AnimatePresence>
        {isActive && [0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-primary/25"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 2.4], opacity: [0.6, 0, 0] }}
            transition={{ duration: 2.8, delay: i * 0.9, repeat: Infinity, ease: 'easeOut' }}
            style={{ width: size, height: size }}
          />
        ))}
      </AnimatePresence>

      {/* Main orb */}
      <motion.div
        className={`relative rounded-full overflow-hidden shadow-xl ${isDark ? 'shadow-primary/30' : 'shadow-indigo-300/40'}`}
        animate={{ scale: isActive ? [1, 1.035, 1] : isConnecting ? 0.93 : 1 }}
        transition={{ duration: 3, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
        style={{ width: size, height: size, boxShadow: `0 0 0 4px ${ringStyle}, 0 20px 60px rgba(99,102,241,0.25)` }}
      >
        <div className={`absolute inset-0 ${base}`} />

        {/* Animated blobs */}
        <motion.div className={`absolute w-3/4 h-3/4 rounded-full ${blob1} blur-xl opacity-55`}
          animate={{ x: [-16, 18, -16], y: [-10, 24, -10] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          style={{ top: '5%', left: '5%' }}
        />
        <motion.div className={`absolute w-2/3 h-2/3 rounded-full ${blob2} blur-xl opacity-50`}
          animate={{ x: [16, -20, 16], y: [18, -14, 18] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          style={{ bottom: '5%', right: '5%' }}
        />
        <motion.div className={`absolute w-1/2 h-1/2 rounded-full ${blob3} blur-lg opacity-60`}
          animate={{ x: [-8, 14, -8], y: [14, -14, 14] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          style={{ top: '26%', left: '26%' }}
        />

        {/* Specular highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_26%,rgba(255,255,255,0.52)_0%,transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_80%,rgba(0,0,0,0.12)_0%,transparent_50%)]" />
      </motion.div>

      {/* Icon overlay */}
      <AnimatePresence mode="wait">
        {isConnecting ? (
          <motion.div key="spin" className="absolute" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <RefreshCw className="size-9 text-white drop-shadow-lg" />
            </motion.div>
          </motion.div>
        ) : !isActive ? (
          <motion.div key="start" className="absolute flex flex-col items-center gap-1 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Phone className="size-8 text-white drop-shadow-md" />
            <span className="text-[11px] font-semibold text-white/80 tracking-widest drop-shadow">START</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

// ─── PropensityBar ────────────────────────────────────────────────────────────

const PropensityBar: React.FC<{ value: number; isDark: boolean }> = ({ value, isDark }) => {
  const filled = Math.round((value / 100) * 10);
  const inactiveColor = isDark ? '#334155' : '#e8eaff';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Propensity</span>
        <motion.span key={filled} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold font-mono text-primary">
          {Math.round(value)}%
        </motion.span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div key={i} className="h-1.5 flex-1 rounded-full"
            animate={{ backgroundColor: i < filled ? (i < 3 ? '#ef4444' : i < 7 ? '#f59e0b' : '#22c55e') : inactiveColor }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            style={{ originX: 0 }}
          />
        ))}
      </div>
    </div>
  );
};

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label: string; sublabel?: string }> = ({ checked, onChange, label, sublabel }) => (
  <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-low border border-outline-variant hover:border-primary/40 transition-colors">
    <div>
      <span className="text-sm font-medium text-on-surface block leading-tight">{label}</span>
      {sublabel && <span className="text-[11px] text-on-surface-variant">{sublabel}</span>}
    </div>
    <button onClick={onChange} className="relative shrink-0 ml-3">
      <div className="rounded-full transition-colors duration-300" style={{ width: 36, height: 20, backgroundColor: checked ? 'var(--primary)' : 'var(--outline)' }}>
        <motion.div className="absolute top-[3px] size-3.5 rounded-full bg-white shadow-sm"
          animate={{ x: checked ? 19 : 3 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </div>
    </button>
  </div>
);

// ─── BackgroundMesh ───────────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${(i * 19 + 7) % 93}%`,
  top:  `${(i * 31 + 11) % 88}%`,
  size: 2 + (i % 2),
  opacity: 0.06 + (i % 5) * 0.03,
  duration: 8 + (i % 7) * 2,
  delay: i * 0.6,
}));

export const BackgroundMesh: React.FC<{ isActive?: boolean; isFixed?: boolean }> = ({ isFixed = false }) => (
  <div className={`${isFixed ? 'fixed' : 'absolute'} inset-0 overflow-hidden pointer-events-none`} aria-hidden>
    {/* Top-Left Hub */}
    <motion.div className="absolute rounded-full bg-primary/20 blur-[120px]"
      animate={{ x: [0, 40, 0], y: [0, -20, 0], scale: [1, 1.15, 1] }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: 600, height: 600, top: '-20%', left: '-10%' }}
    />
    
    {/* Bottom-Right Hub */}
    <motion.div className="absolute rounded-full bg-secondary/15 blur-[100px]"
      animate={{ x: [0, -40, 0], y: [0, 30, 0], scale: [1, 1.25, 1] }}
      transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      style={{ width: 540, height: 540, bottom: '-15%', right: '-8%' }}
    />
    
    {/* Center-Right Hub */}
    <motion.div className="absolute rounded-full bg-tertiary/12 blur-[80px]"
      animate={{ x: [0, 40, -30, 0], y: [0, -30, 40, 0] }}
      transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
      style={{ width: 380, height: 380, top: '40%', right: '15%' }}
    />
    
    {/* Scattered Glows for 'Top-Bottom' connectivity */}
    <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-primary/5 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-secondary/5 to-transparent" />

    {PARTICLES.map(p => (
      <motion.div key={p.id} className="absolute rounded-full bg-primary"
        animate={{ y: [0, -18, 0], x: [0, p.id % 2 === 0 ? 10 : -10, 0] }}
        transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: p.size, height: p.size, left: p.left, top: p.top, opacity: p.opacity }}
      />
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const LiveAgentStudio: React.FC<LiveAgentStudioProps> = ({ className, agent }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isActive,     setIsActive]     = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConsole,  setShowConsole]  = useState(false);
  const [transcript,   setTranscript]   = useState<any[]>([]);
  const [intelligence, setIntelligence] = useState('');
  const [propensity,   setPropensity]   = useState(64);
  const [insights,     setInsights]     = useState<{ time: string; text: string }[]>([]);

  const [tone,             setTone]             = useState<'empathetic' | 'neutral' | 'firm'>('neutral');
  const [memoryEnabled,    setMemoryEnabled]    = useState(true);
  const [complianceGate,   setComplianceGate]   = useState(true);
  const [selectedVoice,    setSelectedVoice]    = useState('Default Studio');
  const [selectedLanguage, setSelectedLanguage] = useState('Hinglish');

  const scrollRef = useRef<HTMLDivElement>(null);
  const tIdx      = useRef(0);
  const rIdx      = useRef(0);

  const resetSession = () => {
    setIsActive(false); setIsConnecting(false); setShowConsole(false);
    setTranscript([]); setInsights([]); setPropensity(50);
    tIdx.current = 0; rIdx.current = 0;
  };

  const handleStart = () => { setIsConnecting(true); setTimeout(() => { setIsActive(true); setIsConnecting(false); }, 2000); };
  const handleEnd   = () => { setIsActive(false); setTimeout(resetSession, 400); };

  useEffect(() => {
    if (isActive) {
      setShowConsole(true);
      if (insights.length === 0) setInsights([{ time: 'Live', text: 'Initializing studio synthesis...' }]);
    } else if (transcript.length === 0) setShowConsole(false);
  }, [isActive, transcript.length]);

  useEffect(() => { if (agent?.id) resetSession(); }, [agent?.id]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    if (!isActive) return;
    const update = () => {
      const msg = MOCK_CALL[tIdx.current % MOCK_CALL.length];
      setTranscript(prev => [...prev, msg].slice(-10));
      setIntelligence(PROCESS_LOGS[rIdx.current % PROCESS_LOGS.length]);
      setPropensity(prev => Math.max(30, Math.min(98, prev + (Math.random() - 0.4) * 5)));
      if (msg.speaker !== 'user')
        setInsights(prev => [...prev.slice(-3), { time: 'Live', text: SESSION_INSIGHTS[rIdx.current % SESSION_INSIGHTS.length] }]);
      tIdx.current++; rIdx.current++;
    };
    if (tIdx.current === 0) update();
    const interval = setInterval(update, 3500);
    return () => clearInterval(interval);
  }, [isActive]);

  const cardCls = `backdrop-blur-xl border rounded-2xl shadow-lg ${
    isDark
      ? 'bg-surface/80 border-outline shadow-black/20'
      : 'bg-surface/80 border-outline-variant shadow-primary/5'
  }`;

  return (
    <div className={`relative w-full mx-auto flex items-center justify-center p-6 min-h-screen bg-background ${className ?? ''}`}>
      <BackgroundMesh />

      <motion.div layout className="relative z-10 w-full grid items-stretch"
        style={{
          gridTemplateColumns: showConsole ? '300px 1fr 260px' : '1fr',
          maxWidth: showConsole ? '1380px' : '520px',
          gap: showConsole ? '20px' : '0',
          minHeight: '680px',
        }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      >
        {/* ── LEFT: Agent Identity ─────── */}
        <motion.div layout className={`${cardCls} flex flex-col items-center p-8 gap-6 relative overflow-hidden`}
          style={isActive ? { boxShadow: '0 0 0 1.5px var(--primary), 0 8px 40px rgba(99,102,241,0.15)' } : {}}
        >
          <div className="w-full flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface tracking-tight leading-tight">
                {agent?.name ?? 'Sonix'} Studio
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Live Agent Interface</p>
            </div>
            {isActive ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/25">
                <motion.div className="size-1.5 rounded-full bg-primary"
                  animate={{ scale: [1, 1.7, 1], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }} />
                <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Live</span>
              </motion.div>
            ) : (
              <div className="size-8 rounded-full bg-surface-low flex items-center justify-center border border-outline-variant">
                <Mic className="size-4 text-on-surface-variant" />
              </div>
            )}
          </div>

          <GradientOrb isActive={isActive} isConnecting={isConnecting} isDark={isDark}
            onClick={() => { if (!isActive && !isConnecting) handleStart(); }} />

          <div className="w-full flex justify-center px-2">
            <LiveWaveform isActive={isActive} isDark={isDark} />
          </div>

          <AnimatePresence mode="wait">
            {isActive ? (
              <motion.div key="metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full space-y-4">
                <PropensityBar value={propensity} isDark={isDark} />
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2.5 rounded-xl border border-outline-variant ${isDark ? 'bg-surface-low' : 'bg-surface-low'}`}>
                    <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest block mb-1">Latency</span>
                    <span className="text-sm font-semibold font-mono text-on-surface">140<span className="text-xs font-normal text-on-surface-variant ml-0.5">ms</span></span>
                  </div>
                  <div className={`p-2.5 rounded-xl border border-outline-variant ${isDark ? 'bg-surface-low' : 'bg-surface-low'}`}>
                    <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest block mb-1">Duration</span>
                    <SessionTimer isActive={isActive} />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-primary/8 border border-primary/20">
                  <span className="text-[10px] font-medium text-primary uppercase tracking-widest block mb-1.5">AI Reasoning</span>
                  <p className="text-xs text-on-surface-variant leading-relaxed italic">"{intelligence || '...'}"</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full space-y-3 text-center">
                <p className="text-sm text-on-surface-variant">Tap the orb to start a live session</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {(['empathetic', 'neutral', 'firm'] as const).map(t => (
                    <button key={t} onClick={() => setTone(t)}
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                        tone === t ? 'bg-primary text-on-primary-fixed shadow-sm' : 'bg-surface-low border border-outline text-on-surface-variant hover:border-primary/50'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-outline text-xs text-on-surface bg-surface-low outline-none focus:border-primary appearance-none">
                    <option>Hinglish</option><option>English (Global)</option><option>Hindi (Regional)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-on-surface-variant pointer-events-none" />
                </div>
                <button onClick={handleStart}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary-fixed text-sm font-semibold shadow-lg shadow-primary/25 hover:brightness-105 active:scale-[0.98] transition-all">
                  Start Live Session
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── CENTER: Session Feed ─────── */}
        <AnimatePresence>
          {showConsole && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="flex flex-col gap-4"
            >
              <div className={`flex-1 ${cardCls} flex flex-col overflow-hidden`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/50">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center">
                      <MessageSquare className="size-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-on-surface">Live Transcript</h3>
                      <p className="text-xs text-on-surface-variant">Real-time session feed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <SessionTimer isActive={isActive} />
                    <button onClick={handleEnd}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-500 text-xs font-medium hover:bg-red-500/20 active:scale-95 transition-all">
                      <PhoneOff className="size-3" /> End Call
                    </button>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4 min-h-[420px]">
                  <AnimatePresence mode="popLayout">
                    {isConnecting ? (
                      <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center gap-5 py-20">
                        <div className="relative size-12">
                          <motion.div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary"
                            animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} />
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-sm font-medium text-on-surface">Connecting to agent</p>
                          <p className="text-xs text-on-surface-variant">Initializing secure session...</p>
                        </div>
                      </motion.div>
                    ) : (
                      transcript.map((m, i) => (
                        <motion.div key={i} layout
                          initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                          className={`flex ${m.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {m.speaker === 'system' ? (
                            <div className="w-full flex items-center gap-3 py-1">
                              <div className="h-px flex-1 bg-outline-variant" />
                              <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider shrink-0">{m.text}</span>
                              <div className="h-px flex-1 bg-outline-variant" />
                            </div>
                          ) : (
                            <div className={`max-w-[72%] flex flex-col gap-1 ${m.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                m.speaker === 'user'
                                  ? 'bg-primary text-on-primary-fixed rounded-br-sm shadow-md shadow-primary/20'
                                  : `${isDark ? 'bg-surface-high' : 'bg-surface'} border border-outline-variant border-l-2 border-l-primary text-on-surface rounded-bl-sm shadow-sm`
                              }`}>
                                {m.text}
                              </div>
                              <span className="text-[10px] text-outline px-1 uppercase font-medium tracking-wider">{m.lang}</span>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className={`${cardCls} p-4 flex items-center gap-4`}>
                <div className="flex items-center gap-2 shrink-0">
                  <Sparkles className="size-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Insights</span>
                </div>
                <div className="flex flex-1 flex-wrap gap-2 overflow-hidden">
                  <AnimatePresence>
                    {insights.slice(-4).map((item, i) => (
                      <motion.span key={i + item.text} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className="text-xs text-primary bg-primary/8 border border-primary/20 px-2.5 py-1 rounded-full whitespace-nowrap">
                        {item.text}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RIGHT: Controls ─────────── */}
        <AnimatePresence>
          {showConsole && (
            <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 32 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className={`${cardCls} p-6 flex flex-col gap-5 overflow-y-auto no-scrollbar`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-on-surface">Session Controls</h3>
                <div className="size-7 rounded-lg bg-surface-low border border-outline-variant flex items-center justify-center">
                  <Zap className="size-3.5 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Response Tone</span>
                <div className="flex flex-col gap-1.5">
                  {(['empathetic', 'neutral', 'firm'] as const).map(t => (
                    <button key={t} onClick={() => setTone(t)}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium capitalize text-left transition-all ${
                        tone === t ? 'bg-primary text-on-primary-fixed shadow-md shadow-primary/20' : 'bg-surface-low border border-outline-variant text-on-surface-variant hover:border-primary/40'
                      }`}>
                      <div className={`size-1.5 rounded-full ${tone === t ? 'bg-white' : 'bg-outline'}`} />
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-outline-variant" />

              <div className="space-y-2">
                <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Active Layers</span>
                <ToggleSwitch checked={memoryEnabled}  onChange={() => setMemoryEnabled(!memoryEnabled)}    label="Memory"         sublabel="Contextual sync" />
                <ToggleSwitch checked={complianceGate} onChange={() => setComplianceGate(!complianceGate)} label="Compliance Gate" sublabel="Regulatory enforcement" />
              </div>

              <div className="h-px bg-outline-variant" />

              <div className="space-y-2">
                <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Voice & Language</span>
                <div className="relative">
                  <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                    className="w-full bg-surface-low border border-outline-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary appearance-none cursor-pointer">
                    <option>Studio High-Fidelity</option><option>Natural Warmth</option><option>Executive Neutral</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-on-surface-variant pointer-events-none" />
                </div>
                <div className="relative">
                  <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}
                    className="w-full bg-surface-low border border-outline-variant rounded-xl px-3.5 py-2.5 text-sm text-on-surface outline-none focus:border-primary appearance-none cursor-pointer">
                    <option>Hinglish</option><option>English (Global)</option><option>Hindi (Regional)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-on-surface-variant pointer-events-none" />
                </div>
              </div>

              <div className="h-px bg-outline-variant" />

              <div className="space-y-2">
                <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Test & Debug</span>
                <div className="grid grid-cols-2 gap-2">
                  <button className="py-2 rounded-xl border border-outline text-on-surface-variant text-xs font-medium hover:border-primary/50 hover:text-primary transition-all bg-surface-low">Interrupt</button>
                  <button className="py-2 rounded-xl border border-outline text-on-surface-variant text-xs font-medium hover:border-primary/50 hover:text-primary transition-all bg-surface-low">Switch Lang</button>
                </div>
              </div>

              <div className="mt-auto pt-5 border-t border-outline-variant space-y-3">
                <button disabled={isConnecting} onClick={() => { resetSession(); setTimeout(handleStart, 100); }}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary-fixed text-sm font-semibold shadow-md shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  <RefreshCw className={`size-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                  {isConnecting ? 'Restarting...' : 'Restart Session'}
                </button>
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-medium text-on-surface-variant">System Stable</span>
                  </div>
                  <span className="text-[10px] font-mono text-outline">v2.0.4</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LiveAgentStudio;
