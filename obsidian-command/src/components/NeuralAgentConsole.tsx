import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Shield, 
  Terminal, 
  Send, 
  ChevronRight, 
  MessageSquare, 
  Settings, 
  Zap, 
  Globe, 
  Mic, 
  Sparkles, 
  Brain, 
  Info, 
  RefreshCw,
  HandMetal,
  User,
  AudioLines,
  Gauge,
  Timer
} from 'lucide-react';
import gsap from 'gsap';

interface NeuralAgentConsoleProps {
  className?: string;
  agent?: any;
}

// EXECUTIVE INTELLIGENCE: Shifting to 'Matrix Logic'
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
  "Session synthesis finalized."
];

const MOCK_CALL = [
  { speaker: 'bot', text: 'Namaste, Rohan ji. Main Sonix Finance se baat kar rahi hoon.', lang: 'hindi' },
  { speaker: 'user', text: 'Haan ji, kahiye. Kya baat hai?', lang: 'hindi' },
  { speaker: 'bot', text: 'Aapka loan account update ke baare mein inform karna tha. Is it a good time?', lang: 'hinglish' },
  { speaker: 'user', text: 'Mera payment toh ho gaya hai last week!', lang: 'hinglish' },
  { speaker: 'bot', text: 'Bilkul, hum use verify kar lete hain. Ek minute dijiyega.', lang: 'hinglish' },
  { speaker: 'system', text: 'Cross-referencing payment gateway logs...', lang: 'system' }
];

const SESSION_INSIGHTS = [
  "Customer Identity Verified",
  "Employment Status: Update Pending",
  "Sentiment: Moderately Cooperative",
  "Resolution Path: PTP Confirmed",
  "Compliance: Full verbal disclosure",
  "Call Outcome: Positive Transition"
];

// SUB-COMPONENT: REFINED SESSION TIMER
const SessionTimer = React.memo(({ isActive }: { isActive: boolean }) => {
  const [duration, setDuration] = useState(0);
  
  useEffect(() => {
    if (isActive) {
      const timer = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(timer);
    } else {
      setDuration(0);
    }
  }, [isActive]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/50 border border-zinc-800/50 min-w-[60px] justify-center">
      <Timer className="size-2.5 text-primary" />
      <span className="text-[10px] font-bold text-on-surface-variant tabular-nums">
        {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
});

// SUB-COMPONENT: INTELLIGENCE PULSE (Modern Audio Signature)
const IntelligencePulse = React.memo(({ isActive }: { isActive: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !isActive) return;
    const bars = containerRef.current.querySelectorAll('.pulse-bar');
    
    gsap.killTweensOf(bars);
    gsap.to(bars, {
      scaleY: "random(0.2, 1.2)",
      duration: 0.4,
      stagger: {
        each: 0.05,
        repeat: -1,
        yoyo: true
      },
      ease: "power1.inOut"
    });

    return () => {
      gsap.killTweensOf(bars);
    };
  }, [isActive]);

  return (
    <div ref={containerRef} className="flex items-center justify-center gap-[4px] h-16 px-6">
      {[...Array(24)].map((_, i) => (
        <div 
          key={i} 
          className="pulse-bar w-[3px] h-full rounded-full origin-center"
          style={{ 
            height: `${30 + Math.sin(i * 0.4) * 15}%`,
            background: `linear-gradient(to bottom, var(--primary), ${i % 2 === 0 ? '#818cf8' : '#f472b6'})`,
            boxShadow: '0 0 15px rgba(var(--primary-rgb), 0.3)'
          }}
        />
      ))}
    </div>
  );
});

