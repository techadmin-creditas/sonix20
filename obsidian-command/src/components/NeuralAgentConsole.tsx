import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Shield, Terminal, Send, ChevronRight, MessageSquareCode, Settings, Zap, Languages, Mic, Sparkles, Brain, Info, RefreshCw } from 'lucide-react';
import gsap from 'gsap';

interface NeuralAgentConsoleProps {
  className?: string;
  agent?: any;
}

// STATIC DATA EVICTION: Moving heavy data outside component to prevent re-declarations
const REASONING_LOGS = [
  "Analyzing baseline tone...",
  "Detected borrower frustration level @ 0.72",
  "Switching to Empathetic Logic Kernel V2",
  "Mapping context: Overdue Payment ($1,420)",
  "Calculated Probablity of PTP: 78%",
  "Bypassing defensive bias... deploying neutral inquiry.",
  "Detected Code-Switch: English to Hindi.",
  "Vernacular Profile Synced: Hinglish (Mumbai)",
  "Compliance Check: RBI disclosure complete.",
  "Intelligence Audit: Intent classified as 'Willing to Pay'."
];

const MOCK_CALL = [
  { speaker: 'bot', text: 'Namaste, kya meri baat Mr. Rohan se ho rahi hai?', lang: 'hindi' },
  { speaker: 'user', text: 'Haan bol raha hoon, kaun?', lang: 'hindi' },
  { speaker: 'bot', text: 'I am calling from Sonix Finance. Aapka loan payment pending hai.', lang: 'hinglish' },
  { speaker: 'user', text: 'Mera payment ho gaya hai last week! Check handle karo na.', lang: 'hinglish' },
  { speaker: 'bot', text: 'Oh, I see. Let me verify the records instantly. Ek minute rukiye.', lang: 'hinglish' },
  { speaker: 'bot', text: 'Detected verification delay... referencing Call #1 context.', lang: 'system' }
];

const MOCK_SUMMARY = [
  "Verified Customer Identity",
  "Loss of Job identified as difficulty",
  "Confirmed current address: Mumbai",
  "Willingness to pay: HIGH",
  "Installment Plan V1 offered",
  "Compliance: RBI Disclosures complete"
];

// SUB-COMPONENT: ISOLATED TACTICAL CLOCK (Prevents global re-renders every 1s)
const TacticalClock = React.memo(({ isActive }: { isActive: boolean }) => {
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
    <span className="text-[8px] font-black text-on-surface-variant uppercase tabular-nums">
      {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
    </span>
  );
});

const NeuralWaveform = React.memo(({ isActive }: { isActive: boolean }) => {
  const waveRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!waveRef.current) return;
    const paths = waveRef.current.querySelectorAll('path');
    
    gsap.to(paths, {
      duration: isActive ? 1.2 : 4,
      attr: { 
        d: (i) => {
          const amp = isActive ? 35 : 5;
          return `M0,50 Q12.5,${50 - amp} 25,50 T50,50 T75,50 T100,50`;
        }
      },
      opacity: isActive ? 0.8 : 0.2,
      stagger: {
        each: 0.2,
        repeat: -1,
        yoyo: true
      },
      ease: "sine.inOut"
    });
  }, [isActive]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg ref={waveRef} className="w-full h-full p-4" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0,50 Q25,50 50,50 T100,50" fill="none" stroke="var(--primary)" strokeWidth="0.5" />
        <path d="M0,50 Q25,50 50,50 T100,50" fill="none" stroke="var(--primary)" strokeWidth="0.3" opacity="0.5" />
      </svg>
    </div>
  );
});

