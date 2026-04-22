import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
   Zap,
   Mic2,
   Download,
   UserRound,
   Clock,
   ShieldCheck,
   Activity,
   Globe,
   Waves,
   History,
   ChevronRight,
   ChevronLeft,
   Check,
   ArrowRight,
   Search,
   Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStudio, type PersonaProfile } from '../contexts/StudioContext';
import { useNavigate } from 'react-router-dom';

// --- Sub-components ---

const SynthesisCard = ({ persona, isABMode }: { persona: PersonaProfile; isABMode?: boolean }) => {
   const [isPlaying, setIsPlaying] = React.useState(false);
   const [latency, setLatency] = React.useState<number | null>(null);

   const handleGenerate = () => {
      setLatency(null);
      setTimeout(() => {
         setLatency(450 + Math.random() * 200);
         setIsPlaying(true);
      }, 800);
   };

   return (
      <div className={cn(
         "bg-surface-lowest rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden transition-all duration-500 premium-forge-border shadow-xl",
         isABMode ? "flex-1" : "w-full"
      )}>
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="size-10 rounded-xl bg-surface-low border border-white/5 flex items-center justify-center text-primary shadow-inner">
                  <UserRound className="size-5" />
               </div>
               <div>
                  <h3 className="text-base font-headline font-bold">{persona.name}</h3>
                  <p className="text-[9px] font-bold text-outline/50 uppercase tracking-widest">{persona.tone}</p>
               </div>
            </div>
            {latency && (
               <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-bold border border-emerald-500/10"
               >
                  <Clock className="size-3" />
                  {latency.toFixed(0)}MS
               </motion.div>
            )}
         </div>

         <div className="w-full h-24 rounded-2xl bg-surface-low/30 border border-outline-variant/10 flex items-center justify-center px-6 relative overflow-hidden group shadow-inner">
            <div className="flex-1 flex items-center gap-0.5 relative z-10 h-10">
               {[...Array(40)].map((_, i) => (
                  <motion.div
                     key={i}
                     animate={{
                        height: isPlaying ? [4, 24, 8, 32, 4] : 4,
                        opacity: isPlaying ? 1 : 0.2
                     }}
                     transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.04,
                        ease: "easeInOut"
                     }}
                     className="flex-1 rounded-full bg-primary/80"
                  />
               ))}
            </div>
         </div>

         <div className="flex gap-3">
            <button
               onClick={handleGenerate}
               className="flex-1 ember-gradient py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg studio-glow-amber hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
               <Zap className="size-3.5 fill-current" />
               Generate Sample
            </button>
            <button className="p-3 rounded-xl bg-surface-low text-outline hover:text-primary transition-all border border-outline-variant/5">
               <Download className="size-4" />
            </button>
         </div>
      </div>
   );
};

const PersonaControl = ({
   persona,
   isAB,
   onTest,
   isThinking
}: {
   persona: PersonaProfile;
   isAB?: boolean;
   onTest: () => void;
   isThinking: boolean;
}) => {
   return (
      <div className={cn(
         "bg-surface-lowest rounded-4xl p-8 space-y-8 flex flex-col relative overflow-hidden transition-all duration-500 premium-forge-border shadow-xl",
         isAB ? "flex-1" : "w-full"
      )}>
         <div className="flex justify-between items-start">
            <div className="flex gap-4 items-center">
               <div className="size-14 rounded-[1.25rem] bg-surface-low border border-outline-variant/10 flex items-center justify-center text-primary shadow-inner">
                  <UserRound className="size-6" />
               </div>
               <div>
                  <h3 className="text-xl font-headline font-extrabold text-on-surface uppercase tracking-tight">{persona.name}</h3>
                  <div className="flex gap-2 mt-1">
                     <span className="text-[9px] font-bold text-outline uppercase tracking-widest px-2 py-0.5 rounded-md bg-surface-low">{persona.gender || 'Neural'}</span>
                     <span className="text-[9px] font-bold text-primary uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/10">{persona.emotion}</span>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex-1 flex flex-col justify-center items-center py-6">
            <div className="relative group">
               <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full group-hover:scale-110 transition-transform duration-700" />
               <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onTest}
                  className="size-32 rounded-[2.5rem] bg-surface-lowest border border-outline-variant/10 flex items-center justify-center relative z-10 shadow-2xl overflow-hidden"
               >
                  {isThinking ? (
                     <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                           <motion.div
                              key={i}
                              animate={{ height: [10, 30, 10] }}
                              transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                              className="w-1.5 bg-primary rounded-full"
                           />
                        ))}
                     </div>
                  ) : (
                     <Mic2 className="size-10 text-primary" />
                  )}
                  {isThinking && <motion.div className="absolute inset-0 bg-primary/5 animate-pulse" />}
               </motion.button>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-low p-4 rounded-2xl border border-outline-variant/5">
               <p className="text-[8px] font-bold text-outline uppercase tracking-widest mb-1">Clarity Score</p>
               <p className="text-base font-headline font-bold text-on-surface">9.4/10</p>
            </div>
            <div className="bg-surface-low p-4 rounded-2xl border border-outline-variant/5">
               <p className="text-[8px] font-bold text-outline uppercase tracking-widest mb-1">Latency P99</p>
               <p className="text-base font-headline font-bold text-emerald-500">340ms</p>
            </div>
         </div>
      </div>
   );
};