export const SonarExecutiveStudio: React.FC<NeuralAgentConsoleProps> = ({ className, agent }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [intelligence, setIntelligence] = useState<string>("");
  const [propensity, setPropensity] = useState(64);
  const [insights, setInsights] = useState<{time: string, text: string}[]>([]);
  
  // SESSION PARAMETERS
  const [tone, setTone] = useState<'empathetic' | 'neutral' | 'firm'>('neutral');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [complianceGate, setComplianceGate] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('Default Studio');
  const [selectedLanguage, setSelectedLanguage] = useState('Hinglish');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const tIdx = useRef(0);
  const rIdx = useRef(0);

  const resetSession = () => {
    setIsActive(false);
    setIsConnecting(false);
    setShowConsole(false);
    setTranscript([]);
    setInsights([]);
    setPropensity(50);
    tIdx.current = 0;
    rIdx.current = 0;
  };

  useEffect(() => {
    if (isActive) {
      setShowConsole(true);
      if (insights.length === 0) {
        setInsights([{ time: 'Live', text: 'Initializing Sonar Studio Synthesis...' }]);
      }
    } else if (transcript.length === 0) {
      setShowConsole(false);
    }
  }, [isActive, transcript.length]);

  useEffect(() => {
    if (agent?.id) resetSession();
  }, [agent?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [transcript]);

  useEffect(() => {
    if (isActive) {
      const updateFeed = () => {
        const currentMsg = MOCK_CALL[tIdx.current % MOCK_CALL.length];
        setTranscript(prev => [...prev, currentMsg].slice(-10));
        setIntelligence(PROCESS_LOGS[rIdx.current % PROCESS_LOGS.length]);
        
        setPropensity(prev => {
          const delta = (Math.random() - 0.4) * 5; 
          return Math.max(30, Math.min(98, prev + delta));
        });

        if (currentMsg.speaker === 'bot' || currentMsg.speaker === 'system') {
          setInsights(prev => [...prev.slice(-3), { time: 'Live', text: SESSION_INSIGHTS[rIdx.current % SESSION_INSIGHTS.length] }]);
        }

        tIdx.current++;
        rIdx.current++;
      };

      if (tIdx.current === 0) updateFeed();
      const interval = setInterval(updateFeed, 3500);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  return (
    <div className={`relative w-full mx-auto min-h-[700px] flex items-center justify-center p-4 ${className}`}>
      {/* SESSION BACKGROUND AMBIANCE */}
      <AnimatePresence>
        {isActive && (
          <>
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
               <motion.div 
                 animate={{ 
                   y: [0, -30, 0],
                   x: [0, 20, 0],
                   scale: [1, 1.1, 1]
                 }}
                 transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                 className="absolute top-1/4 left-1/4 size-[500px] bg-primary/20 blur-[120px] rounded-full" 
               />
               <motion.div 
                 animate={{ 
                   y: [0, 40, 0],
                   x: [0, -30, 0],
                   scale: [1, 1.2, 1]
                 }}
                 transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                 className="absolute bottom-1/4 right-1/4 size-[400px] bg-indigo-500/20 blur-[100px] rounded-full" 
               />
            </div>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.1)_0%,transparent_70%)]"
            />
          </>
        )}
      </AnimatePresence>

      <motion.div 
        layout
        className="relative z-10 w-full grid gap-10 items-stretch"
        style={{ 
          gridTemplateColumns: showConsole ? '1.2fr 2fr 1.2fr' : '1fr',
          maxWidth: showConsole ? '1800px' : '650px',
          height: '750px'
        }}
      >
        {/* SECTION 1: IDENTITY & VISUALIZER */}
        <motion.div 
          layout
        className="bg-zinc-800/20 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 flex flex-col items-center justify-between relative overflow-hidden group shadow-2xl"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-3 flex items-center gap-2">
              <svg className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              High-Fidelity Synthesis
            </span>
            <h2 className="text-6xl font-black tracking-tightest text-white uppercase leading-none">
              {agent?.name || 'Sonar'} <span className="text-zinc-600 font-bold opacity-40">Studio</span>
            </h2>
          </div>

          <div 
            onClick={() => !isConnecting && setIsActive(!isActive)}
            className={`relative size-56 rounded-full cursor-pointer transition-all duration-1000 flex items-center justify-center ${
              isActive ? 'scale-105' : 'hover:scale-105 grayscale opacity-60'
            }`}
          >
            {/* AMBIENT RINGS */}
            {isActive && [...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-primary/20"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 3, delay: i * 1, repeat: Infinity, ease: "linear" }}
              />
            ))}

            <div className={`absolute inset-0 rounded-full bg-linear-to-br from-zinc-900 to-black border border-white/10 flex flex-col items-center justify-center transition-all duration-1000 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] ${
              isActive ? 'border-primary/60 ring-4 ring-primary/5 shadow-[0_0_100px_rgba(var(--primary-rgb),0.3)]' : ''
            }`}>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_80%)]" />
              <IntelligencePulse isActive={isActive} />
              {isActive && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 flex flex-col items-center gap-1"
                >
                  <SessionTimer isActive={true} />
                  <span className="text-[8px] font-black text-primary uppercase tracking-widest mt-1">Live Feed</span>
                </motion.div>
              )}
            </div>
          </div>

          <div className="w-full space-y-4">
             <div className="p-4 bg-white/2 border border-white/5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Persona Logic</span>
                   <Brain className="size-3 text-zinc-500" />
                </div>
                <p className="text-[11px] text-zinc-300 font-medium leading-relaxed italic">
                  "{intelligence || 'Awaiting session initialization...'}"
                </p>
             </div>
             <div className="flex items-center gap-3 justify-center">
                <div className="flex items-center gap-1.5 grayscale opacity-50">
                  <Globe className="size-2.5" />
                  <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Multi-Lang</span>
                </div>
                <div className="size-1 rounded-full bg-zinc-800" />
                <div className="flex items-center gap-1.5 grayscale opacity-50">
                  <AudioLines className="size-2.5" />
                  <span className="text-[9px] font-bold uppercase tracking-tighter text-zinc-500">Adaptive HD</span>
                </div>
             </div>
          </div>
        </motion.div>

        {/* SECTION 2: LIVE SESSION FEED */}
        <AnimatePresence>
          {showConsole && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-6"
            >
              {/* TRANSCRIPT PANEL */}
              <div className="h-[520px] shrink-0 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[50px] p-10 flex flex-col relative shadow-2xl overflow-hidden group/transcript">
                <div className="absolute inset-0 bg-linear-to-b from-primary/5 to-transparent opacity-0 group-hover/transcript:opacity-100 transition-opacity duration-1000" />
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-linear-to-br from-primary/20 to-indigo-500/10 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
                       <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          <circle cx="9" cy="10" r="1" />
                          <circle cx="12" cy="10" r="1" />
                          <circle cx="15" cy="10" r="1" />
                       </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Sonar Feedback Matrix</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Executive Interaction Stream</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                       <div className={`size-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                       <span className="text-[9px] font-black uppercase text-zinc-400">{isActive ? 'Session Active' : 'Standby'}</span>
                    </div>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-2">
                  <AnimatePresence mode="wait">
                    {isConnecting ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center text-center space-y-6"
                      >
                        <div className="relative size-16 flex items-center justify-center">
                           <motion.div 
                             animate={{ rotate: 360 }}
                             transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                             className="absolute inset-0 rounded-full border-2 border-primary/10 border-t-primary"
                           />
                           <RefreshCw className="size-6 text-primary animate-spin" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Syncing Persona</h4>
                          <p className="text-[10px] text-zinc-500 font-medium">Initializing high-fidelity session link...</p>
                        </div>
                      </motion.div>
                    ) : isActive ? (
                      <div className="space-y-4">
                        {transcript.map((m, i) => (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: m.speaker === 'user' ? 20 : -20, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                            className={`flex ${m.speaker === 'user' ? 'justify-end' : 'justify-start'} w-full relative z-10`}
                          >
                             <div className={`max-w-[75%] flex flex-col ${m.speaker === 'user' ? 'items-end' : 'items-start'} gap-2`}>
                                <div className={`px-6 py-4 rounded-[30px] text-[13px] font-medium leading-relaxed shadow-2xl backdrop-blur-md ${
                                  m.speaker === 'system' ? 'bg-white/5 border border-white/10 text-primary/60 text-[10px] uppercase font-black tracking-widest' :
                                  m.speaker === 'user' ? 'bg-linear-to-br from-zinc-800 to-zinc-900 text-zinc-200 border border-white/5 rounded-tr-none' : 
                                  'bg-linear-to-br from-primary/30 to-indigo-500/20 border border-primary/40 text-white rounded-tl-none font-semibold'
                                }`}>
                                  {m.text}
                                </div>
                                {m.lang && <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] px-3">{m.lang}</span>}
                             </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-40 grayscale scale-95 transition-all">
                        <div className="size-24 rounded-[32px] bg-zinc-900 border border-white/10 flex items-center justify-center">
                           <Activity className="size-10 text-white/20" />
                        </div>
                        <div className="text-center space-y-2">
                           <h3 className="text-base font-bold text-white uppercase tracking-[0.3em]">Session Ready</h3>
                           <p className="text-[11px] text-zinc-400 font-medium max-w-[240px]">Initialize the session to start high-fidelity agent interactions.</p>
                        </div>
                        <button 
                          onClick={() => {
                            setIsConnecting(true);
                            setTimeout(() => { setIsActive(true); setIsConnecting(false); }, 2000);
                          }}
                          className="px-10 py-4 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-2xl shadow-primary/30"
                        >
                          Start Live Session
                        </button>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* INTELLIGENCE BAR */}
              <div className="flex-1 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 flex items-center gap-8 shadow-2xl">
                 <div className="flex-1 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                       <Sparkles className="size-3 text-primary" />
                       <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Call Insights Feed</span>
                    </div>
                    <div className="space-y-2">
                       {insights.map((item, idx) => (
                         <motion.div 
                           key={idx + item.text}
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           className="flex items-center gap-3"
                         >
                            <span className="text-[9px] font-black text-primary/40 uppercase">[{item.time}]</span>
                            <span className="text-[11px] text-zinc-300 font-semibold truncate">{item.text}</span>
                         </motion.div>
                       ))}
                    </div>
                 </div>
                 <div className="w-px h-12 bg-white/5" />
                 <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                       <div className="relative size-14">
                          <svg className="size-full overflow-visible" viewBox="0 0 100 100">
                             <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                             <motion.circle 
                               cx="50" cy="50" r="42" 
                               fill="none" 
                               stroke="var(--primary)" 
                               strokeWidth="10" 
                               strokeLinecap="round"
                               strokeDasharray={`${(propensity / 100) * 263} 263.8`}
                               transform="rotate(-90 50 50)"
                             />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                             <span className="text-xs font-black text-white">{Math.round(propensity)}%</span>
                          </div>
                       </div>
                       <span className="text-[8px] font-black text-zinc-500 uppercase tracking-tighter">Propensity</span>
                    </div>
                    <div className="flex flex-col gap-2">
                       <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/5 flex items-center gap-2">
                          <Gauge className="size-2.5 text-emerald-500" />
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">Performance: Optimal</span>
                       </div>
                       <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-white/5 flex items-center gap-2">
                          <Zap className="size-2.5 text-amber-500" />
                          <span className="text-[9px] font-bold text-zinc-400 uppercase">Latency: 140ms</span>
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION 3: EXECUTIVE CONTROLS */}
        <AnimatePresence>
          {showConsole && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 flex flex-col gap-8 shadow-2xl relative overflow-auto"
            >
                <div className="flex items-center justify-between">
                   <span className="text-sm font-black text-white uppercase tracking-[0.2em]">Synthesis Lab</span>
                   <div className="size-8 rounded-full bg-white/5 flex items-center justify-center">
                      <Settings className="size-4 text-primary/60 animate-spin-slow" />
                   </div>
                </div>

               <div className="space-y-8">
                  {/* TONE SELECTION */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block px-1">Response Tone</span>
                    <div className="p-1.5 bg-white/5 rounded-2xl border border-white/5 flex gap-1">
                      {['empathetic', 'neutral', 'firm'].map(e => (
                        <button
                          key={e}
                          onClick={() => setTone(e as any)}
                          className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${
                            tone === e ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-zinc-500 hover:text-white'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SESSION LAYERS */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block px-1">Active Layers</span>
                    <div className="grid grid-cols-1 gap-2">
                       <button 
                         onClick={() => setMemoryEnabled(!memoryEnabled)}
                         className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                           memoryEnabled ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/10'
                         }`}
                       >
                          <div className="flex items-center gap-3">
                             <div className={`size-2 rounded-full ${memoryEnabled ? 'bg-primary' : 'bg-zinc-700'}`} />
                             <div className="text-left">
                                <span className="text-[10px] font-bold uppercase text-white tracking-widest block leading-none">Perspective Memory</span>
                                <span className="text-[8px] text-zinc-500 font-medium uppercase mt-1">Contextual Synchronization</span>
                             </div>
                          </div>
                       </button>
                       <button 
                         onClick={() => setComplianceGate(!complianceGate)}
                         className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                           complianceGate ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/10'
                         }`}
                       >
                          <div className="flex items-center gap-3">
                             <div className={`size-2 rounded-full ${complianceGate ? 'bg-primary' : 'bg-zinc-700'}`} />
                             <div className="text-left">
                                <span className="text-[10px] font-bold uppercase text-white tracking-widest block leading-none">Compliance Gate</span>
                                <span className="text-[8px] text-zinc-500 font-medium uppercase mt-1">Regulatory Enforcement</span>
                             </div>
                          </div>
                       </button>
                    </div>
                  </div>

                  {/* VOICE DNA */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block px-1">Personality Matrix</span>
                    <div className="grid grid-cols-1 gap-3">
                       <div className="relative group">
                          <select 
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] font-bold text-white outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                          >
                            <option>Voice: Studio High-Fidelity</option>
                            <option>Voice: Natural Warmth</option>
                            <option>Voice: Executive Neutral</option>
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-3 text-zinc-600 rotate-90" />
                       </div>
                       <div className="relative group">
                          <select 
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-[10px] font-bold text-white outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                          >
                            <option>Session: Hinglish</option>
                            <option>Session: English (Global)</option>
                            <option>Session: Hindi (Regional)</option>
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-3 text-zinc-600 rotate-90" />
                       </div>
                    </div>
                  </div>

                  {/* STRESS TESTING */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block px-1">Stress Testing</span>
                    <div className="grid grid-cols-2 gap-2">
                       <button className="py-3 rounded-2xl border border-white/10 bg-white/5 text-zinc-400 text-[10px] font-black uppercase hover:bg-white hover:text-black transition-all">Interrupt Link</button>
                       <button className="py-3 rounded-2xl border border-white/10 bg-white/5 text-zinc-400 text-[10px] font-black uppercase hover:bg-white hover:text-black transition-all">Switch Language</button>
                    </div>
                  </div>
               </div>

               <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-4">
                  <button 
                    disabled={isConnecting}
                    onClick={() => {
                      resetSession();
                      setIsConnecting(true);
                      setTimeout(() => { setIsActive(true); setIsConnecting(false); }, 2000);
                    }}
                    className="w-full py-5 rounded-[24px] bg-linear-to-r from-primary to-indigo-600 text-white text-[12px] font-black uppercase tracking-widest hover:brightness-125 transition-all flex items-center justify-center gap-3 group shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)]"
                  >
                    <RefreshCw className={`size-4 ${isConnecting ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                    {isConnecting ? 'Synthesizing...' : 'Restart Matrix'}
                  </button>
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-2">
                        <div className="size-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-bold text-zinc-500 uppercase">System Stable</span>
                     </div>
                     <span className="text-[9px] font-mono text-zinc-700">v2.0.4-LATEST</span>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