export const NeuralAgentConsole: React.FC<NeuralAgentConsoleProps> = ({ className, agent }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showControlRoom, setShowControlRoom] = useState(false);
  const [chaosMode, setChaosMode] = useState<'neutral' | 'interrupt' | 'lang-flip'>('neutral');
  const [transcript, setTranscript] = useState<any[]>([]);
  const [reasoning, setReasoning] = useState<string>("");
  const [propensity, setPropensity] = useState(64);
  const [summary, setSummary] = useState<{time: string, text: string}[]>([]);
  
  // Experiment States
  const [emotion, setEmotion] = useState<'empathetic' | 'neutral' | 'firm'>('neutral');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('Professional Female');
  const [selectedLanguage, setSelectedLanguage] = useState('Hinglish (Default)');
  const [vocalSpeed, setVocalSpeed] = useState<'normal' | 'fast'>('normal');
  const [inferenceLatency, setInferenceLatency] = useState<'low' | 'med'>('low');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const tIdx = useRef(0);
  const rIdx = useRef(0);

  const handleHardReset = () => {
    setIsActive(false);
    setIsConnecting(false);
    setShowControlRoom(false);
    setTranscript([]);
    setSummary([]);
    setPropensity(50);
    tIdx.current = 0;
    rIdx.current = 0;
  };

  // REVEAL ENGINE: Synchronized 3-Panel Expansion & Persistence
  useEffect(() => {
    if (isActive) {
      setShowControlRoom(true);
      if (summary.length === 0) {
        setSummary([{ time: '0:00', text: 'Neural Interface Initialized' }]);
      }
    } else if (transcript.length === 0) {
      setShowControlRoom(false);
    }
  }, [isActive, transcript.length]);

  // HARD RESET on Persona Swap
  useEffect(() => {
    if (agent?.id) {
      handleHardReset();
    }
  }, [agent?.id]);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcript]);

  // Data Generation Loop V2 (Intelligence & Confidence with Warm Start)
  useEffect(() => {
    if (isActive) {
      const updateData = () => {
        if (tIdx.current === 0 && summary.length === 0) {
          setSummary([{ time: '0:00', text: 'Neural Interface Initialized' }]);
        }

        const currentMsg = MOCK_CALL[tIdx.current % MOCK_CALL.length];
        
        // Update Transcript & Data
        setTranscript(prev => [...prev, currentMsg].slice(-8));
        setReasoning(REASONING_LOGS[rIdx.current % REASONING_LOGS.length]);
        
        setPropensity(prev => {
          const delta = (Math.random() - 0.4) * 8; 
          return Math.max(20, Math.min(98, prev + delta));
        });

        // HARD-SYNC: Summary updates specifically on Bot/System transitions
        if (currentMsg.speaker === 'bot' || currentMsg.speaker === 'system') {
          const time = 'Live'; // Tactical label
          setSummary(prevSum => [...prevSum.slice(-3), { time, text: MOCK_SUMMARY[rIdx.current % MOCK_SUMMARY.length] }]);
        }

        tIdx.current++;
        rIdx.current++;
      };

      if (tIdx.current === 0) updateData();
      const interval = setInterval(updateData, 3000);
      return () => clearInterval(interval);
    }
  }, [isActive]);


  return (
    <div className={`relative w-full mx-auto min-h-[600px] flex items-center justify-center p-6 ${className}`}>
      {/* SOMATIC HAPTIC PULSE */}
      <AnimatePresence>
        {isActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              boxShadow: "inset 0 0 100px color-mix(in srgb, var(--primary) 10%, transparent)"
            }}
          >
            <motion.div 
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-radial-at-c from-primary/5 to-transparent blur-3xl"
            />
          </motion.div>
        )}
      </AnimatePresence>


      <motion.div 
        layout
        className="relative z-10 w-full grid gap-6 transition-all duration-1000 items-start h-[650px]"
        style={{ 
          gridTemplateColumns: showControlRoom ? '0.8fr 1.2fr 0.7fr' : '1fr',
          maxWidth: showControlRoom ? '1400px' : '800px'
        }}
      >
        {/* PANEL 1: THE SOUL (LEFT) */}
        <motion.div 
          layout
          className={`bg-black/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[40px] p-8 flex flex-col items-center justify-center space-y-8 h-full relative overflow-hidden transition-all duration-1000 ${showControlRoom ? 'scale-90' : 'scale-100'}`}
        >
          <AnimatePresence>
            {chaosMode !== 'neutral' && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-6 px-4 py-1.5 rounded-full border border-primary bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest z-50 flex items-center gap-2"
              >
                {chaosMode === 'interrupt' ? 'CHAOS: Interruption Injection' : 'CHAOS: Language Pivot'}
              </motion.div>
            )}
          </AnimatePresence>

          <div 
            onClick={() => setIsActive(!isActive)}
            className={`relative size-60 rounded-full cursor-pointer group transition-all duration-1000 ${isActive ? 'scale-105 shadow-[0_0_80px_color-mix(in srgb, var(--primary) 15%, transparent)]' : 'hover:scale-105 opacity-80'}`}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-primary/20"
                animate={{
                  scale: isActive ? [1, 1.3 + (i * 0.1), 1] : [1, 1.1, 1],
                  opacity: isActive ? [0.4, 0, 0.4] : [0.1, 0, 0.1],
                }}
                transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
              />
            ))}

            <div className={`absolute inset-4 rounded-full bg-background border-2 border-outline flex items-center justify-center overflow-hidden transition-all duration-700 ${isActive ? 'border-primary ring-20 ring-primary/5 shadow-2xl shadow-primary/20' : ''}`}>
               <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)]" />
               <Activity className={`size-16 transition-all duration-700 ${isActive ? 'text-primary scale-125' : 'text-on-surface-variant/40'}`} />
               
                <NeuralWaveform isActive={isActive} />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h2 className="text-xl font-black text-on-surface tracking-tighter">
              {agent?.name ? <span className="text-primary uppercase">{agent.name}</span> : 'ASTRA'} 2.0
            </h2>
            <div className="flex flex-col items-center gap-2">
               <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-on-surface-variant">
                 <Shield className="size-2.5 text-primary" /> Secure Encryption
               </span>
               <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-on-surface-variant">
                 <Languages className="size-2.5 text-primary" /> Vernacular Active
               </span>
            </div>
          </div>
        </motion.div>

        {/* PANEL 2: THE NARRATIVE & INTELLIGENCE (CENTER) */}
        <AnimatePresence>
          {showControlRoom && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-5 h-full"
            >
              {/* BLOCK 1: TRANSCRIPT */}
              <div className="flex-2 bg-zinc-950/80 border border-zinc-800 rounded-[32px] p-6 flex flex-col relative overflow-hidden h-[380px]">
                <div className="flex items-center justify-between mb-4 shrink-0 px-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-on-surface-variant flex items-center gap-2">
                    <Terminal className="size-3 text-primary" /> 
                    {isActive ? 'Liquid Transcript' : 'Forensic Audit'}
                  </span>
                  <div className="flex items-center gap-2">
                    {!isActive && transcript.length > 0 && (
                      <span className="text-[7px] font-black text-on-primary-fixed bg-primary px-2 py-0.5 rounded uppercase flex items-center gap-1">
                        <Info className="size-2 text-on-primary-fixed" /> Session Frozen
                      </span>
                    )}
                    <div className={`size-1.5 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-outline'}`} />
                    <TacticalClock isActive={isActive} />
                  </div>
                </div>
                
                <div 
                  ref={scrollRef}
                  className="flex-1 space-y-4 overflow-y-auto no-scrollbar scroll-smooth pr-2 relative"
                >
                   <AnimatePresence mode="wait">
                     {isConnecting ? (
                       <motion.div 
                         key="loader"
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0 }}
                         className="absolute inset-0 flex flex-col items-center justify-center bg-surface-lowest/20 backdrop-blur-sm z-50 rounded-[32px] p-12"
                       >
                          <div className="w-full max-w-[280px] space-y-4">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">CALIBRATING_DNA</span>
                                <span className="text-[10px] font-mono text-primary/50">84%</span>
                             </div>
                             <div className="h-1 w-full bg-surface-low overflow-hidden rounded-full border border-outline/20">
                                <motion.div 
                                  initial={{ x: '-100%' }}
                                  animate={{ x: '0%' }}
                                  transition={{ duration: 2.5, ease: "easeInOut" }}
                                  className="h-full w-full bg-linear-to-r from-primary to-primary/60 shadow-[0_0_15px_color-mix(in srgb, var(--primary) 40%, transparent)]"
                                />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="animate-pulse space-y-1">
                                   <div className="h-1 w-full bg-zinc-800 rounded-full" />
                                   <div className="h-1 w-3/4 bg-zinc-800 rounded-full" />
                                </div>
                                <div className="animate-pulse space-y-1 delay-150">
                                   <div className="h-1 w-full bg-zinc-800 rounded-full" />
                                   <div className="h-1 w-1/2 bg-zinc-800 rounded-full" />
                                </div>
                             </div>
                          </div>
                       </motion.div>
                     ) : isActive ? (
                       <div key="active-transcript" className="space-y-4">
                         {transcript.map((m, i) => (
                           <motion.div 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={i}
                              className={`flex flex-col ${m.speaker === 'user' ? 'items-end' : 'items-start'}`}
                           >
                              <div className={`max-w-[90%] p-3 rounded-2xl text-xs transition-all duration-500 ${
                                m.speaker === 'system' ? 'bg-primary/5 text-primary font-mono text-[9px] uppercase border border-primary/10' :
                                m.speaker === 'user' ? 'bg-surface-low border border-outline/20 text-on-surface-variant' : 
                                'bg-primary/10 border border-primary/20 text-on-surface shadow-[0_0_20px_color-mix(in srgb, var(--primary) 5%, transparent)]'
                              }`}>
                                {m.text}
                                {m.lang && (
                                  <span className="block mt-1 text-[7px] opacity-30 uppercase font-black tracking-widest">{m.lang}</span>
                                )}
                              </div>
                           </motion.div>
                         ))}
                       </div>
                     ) : (
                       <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key="idle"
                          className="absolute inset-0 flex flex-col items-center justify-center space-y-6 bg-surface-lowest/40 backdrop-blur-sm z-50 rounded-3xl"
                        >
                          <div className="size-20 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center relative">
                             <motion.div 
                               animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                               transition={{ duration: 2, repeat: Infinity }}
                               className="absolute inset-0 rounded-full bg-primary/20"
                             />
                             <Activity className="size-8 text-primary" />
                          </div>
                          <div className="text-center">
                             <h3 className="text-sm font-black text-on-surface uppercase tracking-widest mb-1">Link Status: Ready</h3>
                             <p className="text-[10px] text-on-surface-variant font-medium max-w-[200px]">Configuration Loaded. Awaiting Neural Link Initialization.</p>
                          </div>
                          <button 
                            onClick={() => {
                               setIsConnecting(true);
                               setTimeout(() => {
                                  setIsActive(true);
                                  setIsConnecting(false);
                               }, 2500);
                            }}
                            className="px-8 py-3 rounded-full bg-primary text-on-primary-fixed text-[10px] font-black uppercase tracking-widest hover:bg-on-surface hover:text-background transition-all shadow-xl shadow-primary/20 active:scale-95"
                          >
                            Initialize Neural Link
                          </button>
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
              </div>

              {/* BLOCK 2: INTELLIGENCE HUB (SPLIT) */}
               <div className="flex-1 bg-surface-lowest/50 border border-outline/50 rounded-[32px] p-5 flex gap-4 min-h-[160px]">
                  {/* LIVE SUMMARY TICKER */}
                  <div className="flex-[1.5] flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="size-3 text-primary" />
                      <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">Live Summary Feed</span>
                    </div>
                   <div className="space-y-2 overflow-hidden">
                     <AnimatePresence mode="popLayout">
                       {summary.map((item, idx) => (
                          <motion.div 
                            key={idx + item.text}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex gap-2 text-[10px] items-start"
                          >
                            <span className="font-mono text-primary/50 shrink-0">[{item.time}]</span>
                            <span className="text-on-surface-variant font-medium leading-tight">{item.text}</span>
                          </motion.div>
                       ))}
                     </AnimatePresence>
                   </div>
                 </div>

                 {/* CIRCULAR PROPENSITY GAUGE */}
                  <div className="flex-1 flex flex-col items-center justify-center border-l border-outline/50 pl-4 py-2 relative">
                     <span className="absolute top-0 right-0 text-[8px] font-black text-on-surface-variant uppercase tracking-widest">Confidence</span>
                    <div className="relative size-24">
                      {/* Gauge Base */}
                      <svg className="size-full overflow-visible" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#18181b" strokeWidth="8" strokeDasharray="212 282.7" strokeLinecap="round" transform="rotate(135 50 50)" />
                        {/* Progress */}
                         <motion.circle 
                           cx="50" cy="50" r="45" 
                           fill="none" 
                           stroke={propensity > 70 ? "#10b981" : propensity > 40 ? "var(--primary)" : "#ef4444"} 
                           strokeWidth="8" 
                           strokeLinecap="round"
                           strokeDasharray={`${(propensity / 100) * 212} 282.7`}
                          transform="rotate(135 50 50)"
                          transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                        {/* Needle */}
                        <motion.line 
                          x1="50" y1="50" x2="50" y2="15" 
                          stroke="white" strokeWidth="2" strokeLinecap="round"
                          animate={{ rotate: -135 + (propensity / 100) * 270 }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                           style={{ originX: "50px", originY: "50px" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                        <span className="text-xl font-black text-on-surface tabular-nums leading-none">{Math.round(propensity)}%</span>
                        <span className="text-[7px] font-bold text-on-surface-variant uppercase tracking-tighter">Propensity</span>
                      </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PANEL 3: THE EXPERIMENT LAB (RIGHT) */}
        <AnimatePresence>
          {showControlRoom && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-6 h-full"
            >
              {/* LAB TACTICAL SWITCHBOARD */}
              <div className="flex-1 bg-surface border border-outline rounded-[32px] p-6 flex flex-col gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 size-32 bg-primary/5 blur-[60px] rounded-full" />
                
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary flex items-center gap-2">
                    <Sparkles className="size-3" /> Experiment Lab
                  </span>
                  <Settings className="size-3 text-on-surface-variant/40 animate-spin-slow" />
                </div>

                <div className="space-y-5 overflow-y-auto no-scrollbar pb-4 pr-1">
                  {/* SECTOR A: EMOTION DNA */}
                   <div className="space-y-2">
                    <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest block px-1">Response Tone</span>
                    <div className="p-1 bg-surface-low rounded-2xl border border-outline/20 flex gap-1">
                      {['empathetic', 'neutral', 'firm'].map(e => (
                        <button
                          key={e}
                          onClick={() => setEmotion(e as any)}
                          className={`flex-1 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all ${
                            emotion === e ? 'bg-primary text-on-primary-fixed shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SECTOR B: COGNITIVE OVERRIDE */}
                   <div className="space-y-2">
                    <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest block px-1">Neural Layers</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setMemoryEnabled(!memoryEnabled)}
                        className={`flex flex-col gap-1 p-3 rounded-2xl border transition-all text-left ${
                          memoryEnabled ? 'bg-primary/10 border-primary/30' : 'bg-surface-low border-outline/20'
                        }`}
                      >
                         <div className={`size-1.5 rounded-full ${memoryEnabled ? 'bg-primary' : 'bg-outline'}`} />
                         <span className="text-[9px] font-black uppercase text-on-surface tracking-tighter leading-none mt-1">Memory</span>
                         <span className="text-[7px] text-on-surface-variant font-bold uppercase tracking-tight">Contextual Sync</span>
                      </button>
                      
                      <button 
                        onClick={() => setGuardrailsEnabled(!guardrailsEnabled)}
                        className={`flex flex-col gap-1 p-3 rounded-2xl border transition-all text-left ${
                          guardrailsEnabled ? 'bg-primary/10 border-primary/30' : 'bg-surface-low border-outline/20'
                        }`}
                      >
                         <div className={`size-1.5 rounded-full ${guardrailsEnabled ? 'bg-primary' : 'bg-outline'}`} />
                         <span className="text-[9px] font-black uppercase text-on-surface tracking-tighter leading-none mt-1">Safety</span>
                         <span className="text-[7px] text-on-surface-variant font-bold uppercase tracking-tight">Compliance Gate</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTOR C: VOCAL DYNAMICS */}
                   <div className="space-y-2">
                    <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest block px-1">Voice & Language DNA</span>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select 
                          value={selectedVoice}
                          onChange={(e) => setSelectedVoice(e.target.value)}
                          className="w-full bg-surface-lowest border border-outline/20 rounded-xl p-2.5 text-[9px] font-bold text-on-surface outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                        >
                          <option>Voice: Astra V4</option>
                          <option>Voice: Echo V4</option>
                          <option>Voice: Nova V4</option>
                        </select>
                        <select 
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="w-full bg-surface-lowest border border-outline/20 rounded-xl p-2.5 text-[9px] font-bold text-on-surface outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                        >
                          <option>L: Hinglish</option>
                          <option>L: English</option>
                          <option>L: Hindi</option>
                          <option>L: Spanish</option>
                        </select>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setVocalSpeed(vocalSpeed === 'normal' ? 'fast' : 'normal')}
                          className={`flex-1 py-2 rounded-xl border text-[8px] font-black uppercase transition-all ${
                            vocalSpeed === 'fast' ? 'bg-on-surface text-background border-on-surface' : 'bg-surface-lowest border-outline/20 text-on-surface-variant'
                          }`}
                        >
                          {vocalSpeed === 'fast' ? 'Rate: 1.5x' : 'Rate: 1.0x'}
                        </button>
                        <button 
                          onClick={() => setInferenceLatency(inferenceLatency === 'low' ? 'med' : 'low')}
                          className={`flex-1 py-2 rounded-xl border text-[8px] font-black uppercase transition-all ${
                            inferenceLatency === 'low' ? 'border-primary/50 text-primary bg-primary/5' : 'bg-surface-lowest border-outline/20 text-on-surface-variant'
                          }`}
                        >
                          {inferenceLatency === 'low' ? 'Edge Latency' : 'Cloud Latency'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SECTOR D: CHAOS INJECTION */}
                   <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest block">Stress Testing</span>
                      <div className="flex gap-1">
                         <div className="size-1 rounded-full bg-primary animate-pulse" />
                         <span className="text-[6px] text-on-surface-variant/40 font-bold uppercase">Ready</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <button 
                        onClick={() => setChaosMode('interrupt')}
                        className="py-2.5 rounded-xl border border-outline/20 bg-surface-low/30 text-on-surface-variant text-[8px] font-black uppercase hover:bg-red-500 hover:text-white hover:border-red-600 transition-all"
                       >
                         Interrupt
                       </button>
                       <button 
                        onClick={() => setChaosMode('lang-flip')}
                        className="py-2.5 rounded-xl border border-outline/20 bg-surface-low/30 text-on-surface-variant text-[8px] font-black uppercase hover:bg-primary hover:text-on-primary-fixed hover:border-primary-container transition-all"
                       >
                         Lang Flip
                       </button>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-outline/50 flex flex-col gap-3">
                   {/* THE MANUAL APPLY TRIGGER */}
                   <button 
                     disabled={isConnecting}
                     onClick={() => {
                        handleHardReset();
                        setIsConnecting(true);
                        setTimeout(() => {
                           setIsActive(true);
                           setIsConnecting(false);
                        }, 2500);
                     }}
                     className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                        isConnecting 
                        ? 'bg-surface-low text-on-surface-variant/40 border border-outline/20 cursor-not-allowed' 
                        : 'bg-primary text-on-primary-fixed hover:bg-on-surface hover:text-background shadow-primary/10'
                     }`}
                   >
                     {isConnecting ? <RefreshCw className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                     {isConnecting ? 'Calibrating...' : 'Re-Trigger Simulation'}
                   </button>

                   <div className="flex items-center gap-2">
                     <Brain className="size-3 text-primary/50" />
                     <span className="text-[8px] font-black uppercase text-on-surface-variant tracking-[0.2em]">Neural_Status</span>
                   </div>
                   <p className="text-[9px] font-mono text-primary/60 uppercase px-1 line-clamp-1">
                     {reasoning}
                   </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