// --- Main Page ---

export default function StudioTest() {
   const { personas, activePersonaId, setActivePersonaId, recordActivity, deployedIds } = useStudio();
   const navigate = useNavigate();

   const [isABMode, setIsABMode] = React.useState(false);
   const [isMirrorMode, setIsMirrorMode] = React.useState(false);
   const [isThinking, setIsThinking] = React.useState(false);
   const [isSimpleMode, setIsSimpleMode] = React.useState(false);
   const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'passed'>('idle');
   const [activeEnv, setActiveEnv] = React.useState('clean');

   const [searchQuery, setSearchQuery] = React.useState('');
   const [personaBId, setPersonaBId] = React.useState(personas[1]?.id || personas[0]?.id);
   const [text, setText] = React.useState("This is a live neural synthesis test. sonix 2.0 ensures latency remains below five hundred milliseconds for real-time conversational triggers.");

   const filteredPersonas = React.useMemo(() =>
      personas.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
      [personas, searchQuery]
   );

   const activePersona = personas.find(p => p.id === activePersonaId) || personas[0];
   const personaB = personas.find(p => p.id === personaBId) || personas[1] || personas[0];

   const handleTriggerMirror = () => {
      setIsThinking(true);
      recordActivity(`Neural Intent: ${activePersona?.name || 'Agent'}`);
      setTimeout(() => {
         setIsThinking(false);
      }, 2500);
   };

   const handleEnvChange = (env: string) => {
      setActiveEnv(env);
      recordActivity(`Environment: ${env.toUpperCase()}`);
   };

   const handleSimpleTest = () => {
      setTestStatus('testing');
      recordActivity(`Testing Persona: ${activePersona?.name}`);
      setTimeout(() => {
         setTestStatus('passed');
         setTimeout(() => setTestStatus('idle'), 3000);
      }, 1500);
   };

   return (
      <div className="flex flex-col gap-6 h-[calc(100vh-120px)] overflow-hidden">
         <div className="flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
               <button
                  onClick={() => navigate(-1)}
                  className="p-2.5 rounded-xl bg-surface-low border border-outline-variant/10 text-outline hover:text-primary transition-all shadow-sm hover:bg-surface-high group"
                  title="Return to Library"
               >
                  <ChevronLeft className="size-5 group-hover:-translate-x-0.5 transition-transform" />
               </button>
               <div className="space-y-0.5">
                  <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em]">Unit Testing</p>
                  <h1 className="text-2xl font-headline font-extrabold text-on-surface uppercase tracking-tight leading-none">Testing Console</h1>
               </div>
            </div>

            <div className="flex gap-4 items-center">
               <button
                  onClick={() => { setIsSimpleMode(!isSimpleMode); setIsMirrorMode(false); setIsABMode(false); }}
                  className={cn(
                     "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border",
                     isSimpleMode
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        : "bg-surface-low border-outline-variant/10 text-outline hover:text-on-surface"
                  )}
               >
                  <Zap className="size-3.5" />
                  {isSimpleMode ? 'Simple: ON' : 'Simple View'}
               </button>

               <div className="h-4 w-px bg-outline-variant/10" />

               <div className="flex p-0.5 bg-surface-low rounded-lg border border-outline-variant/5">
                  <button
                     onClick={() => { setIsABMode(false); setIsMirrorMode(false); setIsSimpleMode(false); }}
                     className={cn(
                        "px-4 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
                        (!isABMode && !isMirrorMode && !isSimpleMode) ? "bg-surface-lowest text-primary shadow-sm" : "text-outline hover:text-on-surface"
                     )}
                  >
                     Standard
                  </button>
                  <button
                     onClick={() => { setIsMirrorMode(true); setIsABMode(false); setIsSimpleMode(false); }}
                     className={cn(
                        "px-4 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
                        isMirrorMode ? "bg-primary/10 text-primary shadow-sm" : "text-outline hover:text-on-surface"
                     )}
                  >
                     Mirror
                  </button>
                  <button
                     onClick={() => { setIsABMode(true); setIsMirrorMode(false); setIsSimpleMode(false); }}
                     className={cn(
                        "px-4 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
                        isABMode ? "bg-surface-lowest text-primary shadow-sm" : "text-outline hover:text-on-surface"
                     )}
                  >
                     A/B Compare
                  </button>
               </div>
            </div>
         </div>

         <div className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
               {isSimpleMode ? (
                  <motion.div
                     key="simple-view"
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -20 }}
                     className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto w-full space-y-12"
                  >
                     <div className="text-center space-y-4">
                        <div className="size-20 rounded-3xl bg-surface-low border border-outline-variant/10 flex items-center justify-center mx-auto shadow-inner">
                           <Mic2 className="size-10 text-primary" />
                        </div>
                        <div>
                           <h2 className="text-3xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Rapid Validation</h2>
                           <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">Direct Neural-to-Audio Output</p>
                        </div>
                     </div>

                     <div className="w-full space-y-8 bg-surface-low/30 p-10 rounded-[3rem] border border-outline-variant/5 shadow-2xl relative overflow-hidden">
                        <textarea
                           value={text}
                           onChange={e => setText(e.target.value)}
                           placeholder="Type here to test synthesis..."
                           className="w-full bg-transparent border-none text-2xl font-bold text-on-surface placeholder:text-outline/20 resize-none min-h-[160px] outline-none text-center"
                        />

                        <div className="flex flex-col items-center gap-6">
                           <button
                              onClick={handleSimpleTest}
                              disabled={testStatus === 'testing'}
                              className={cn(
                                 "w-full max-w-sm py-5 rounded-2xl font-bold text-[12px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                                 testStatus === 'testing' ? "bg-outline/20 text-outline cursor-wait" :
                                    testStatus === 'passed' ? "bg-emerald-500 text-on-primary-fixed shadow-[0_0_20px_rgba(16,185,129,0.3)]" :
                                       "ember-gradient studio-glow-amber shadow-xl hover:scale-105"
                              )}
                           >
                              {testStatus === 'testing' ? (
                                 <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="size-4 border-2 border-outline/50 border-t-outline rounded-full" />
                              ) : testStatus === 'passed' ? (
                                 <Check className="size-5" />
                              ) : (
                                 <Zap className="size-4 fill-current" />
                              )}
                              {testStatus === 'testing' ? 'Synthesizing...' : testStatus === 'passed' ? 'Synthesis Passed' : 'Test Persona Output'}
                           </button>

                           {testStatus === 'passed' && (
                              <motion.p
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2"
                              >
                                 Latency: 382ms | Quality Score: 9.8/10
                              </motion.p>
                           )}
                        </div>
                     </div>

                     <div className="flex gap-4">
                        <div className="px-6 py-2 rounded-full bg-surface-low border border-outline-variant/10 flex items-center gap-3">
                           <span className="text-[9px] font-bold text-outline uppercase">Target Agent:</span>
                           <span className="text-[10px] font-bold text-on-surface uppercase tracking-widest">{activePersona.name}</span>
                        </div>
                     </div>
                  </motion.div>
               ) : isMirrorMode ? (
                  <motion.div
                     key="mirror-view"
                     initial={{ opacity: 0, scale: 0.98 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.98 }}
                     className="h-full grid grid-cols-12 gap-8"
                  >
                     <div className="col-span-12 lg:col-span-8 h-full flex flex-col gap-6">
                        <div className="flex-1 bg-surface-lowest rounded-3xl p-10 border border-outline-variant/10 flex flex-col gap-12 relative overflow-hidden premium-forge-border shadow-2xl">
                           <div className="absolute inset-0 bg-primary/2 animate-pulse" />
                           <div className="flex-1 flex flex-col justify-center items-center gap-10">
                              <div className="relative group">
                                 <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/30 transition-all" />
                                 <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleTriggerMirror}
                                    className="size-48 rounded-[3rem] bg-surface-lowest border border-primary/20 flex items-center justify-center relative z-10 shadow-3xl hover:border-primary/40 transition-all"
                                 >
                                    {isThinking ? (
                                       <div className="flex gap-1.5">
                                          {[...Array(4)].map((_, i) => (
                                             <motion.div
                                                key={i}
                                                animate={{ height: [10, 40, 10] }}
                                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                                                className="w-2 bg-primary rounded-full shadow-[0_0_15px_rgba(255,193,7,0.3)]"
                                             />
                                          ))}
                                       </div>
                                    ) : (
                                       <div className="relative">
                                          <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
                                          <Mic2 className="size-16 text-primary relative z-10" />
                                       </div>
                                    )}
                                 </motion.button>
                              </div>
                              <p className="text-[10px] font-bold text-outline uppercase tracking-[0.4em] animate-pulse">
                                 {isThinking ? 'Processing Neural Intent...' : 'Inbound Focus Active'}
                              </p>
                           </div>
                           <div className="flex items-center justify-between mt-auto pt-8 border-t border-outline-variant/10">
                              <div className="flex items-center gap-6">
                                 <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Realtime Sync</span>
                                 </div>
                                 <button onClick={() => recordActivity('Exported Mirror Session')} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-outline hover:text-primary transition-all">
                                    <ArrowRight className="size-3" />
                                    Export Synthesis
                                 </button>
                              </div>
                              <div className="px-4 py-1.5 rounded-lg bg-surface-low border border-outline-variant/5 text-[10px] font-bold text-on-surface uppercase tracking-widest">
                                 {activePersona.name}
                              </div>
                           </div>
                        </div>
                        <div className="bg-surface-low/30 rounded-3xl p-6 border border-outline-variant/10 flex gap-6 items-center">
                           <div className="flex-1 space-y-2">
                              <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Neural Mirror Prompt</p>
                              <textarea
                                 value={text}
                                 onChange={e => setText(e.target.value)}
                                 className="w-full bg-surface-low/50 border border-outline-variant/5 rounded-2xl p-4 text-[11px] font-medium outline-none focus:border-primary/20 transition-all min-h-[60px] shadow-inner"
                              />
                           </div>
                        </div>
                     </div>
                     <div className="col-span-12 lg:col-span-4 space-y-6 overflow-y-auto pr-1 scrollbar-hide">
                        <div className="bg-surface-lowest rounded-3xl p-6 border border-outline-variant/10 space-y-6 shadow-sm">
                           <div className="flex flex-col gap-1">
                              <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Environment Tuning</p>
                              <h3 className="text-base font-headline font-extrabold text-on-surface uppercase tracking-tight leading-none">Audio Simulation</h3>
                           </div>
                           <div className="grid grid-cols-1 gap-2">
                              {[
                                 { id: 'clean', label: 'Studio Clean', icon: ShieldCheck, color: 'text-emerald-500' },
                                 { id: 'office', label: 'Office Ambient', icon: Activity, color: 'text-primary' },
                                 { id: 'transit', label: 'Public Transit', icon: Globe, color: 'text-blue-500' },
                              ].map(env => (
                                 <button
                                    key={env.id}
                                    onClick={() => handleEnvChange(env.id)}
                                    className={cn(
                                       "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                                       activeEnv === env.id
                                          ? "bg-surface-low border-primary/40 shadow-lg"
                                          : "bg-surface-low/50 border-outline-variant/5 text-outline hover:bg-surface-high"
                                    )}
                                 >
                                    <div className="flex items-center gap-3">
                                       <env.icon className={cn("size-4", activeEnv === env.id ? env.color : "text-outline")} />
                                       <span className={cn("text-[10px] font-bold uppercase tracking-widest", activeEnv === env.id ? "text-on-surface" : "text-outline")}>{env.label}</span>
                                    </div>
                                    {activeEnv === env.id && <div className="size-1.5 rounded-full bg-primary" />}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>
                  </motion.div>
               ) : (
                  <motion.div
                     key="standard-view"
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="h-full grid grid-cols-12 gap-8"
                  >
                     <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
                        <div className="bg-surface-lowest rounded-4xl p-6 border border-outline-variant/10 shadow-sm flex flex-col flex-1 min-h-0">
                           <div className="flex justify-between items-center mb-4 shrink-0">
                              <label className="text-[9px] font-bold text-primary uppercase tracking-[0.3em]">Sample Text Input</label>
                              <p className="text-[9px] font-mono text-outline">{text.length} CHR</p>
                           </div>
                           <textarea
                              className="w-full bg-surface-low/50 border border-outline-variant/5 rounded-2xl p-6 text-xl font-headline outline-none focus:border-primary/30 transition-all resize-none shadow-inner leading-relaxed flex-1"
                              value={text}
                              onChange={e => setText(e.target.value)}
                              placeholder="Enter script to synthesize..."
                           />
                        </div>
                        <div className={cn("flex gap-6 shrink-0", isABMode ? "flex-row" : "flex-col")}>
                           <SynthesisCard persona={activePersona} isABMode={isABMode} />
                           {isABMode && <SynthesisCard persona={personaB} isABMode={isABMode} />}
                        </div>
                     </div>

                     <div className="col-span-12 lg:col-span-4 h-full overflow-y-auto pr-1 scrollbar-hide">
                        <div className="bg-surface-lowest rounded-3xl p-6 space-y-8 border border-outline-variant/10 shadow-sm flex flex-col h-full">
                           <div className="space-y-4 flex flex-col min-h-0 flex-1">
                              <div className="flex justify-between items-end">
                                 <p className="text-[9px] font-bold text-outline uppercase tracking-[0.2em]">Neural Fleet</p>
                                 <span className="text-[9px] font-mono text-primary">{filteredPersonas.length} Match</span>
                              </div>
                              <div className="relative">
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-outline" />
                                 <input
                                    type="text"
                                    placeholder="Find agent..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-surface-low border border-outline-variant/5 rounded-xl pl-9 pr-3 py-2 text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary/20 transition-all shadow-inner"
                                 />
                              </div>
                              <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-hide">
                                 {filteredPersonas.map(p => (
                                    <button
                                       key={p.id}
                                       onClick={() => isABMode ? setPersonaBId(p.id) : setActivePersonaId(p.id)}
                                       className={cn(
                                          "w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all group",
                                          (activePersonaId === p.id || (isABMode && personaBId === p.id))
                                             ? "bg-primary/5 border-primary/20 text-on-surface ring-1 ring-primary/20"
                                             : "bg-surface-low border-outline-variant/5 text-outline hover:border-outline-variant/20 hover:bg-surface-high"
                                       )}
                                    >
                                       <div className="flex items-center gap-3">
                                          <div className={cn("size-6 rounded-lg flex items-center justify-center text-[10px] font-bold", p.themeColor === 'amber' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>
                                             {p.name.charAt(0)}
                                          </div>
                                          <div>
                                             <p className="text-[10px] font-bold leading-none">{p.name}</p>
                                             <p className="text-[8px] opacity-70 mt-0.5">{p.language}</p>
                                          </div>
                                       </div>
                                       {deployedIds?.includes(p.id) && (
                                          <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                       )}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="pt-8 border-t border-outline-variant/10 space-y-4 shrink-0">
                              <div className="flex items-center justify-between">
                                 <p className="text-[9px] font-bold text-outline uppercase tracking-[0.2em]">Environment Sim</p>
                                 <Waves className="size-3.5 text-primary" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                 {['Office', 'Transit', 'Retail', 'Studio'].map(env => (
                                    <button
                                       key={env}
                                       onClick={() => handleEnvChange(env.toLowerCase())}
                                       className={cn(
                                          "px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-widest transition-all text-center",
                                          activeEnv === env.toLowerCase() ? "ember-gradient border-primary" : "bg-surface-low border-outline-variant/5 text-outline hover:text-primary hover:border-primary/20"
                                       )}
                                    >
                                       {env}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="pt-8 border-t border-outline-variant/10 space-y-4">
                              <p className="text-[9px] font-bold text-outline uppercase tracking-[0.2em]">Debug History</p>
                              <button
                                 onClick={() => recordActivity('Testing Logs Exported')}
                                 className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-low hover:bg-surface-high text-outline hover:text-on-surface transition-all group border border-outline-variant/5 shadow-sm"
                              >
                                 <div className="flex items-center gap-3">
                                    <History className="size-4" />
                                    <span className="text-[10px] font-bold">Validation Logs</span>
                                 </div>
                                 <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
                              </button>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>
   );
}
