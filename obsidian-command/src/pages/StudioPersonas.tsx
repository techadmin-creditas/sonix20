import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
   Plus,
   Search,
   Filter,
   X,
   Save,
   Check,
   Mic2,
   ChevronRight,
   UserRound,
   Edit2,
   Trash2,
   Cpu,
   Zap,
   ShieldCheck,
   Activity,
   ArrowRight,
   BrainCircuit,
   Settings2,
   Sparkles,
   Loader2,
   RefreshCw,
   AlertTriangle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { VOICE_RELAYS } from '../data/voiceData';
import { StudioSlider } from '../components/StudioSlider';
import { api, type AiPersona } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// QuickForgeView — multi-step persona builder form
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_FORM = {
   name: '',
   gender: 'Female' as AiPersona['gender'],
   tone: 'Warm · Empathetic',
   stability: 80,
   clarity: 60,
   emotion: 'Empathetic',
   selectedVoice: 'v1',
   urgency: 45,
   empathy: 75,
   styleExaggeration: 35,
   baseModel: 'Sonix-Flash-1',
   useCase: '',
   language: 'English',
   psychology: '',
};

const QuickForgeView = ({
   onClose,
   onSave,
   initialPersona,
   isSaving,
}: {
   onClose: () => void;
   onSave: (p: Partial<AiPersona>) => void;
   initialPersona?: Partial<AiPersona> | null;
   isSaving: boolean;
}) => {
   const [step, setStep] = React.useState(1);
   const [isScanning, setIsScanning] = React.useState(false);
   const [showAdvanced, setShowAdvanced] = React.useState(false);
   const [formData, setFormData] = React.useState<Partial<AiPersona>>(
      initialPersona ? { ...INITIAL_FORM, ...initialPersona } : { ...INITIAL_FORM }
   );

   React.useEffect(() => {
      setStep(1);
      setFormData(initialPersona ? { ...INITIAL_FORM, ...initialPersona } : { ...INITIAL_FORM });
   }, [initialPersona]);

   const handleNext = () => {
      if (step === 1 || step === 2) {
         setIsScanning(true);
         setTimeout(() => {
            setStep(prev => prev + 1);
            setIsScanning(false);
         }, 1200);
      } else {
         setStep(prev => prev + 1);
      }
   };

   const handleBack = () => setStep(prev => Math.max(1, prev - 1));

   const patch = (val: Partial<AiPersona>) => setFormData(prev => ({ ...prev, ...val }));

   return (
      <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto py-4">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
               <button
                  onClick={onClose}
                  className="p-3 rounded-xl bg-surface-low hover:bg-surface-high border border-outline-variant/10 transition-all text-outline group"
               >
                  <X className="size-4 group-hover:text-primary transition-colors" />
               </button>
               <div className="h-8 w-px bg-outline-variant/10" />
               <div>
                  <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em]">Persona Builder</p>
                  <div className="flex items-center gap-3">
                     <h2 className="text-2xl font-headline font-extrabold text-on-surface uppercase tracking-tight line-clamp-1">
                        {initialPersona?.id ? 'Edit AI Persona' : 'Create AI Persona'}
                     </h2>
                     <div className="flex items-center gap-2">
                        <button
                           onClick={() => setShowAdvanced(!showAdvanced)}
                           className={cn(
                              "px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border transition-all",
                              showAdvanced
                                 ? "bg-primary text-on-primary-fixed border-primary shadow-[0_0_10px_rgba(255,193,7,0.3)]"
                                 : "bg-surface-low border-outline-variant/10 text-outline hover:text-on-surface"
                           )}
                        >
                           {showAdvanced ? 'Advanced Tuning: ON' : 'Show Advanced'}
                        </button>
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                           <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest">
                              {formData.baseModel || 'Sonix-Flash-1'} Active
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-3 bg-surface-low/50 p-1 rounded-xl border border-outline-variant/5">
               {[1, 2, 3, 4].map((s) => (
                  <div
                     key={s}
                     className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                        step === s ? "bg-primary text-on-primary-fixed shadow-lg" : "text-outline/40"
                     )}
                  >
                     Step 0{s}
                  </div>
               ))}
            </div>
         </div>

         <div className="bg-surface-lowest rounded-[2.5rem] overflow-hidden flex flex-col premium-forge-border shadow-2xl relative">
            <div className="h-1.5 w-full bg-surface-low flex">
               <motion.div
                  className="h-full bg-primary shadow-[0_0_10px_var(--primary)]"
                  animate={{ width: `${(step / 4) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
               />
            </div>

            <div className="p-8 space-y-6 relative min-h-[520px] flex flex-col justify-center">
               <AnimatePresence>
                  {isScanning && (
                     <motion.div
                        initial={{ top: '-10%', opacity: 0 }}
                        animate={{ top: '110%', opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "linear" }}
                        className="absolute inset-x-0 h-20 bg-primary/20 blur-2xl z-20 pointer-events-none"
                     >
                        <div className="h-px w-full bg-primary/50 shadow-[0_0_20px_rgba(255,193,7,0.5)]" />
                     </motion.div>
                  )}
               </AnimatePresence>

               <AnimatePresence mode="wait">
                  {/* ── Step 1: Identity & Role ── */}
                  {step === 1 && (
                     <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="space-y-8"
                     >
                        <div className="mb-6">
                           <h2 className="text-xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Identity & Role</h2>
                           <p className="text-[9px] font-bold text-outline uppercase tracking-widest mt-0.5">Primary identifier and neural baseline</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-6">
                              <div className="space-y-2">
                                 <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Persona Name</label>
                                 <input
                                    type="text"
                                    autoFocus
                                    placeholder="Maya / Arjun / Priya..."
                                    className="w-full bg-surface-low border border-outline-variant/10 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                    value={formData.name || ''}
                                    onChange={e => patch({ name: e.target.value })}
                                 />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Primary Objective</label>
                                 <input
                                    type="text"
                                    placeholder="Debt Collection / Sales / Support..."
                                    className="w-full bg-surface-low border border-outline-variant/10 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                    value={formData.useCase || ''}
                                    onChange={e => patch({ useCase: e.target.value })}
                                 />
                              </div>
                           </div>
                           <div className="space-y-4">
                              <div className="space-y-2">
                                 <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Linguistic Objective</label>
                                 <div className="flex flex-wrap gap-2">
                                    {['English', 'Hindi', 'Hinglish', 'Tamil', 'Telugu'].map(lang => (
                                       <button
                                          key={lang}
                                          onClick={() => patch({ language: lang })}
                                          className={cn(
                                             "px-4 py-2 rounded-lg text-[9px] font-bold border transition-all",
                                             formData.language === lang
                                                ? "bg-primary/10 border-primary/20 text-primary shadow-sm"
                                                : "bg-surface-low border-outline-variant/5 text-outline hover:border-outline-variant/20"
                                          )}
                                       >
                                          {lang}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Talking Style</label>
                                 <div className="grid grid-cols-2 gap-2">
                                    {['Analytical', 'Casual', 'Empathetic', 'Firm'].map(st => (
                                       <button
                                          key={st}
                                          onClick={() => patch({ emotion: st })}
                                          className={cn(
                                             "p-3.5 rounded-lg text-[10px] font-bold border transition-all truncate",
                                             formData.emotion === st
                                                ? "bg-primary/10 border-primary/20 text-primary"
                                                : "bg-surface-low border-outline-variant/5 text-outline hover:border-outline-variant/20"
                                          )}
                                       >
                                          {st}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {/* ── Step 2: Soul Alignment ── */}
                  {step === 2 && (
                     <motion.div
                        key="step2"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
                     >
                        <div className="flex flex-col items-center text-center space-y-4">
                           <div className="size-44 rounded-full border-2 border-primary/10 flex items-center justify-center relative shadow-2xl">
                              <motion.div
                                 animate={{ scale: [1, 1.1, 1], rotate: 360 }}
                                 transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                 className="absolute inset-0 rounded-full border-t-2 border-primary shadow-[0_0_30px_rgba(255,193,7,0.3)]"
                              />
                              <BrainCircuit className="size-14 text-primary animate-pulse" />
                           </div>
                           <div>
                              <h2 className="text-2xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Soul Alignment</h2>
                              <p className="text-[9px] font-bold text-outline uppercase tracking-[0.3em]">Fine-tuning behavioral neural intent</p>
                           </div>
                        </div>
                        <div className="space-y-6 bg-surface-low/30 p-6 rounded-3xl border border-outline-variant/5">
                           <StudioSlider label="Urgency Profile" value={formData.urgency ?? 45} onChange={v => patch({ urgency: v })} leftLabel="Patient" rightLabel="Aggressive" />
                           <StudioSlider label="Empathy Depth" value={formData.empathy ?? 75} onChange={v => patch({ empathy: v })} leftLabel="Rational" rightLabel="Warm" />
                        </div>
                     </motion.div>
                  )}

                  {/* ── Step 3: Sonic DNA ── */}
                  {step === 3 && (
                     <motion.div
                        key="step3"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-10"
                     >
                        <div className="flex justify-between items-end border-b border-outline-variant/10 pb-6">
                           <div className="space-y-1">
                              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.4em]">Neural Texture</p>
                              <h2 className="text-2xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Sonic DNA Layering</h2>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-8 bg-surface-low/20 p-6 rounded-3xl border border-outline-variant/5">
                              <StudioSlider label="Stability" value={formData.stability ?? 80} onChange={v => patch({ stability: v })} leftLabel="Variable" rightLabel="Monotone" />
                              <StudioSlider label="Clarity" value={formData.clarity ?? 60} onChange={v => patch({ clarity: v })} leftLabel="Natural" rightLabel="Crystalline" />
                           </div>
                           <div className="space-y-8 bg-surface-low/20 p-6 rounded-3xl border border-outline-variant/5">
                              <StudioSlider label="Style Exaggeration" value={formData.styleExaggeration ?? 35} onChange={v => patch({ styleExaggeration: v })} leftLabel="Subtle" rightLabel="Extreme" />
                              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                                 <div className="flex gap-3 items-start">
                                    <Zap className="size-4 text-primary shrink-0 mt-1" />
                                    <p className="text-[10px] leading-relaxed text-outline">Neural textures are being synthesized in real-time. Changes here affect the persona's base resonance at the molecular audio level.</p>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {/* ── Step 4: Final Synthesis ── */}
                  {step === 4 && (
                     <motion.div
                        key="step4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-10"
                     >
                        <div className="space-y-6">
                           <div>
                              <h2 className="text-xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Final Synthesis</h2>
                              <p className="text-[9px] font-bold text-outline uppercase tracking-widest mt-0.5">Review vocal profile & deployment nodes</p>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Selected Voice Relay</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {VOICE_RELAYS.slice(0, 4).map(v => (
                                    <button
                                       key={v.id}
                                       onClick={() => patch({ selectedVoice: v.id })}
                                       className={cn(
                                          "p-3 rounded-xl border flex flex-col gap-1.5 transition-all text-left",
                                          formData.selectedVoice === v.id
                                             ? "bg-primary/5 border-primary/30 shadow-lg ring-1 ring-primary/20"
                                             : "bg-surface-low border-outline-variant/5 text-outline hover:bg-surface-high"
                                       )}
                                    >
                                       <Mic2 className={cn("size-3.5", formData.selectedVoice === v.id ? 'text-primary' : 'text-outline')} />
                                       <div>
                                          <p className={cn("text-[11px] font-bold", formData.selectedVoice === v.id ? 'text-on-surface' : 'text-outline')}>{v.name}</p>
                                          <p className="text-[7px] uppercase tracking-widest font-bold opacity-60">{v.provider}</p>
                                       </div>
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        {/* Neural Certificate */}
                        <div className="space-y-6">
                           <div className="bg-surface-low/80 backdrop-blur-sm rounded-3xl p-6 border border-outline-variant/10 shadow-sm relative overflow-hidden h-full flex flex-col">
                              <div className="absolute top-0 right-0 p-4">
                                 <ShieldCheck className="size-4 text-emerald-500" />
                              </div>
                              <p className="text-[8px] font-bold text-primary uppercase tracking-[0.4em] mb-4">Neural Certificate</p>
                              <div className="flex-1 space-y-6">
                                 <div className="space-y-2">
                                    <p className="text-[7px] font-bold text-outline uppercase tracking-widest">Linguistic Objective</p>
                                    <div className="flex items-center justify-between">
                                       <div>
                                          <h4 className="text-base font-headline font-extrabold text-on-surface">{formData.name}</h4>
                                          <p className="text-[8px] font-bold text-primary uppercase tracking-widest">{formData.language}</p>
                                       </div>
                                       <span className="px-1.5 py-0.5 rounded bg-surface-lowest border border-outline-variant/5 text-[7px] font-bold text-outline uppercase">
                                          {formData.useCase || 'General Agent'}
                                       </span>
                                    </div>
                                 </div>
                                 <div className="space-y-2">
                                    <p className="text-[7px] font-bold text-outline uppercase tracking-widest">Behavioral DNA</p>
                                    <div className="grid grid-cols-2 gap-3">
                                       <div className="p-2.5 rounded-xl bg-surface-lowest border border-outline-variant/5">
                                          <p className="text-[7px] font-bold text-outline uppercase mb-1">Urgency</p>
                                          <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                                             <div className="h-full bg-primary" style={{ width: `${formData.urgency}%` }} />
                                          </div>
                                       </div>
                                       <div className="p-2.5 rounded-xl bg-surface-lowest border border-outline-variant/5">
                                          <p className="text-[7px] font-bold text-outline uppercase mb-1">Empathy</p>
                                          <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                                             <div className="h-full bg-emerald-500" style={{ width: `${formData.empathy}%` }} />
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="space-y-2 pt-3 border-t border-outline-variant/10">
                                    <p className="text-[7px] font-bold text-primary uppercase tracking-widest">Neural Infrastructure</p>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                                       <div className="flex items-center gap-2.5">
                                          <Cpu className="size-3.5 text-primary" />
                                          <div>
                                             <p className="text-[8px] font-bold text-on-surface uppercase leading-none">{formData.baseModel || 'Sonix-Flash-1'}</p>
                                             <p className="text-[6px] font-bold text-primary uppercase mt-1">Cloud Relay Active</p>
                                          </div>
                                       </div>
                                       <div className="text-right">
                                          <p className="text-[8px] font-headline font-bold text-on-surface">350ms</p>
                                          <p className="text-[6px] font-bold text-outline uppercase mt-1">P99 Target</p>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-outline-variant/5">
                                 <p className="text-[9px] leading-relaxed italic text-outline/80">&ldquo;Synthesizing {formData.emotion?.toLowerCase() || 'neutral'} intent...&rdquo;</p>
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>

               {/* Advanced Technical Tuning Overlay */}
               <AnimatePresence>
                  {showAdvanced && (
                     <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute inset-0 z-30 bg-surface-lowest/95 backdrop-blur-md p-10 flex flex-col"
                     >
                        <div className="flex justify-between items-center mb-10 border-b border-outline-variant/10 pb-6">
                           <div>
                              <h3 className="text-xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Advanced Technical Tuning</h3>
                              <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-1">Configure models & external relays</p>
                           </div>
                           <button onClick={() => setShowAdvanced(false)} className="p-2 rounded-lg hover:bg-surface-low text-outline"><X className="size-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-10 flex-1 overflow-y-auto pr-4 scrollbar-hide">
                           <div className="space-y-6">
                              <div className="space-y-3">
                                 <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Base Neural Model</label>
                                 <div className="grid grid-cols-1 gap-2">
                                    {['Sonix-Flash-1', 'Sonix-Pro-3', 'Eleven-Turbo-v2.5'].map(m => (
                                       <button
                                          key={m}
                                          onClick={() => patch({ baseModel: m })}
                                          className={cn(
                                             "p-4 rounded-xl border flex justify-between items-center transition-all",
                                             formData.baseModel === m
                                                ? "bg-primary/10 border-primary/30 text-primary"
                                                : "bg-surface-low border-outline-variant/5 text-outline"
                                          )}
                                       >
                                          <span className="text-[11px] font-bold">{m}</span>
                                          {formData.baseModel === m && <ShieldCheck className="size-3.5" />}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-6">
                              <div className="p-6 rounded-2xl bg-surface-low border border-outline-variant/10 space-y-4">
                                 <div className="flex items-center gap-3">
                                    <Settings2 className="size-4 text-primary" />
                                    <h4 className="text-[10px] font-bold text-on-surface uppercase tracking-widest">API Configuration</h4>
                                 </div>
                                 <div className="space-y-3">
                                    <input placeholder="External API Endpoint (Optional)" className="w-full bg-surface-lowest p-3 rounded-lg text-[10px] border border-outline-variant/5 outline-none focus:border-primary/30 transition-all font-mono" />
                                    <input type="password" placeholder="System Auth Token" className="w-full bg-surface-lowest p-3 rounded-lg text-[10px] border border-outline-variant/5 outline-none focus:border-primary/30 transition-all font-mono" />
                                 </div>
                              </div>
                              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 space-y-2">
                                 <p className="text-[10px] font-bold text-primary uppercase">Expert Control</p>
                                 <p className="text-[9px] leading-relaxed text-outline">These settings bypass the standard Soul Alignment logic and interact directly with the hardware acceleration layer.</p>
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>

            {/* Action Hub */}
            <div className="p-8 bg-surface-low/80 border-t border-outline-variant/20 flex gap-4">
               {step > 1 && (
                  <button
                     onClick={handleBack}
                     className="flex-1 py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] bg-surface-low border border-outline-variant/10 text-outline hover:text-on-surface transition-all"
                  >
                     Back
                  </button>
               )}
               {step < 4 ? (
                  <button
                     onClick={handleNext}
                     disabled={step === 1 && !formData.name?.trim()}
                     className={cn(
                        "flex-2 py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl relative overflow-hidden",
                        (step === 1 && !formData.name?.trim())
                           ? "bg-outline/20 text-outline cursor-not-allowed opacity-50"
                           : "bg-primary text-on-primary-fixed studio-glow-amber hover:scale-105"
                     )}
                  >
                     <span className="relative z-10 flex items-center gap-3">
                        {step === 1 ? 'Analyze DNA' : step === 2 ? 'Calibrate Soul' : 'Finalize Synthesis'}
                        <ArrowRight className="size-4" />
                     </span>
                  </button>
               ) : (
                  <button
                     disabled={isSaving}
                     onClick={() => {
                        const urgLabel = (formData.urgency ?? 45) > 70 ? 'assertive' : (formData.urgency ?? 45) > 30 ? 'balanced' : 'deliberate';
                        const empLabel = (formData.empathy ?? 75) > 70 ? 'high-resonance' : (formData.empathy ?? 75) > 30 ? 'measured' : 'analytical';
                        const finalPersona: Partial<AiPersona> = {
                           ...formData,
                           useCase: formData.useCase || `${formData.emotion} Agent`,
                           psychology: `Synthesizing ${formData.emotion?.toLowerCase() || 'neutral'} intent with ${urgLabel} urgency and ${empLabel} empathy profiles.`,
                           tone: `${formData.emotion || 'Neural'} · ${formData.baseModel?.split('-')[1] || 'Neural'}`,
                        };
                        onSave(finalPersona);
                     }}
                     className={cn(
                        "flex-2 py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] bg-primary text-on-primary-fixed studio-glow-amber shadow-xl transition-all flex items-center justify-center gap-3",
                        isSaving ? "opacity-60 cursor-not-allowed" : "hover:scale-105 active:scale-95"
                     )}
                  >
                     {isSaving ? (
                        <><Loader2 className="size-4 animate-spin" /> Deploying...</>
                     ) : (
                        <><Save className="size-4" /> Finalize & Deploy Agent</>
                     )}
                  </button>
               )}
            </div>
         </div>
      </div>
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// PersonaCard — individual card with edit / activate / delete
// ─────────────────────────────────────────────────────────────────────────────

const PersonaCard = ({
   persona,
   index,
   onEdit,
   onDelete,
   onToggleDeploy,
   isDeleting,
   isToggling,
}: {
   key?: React.Key;
   persona: AiPersona;
   index: number;
   onEdit: (p: AiPersona) => void;
   onDelete: (p: AiPersona) => void | Promise<void>;
   onToggleDeploy: (p: AiPersona) => void | Promise<void>;
   isDeleting: boolean;
   isToggling: boolean;
}) => (
   <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-surface-lowest rounded-4xl p-6 group relative overflow-hidden transition-all border border-outline-variant/10 hover:border-primary/30 shadow-sm hover:shadow-xl"
   >
      {/* Header */}
      <div className="flex justify-between items-center mb-6 relative z-10 border-b border-outline-variant/5 pb-4">
         <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-surface-low border border-outline-variant/5 flex items-center justify-center text-primary shadow-inner group-hover:bg-primary/5 transition-colors">
               <UserRound className="size-7" />
            </div>
            <div>
               <h3 className="text-lg font-headline font-extrabold text-on-surface">{persona.name}</h3>
               <div className="flex items-center gap-2">
                  <p className="text-[9px] font-bold text-primary uppercase tracking-widest">{persona.language}</p>
                  {persona.isDeployed && (
                     <>
                        <span className="size-1 rounded-full bg-primary pulse-neural" />
                        <span className="text-[8px] font-bold text-primary uppercase">Active</span>
                     </>
                  )}
                  {!persona.isActive && (
                     <span className="text-[8px] font-bold text-outline uppercase bg-outline/10 px-1.5 py-0.5 rounded">Inactive</span>
                  )}
               </div>
            </div>
         </div>

         {/* Action buttons */}
         <div className="flex gap-1.5">
            <button
               onClick={() => onEdit(persona)}
               className="p-2.5 rounded-lg bg-surface-low hover:bg-surface-high text-outline hover:text-primary transition-all border border-outline-variant/10 shadow-sm"
               title="Edit Persona"
            >
               <Edit2 className="size-3.5" />
            </button>
            <button
               onClick={() => onDelete(persona)}
               disabled={isDeleting}
               className="p-2.5 rounded-lg bg-surface-low hover:bg-error/10 text-outline hover:text-error transition-all border border-outline-variant/10 shadow-sm disabled:opacity-50"
               title="Delete Persona"
            >
               {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </button>
         </div>
      </div>

      {/* Body */}
      <div className="space-y-4 relative z-10">
         <p className="text-[11px] font-medium leading-relaxed line-clamp-2 text-outline/80">{persona.tone} · {persona.useCase}</p>

         <div className="p-4 rounded-2xl bg-surface-low/50 border border-outline-variant/5 group-hover:bg-surface-low transition-colors">
            <p className="text-[10px] leading-relaxed italic text-on-surface-variant line-clamp-2">
               &ldquo;{persona.psychology || 'Neural persona profile loaded.'}&rdquo;
            </p>
         </div>

         {/* Behavioral stats */}
         <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-surface-low/50 border border-outline-variant/5">
               <p className="text-[7px] font-bold text-outline uppercase mb-1.5 flex items-center gap-1"><Activity className="size-2.5" /> Urgency</p>
               <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${persona.urgency ?? 45}%` }} />
               </div>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-low/50 border border-outline-variant/5">
               <p className="text-[7px] font-bold text-outline uppercase mb-1.5 flex items-center gap-1"><Sparkles className="size-2.5" /> Empathy</p>
               <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${persona.empathy ?? 75}%` }} />
               </div>
            </div>
         </div>

         {/* Deploy / Decommission */}
         <button
            onClick={() => onToggleDeploy(persona)}
            disabled={isToggling}
            className={cn(
               "w-full flex items-center justify-between p-3.5 rounded-xl transition-all group/btn border disabled:opacity-60",
               persona.isDeployed
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-surface-low hover:bg-primary text-outline hover:text-on-primary-fixed border-outline-variant/5"
            )}
         >
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
               {persona.isDeployed ? 'Decommission Node' : 'Activate Persona'}
            </span>
            {isToggling
               ? <Loader2 className="size-3.5 animate-spin" />
               : persona.isDeployed
                  ? <Check className="size-3.5" />
                  : <ChevronRight className="size-3.5 group-hover/btn:translate-x-1 transition-transform" />
            }
         </button>
      </div>
   </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDATIONS = [
   { name: 'Hardship Advisor', trigger: 'DPD 120+', voice: 'v1', emotion: 'Empathetic' },
   { name: 'Early Bird', trigger: 'DPD -5', voice: 'v2', emotion: 'Firm' },
   { name: 'Loyalty Guide', trigger: 'Churn Risk', voice: 'v3', emotion: 'Analytical' },
];

export default function StudioPersonas() {
   const [personas, setPersonas] = React.useState<AiPersona[]>([]);
   const [isLoading, setIsLoading] = React.useState(true);
   const [loadError, setLoadError] = React.useState<string | null>(null);
   const [isForgeMode, setIsForgeMode] = React.useState(false);
   const [editingPersona, setEditingPersona] = React.useState<AiPersona | null>(null);
   const [search, setSearch] = React.useState('');
   const [isSaving, setIsSaving] = React.useState(false);
   const [deletingId, setDeletingId] = React.useState<string | null>(null);
   const [togglingId, setTogglingId] = React.useState<string | null>(null);

   // ── Load personas from API ──
   const loadPersonas = React.useCallback(async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
         const data = await api.listAiPersonas();
         setPersonas(data);
      } catch (e: any) {
         setLoadError(e?.message || 'Failed to load personas');
      } finally {
         setIsLoading(false);
      }
   }, []);

   React.useEffect(() => { loadPersonas(); }, [loadPersonas]);

   // ── Save (create / update) ──
   const handleSave = async (formData: Partial<AiPersona>) => {
      setIsSaving(true);
      try {
         if (editingPersona?.id) {
            const updated = await api.updateAiPersona(editingPersona.id, formData);
            setPersonas(prev => prev.map(p => p.id === updated.id ? updated : p));
         } else {
            const created = await api.createAiPersona(formData);
            setPersonas(prev => [created, ...prev]);
         }
         setIsForgeMode(false);
         setEditingPersona(null);
      } catch (e: any) {
         alert(e?.message || 'Failed to save persona');
      } finally {
         setIsSaving(false);
      }
   };

   // ── Delete ──
   const handleDelete = async (persona: AiPersona) => {
      if (!confirm(`Delete "${persona.name}"? This cannot be undone.`)) return;
      setDeletingId(persona.id);
      try {
         await api.deleteAiPersona(persona.id);
         setPersonas(prev => prev.filter(p => p.id !== persona.id));
      } catch (e: any) {
         alert(e?.message || 'Failed to delete persona');
      } finally {
         setDeletingId(null);
      }
   };

   // ── Toggle deploy ──
   const handleToggleDeploy = async (persona: AiPersona) => {
      setTogglingId(persona.id);
      try {
         const updated = await api.toggleAiPersonaDeploy(persona.id);
         setPersonas(prev => prev.map(p => p.id === updated.id ? updated : p));
      } catch (e: any) {
         alert(e?.message || 'Failed to toggle persona');
      } finally {
         setTogglingId(null);
      }
   };

   // ── Suggest & adopt ──
   const handleSuggest = (rec: typeof RECOMMENDATIONS[0]) => {
      setEditingPersona({
         name: rec.name,
         useCase: rec.trigger,
         selectedVoice: rec.voice,
         emotion: rec.emotion,
      } as AiPersona);
      setIsForgeMode(true);
   };

   // ── Forge mode ──
   if (isForgeMode) {
      return (
         <QuickForgeView
            onClose={() => { setIsForgeMode(false); setEditingPersona(null); }}
            initialPersona={editingPersona}
            onSave={handleSave}
            isSaving={isSaving}
         />
      );
   }

   const filtered = personas.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.useCase || '').toLowerCase().includes(search.toLowerCase())
   );

   // ── Loading state ──
   if (isLoading) {
      return (
         <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="size-16 rounded-full border-2 border-primary/20 flex items-center justify-center relative">
               <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border-t-2 border-primary"
               />
               <BrainCircuit className="size-7 text-primary/60" />
            </div>
            <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Loading Neural Registry...</p>
         </div>
      );
   }

   // ── Error state ──
   if (loadError) {
      return (
         <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
            <div className="size-16 rounded-full bg-error/10 border border-error/20 flex items-center justify-center">
               <AlertTriangle className="size-7 text-error" />
            </div>
            <div className="text-center">
               <p className="text-sm font-bold text-on-surface">Failed to load personas</p>
               <p className="text-[10px] text-outline mt-1">{loadError}</p>
            </div>
            <button
               onClick={loadPersonas}
               className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary-fixed rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all"
            >
               <RefreshCw className="size-3.5" /> Retry
            </button>
         </div>
      );
   }

   return (
      <div className="space-y-10">
         {/* Top bar */}
         <div className="flex justify-between items-start border-b border-outline-variant/10 pb-8">
            <div className="space-y-1">
               <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em]">Neural Registry</p>
               <h1 className="text-3xl font-headline font-extrabold text-on-surface uppercase tracking-tight">
                  {personas.length} Voice Agents Deployed
               </h1>
               <p className="text-[10px] text-outline font-medium max-w-md uppercase tracking-widest leading-relaxed">
                  Manage and create your AI voice agents. <span className="text-primary">Active capacity: {personas.length}/500</span>
               </p>
            </div>
            <div className="flex items-center gap-3">
               <button
                  onClick={loadPersonas}
                  className="p-2.5 rounded-xl bg-surface-low border border-outline-variant/10 text-outline hover:text-primary transition-all"
                  title="Refresh"
               >
                  <RefreshCw className="size-4" />
               </button>
               <button
                  onClick={() => { setEditingPersona(null); setIsForgeMode(true); }}
                  className="flex items-center gap-2.5 bg-primary text-on-primary-fixed px-8 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-primary/10 hover:scale-105 active:scale-95 transition-all"
               >
                  <Plus className="size-4" />
                  Create New Persona
               </button>
            </div>
         </div>

         {/* Search + Recommendations */}
         <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex gap-3 p-1.5 bg-surface-low rounded-2xl border border-outline-variant/10 shadow-sm">
               <div className="flex-1 flex items-center gap-2 px-3">
                  <Search className="size-3.5 text-outline" />
                  <input
                     type="text"
                     placeholder="Search personas by name or use case..."
                     className="bg-transparent border-none focus:ring-0 text-xs flex-1 shadow-none outline-none"
                     value={search}
                     onChange={e => setSearch(e.target.value)}
                  />
               </div>
               {search && (
                  <button onClick={() => setSearch('')} className="p-2 text-outline hover:text-on-surface">
                     <X className="size-3.5" />
                  </button>
               )}
               <button className="p-2.5 bg-surface-lowest rounded-xl text-outline hover:text-on-surface border border-outline-variant/5 transition-all">
                  <Filter className="size-3.5" />
               </button>
            </div>

            <div className="flex gap-2 scrollbar-hide overflow-x-auto">
               {RECOMMENDATIONS.map((rec, i) => (
                  <button
                     key={i}
                     onClick={() => handleSuggest(rec)}
                     className="flex items-center gap-3 px-4 py-2 rounded-xl bg-surface-low border border-outline-variant/5 whitespace-nowrap group hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer shadow-sm"
                  >
                     <Sparkles className="size-3 text-primary" />
                     <div className="text-left">
                        <p className="text-[8px] font-bold text-outline uppercase tracking-tighter">Suggest & Adopt</p>
                        <p className="text-[10px] font-bold group-hover:text-primary transition-colors">{rec.name}</p>
                     </div>
                  </button>
               ))}
            </div>
         </div>

         {/* Stats bar */}
         {personas.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
               {[
                  { label: 'Total Personas', value: personas.length, icon: UserRound },
                  { label: 'Deployed', value: personas.filter(p => p.isDeployed).length, icon: Activity },
                  { label: 'Active', value: personas.filter(p => p.isActive).length, icon: Cpu },
               ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-surface-lowest rounded-2xl p-4 border border-outline-variant/10 flex items-center gap-4">
                     <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="size-4 text-primary" />
                     </div>
                     <div>
                        <p className="text-[8px] font-bold text-outline uppercase tracking-widest">{label}</p>
                        <p className="text-2xl font-headline font-extrabold text-on-surface">{value}</p>
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Grid */}
         {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
               <div className="size-20 rounded-3xl bg-surface-low border border-outline-variant/10 flex items-center justify-center">
                  <UserRound className="size-9 text-outline/40" />
               </div>
               <div className="text-center">
                  <p className="text-base font-bold text-on-surface">
                     {search ? `No personas match "${search}"` : 'No personas yet'}
                  </p>
                  <p className="text-[11px] text-outline mt-1">
                     {search ? 'Try a different search term' : 'Create your first AI persona to get started'}
                  </p>
               </div>
               {!search && (
                  <button
                     onClick={() => setIsForgeMode(true)}
                     className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary-fixed rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all mt-2"
                  >
                     <Plus className="size-4" /> Create First Persona
                  </button>
               )}
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
               {filtered.map((persona, i) => (
                  <PersonaCard
                     key={persona.id}
                     persona={persona}
                     index={i}
                     onEdit={p => { setEditingPersona(p); setIsForgeMode(true); }}
                     onDelete={handleDelete}
                     onToggleDeploy={handleToggleDeploy}
                     isDeleting={deletingId === persona.id}
                     isToggling={togglingId === persona.id}
                  />
               ))}
            </div>
         )}
      </div>
   );
}
