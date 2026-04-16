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
   Languages,
   Ghost,
   Globe2,
   Brain,
   Coffee,
   Heart,
   Shield,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { VOICE_RELAYS } from '../data/voiceData';
import { StudioSlider } from '../components/StudioSlider';
import { api, type AiPersona } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// QuickForgeView — streamlined persona builder form
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
   const [isScanning, setIsScanning] = React.useState(false);
   const [showAdvanced, setShowAdvanced] = React.useState(true);
   const [formData, setFormData] = React.useState<Partial<AiPersona>>(
      initialPersona ? { ...INITIAL_FORM, ...initialPersona } : { ...INITIAL_FORM }
   );

   React.useEffect(() => {
      setFormData(initialPersona ? { ...INITIAL_FORM, ...initialPersona } : { ...INITIAL_FORM });
   }, [initialPersona]);

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
               <div className="space-y-1">
                  <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em]">Persona Forge</p>
                  <div className="flex items-center gap-4">
                     <h2 className="text-2xl font-headline font-extrabold text-on-surface uppercase tracking-tight line-clamp-1">
                        {initialPersona?.id ? 'Edit AI Persona' : 'Create AI Persona'}
                     </h2>
                     <div className="flex items-center gap-2">
                        {/* <button
                           onClick={() => setShowAdvanced(!showAdvanced)}
                           className={cn(
                              "px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2",
                              showAdvanced
                                 ? "bg-primary text-on-primary-fixed border-primary shadow-[0_0_15px_rgba(255,193,7,0.4)]"
                                 : "bg-surface-low border-outline-variant/10 text-outline hover:text-on-surface hover:border-outline-variant/30"
                           )}
                        >
                           <Settings2 className={cn("size-3.5", showAdvanced ? "animate-spin-slow" : "")} />
                           {showAdvanced ? 'Advanced Tuning: ON' : 'Show Advanced Tuning'}
                        </button> */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                           <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest">
                              {formData.baseModel || 'Sonix-Flash-1'} Node Active
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-surface-lowest/95 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden flex flex-col border border-outline-variant/10 shadow-2xl relative group/forge">
            <div className="h-1 w-full bg-gradient-to-r from-primary/5 via-primary to-primary/5" />

            <div className="px-8 py-7 space-y-8 relative flex flex-col">
               <AnimatePresence>
                  {isScanning && (
                     <motion.div
                        initial={{ top: '-10%', opacity: 0 }}
                        animate={{ top: '110%', opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "linear" }}
                        className="absolute inset-x-0 h-32 bg-primary/20 blur-[100px] z-20 pointer-events-none"
                     >
                        <div className="h-px w-full bg-primary/50 shadow-[0_0_30px_rgba(255,193,7,0.8)]" />
                     </motion.div>
                  )}
               </AnimatePresence>

               <AnimatePresence mode="wait">
                  <motion.div
                     key="main-forge"
                     initial={{ opacity: 0, y: 15 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -15 }}
                     className="space-y-8"
                  >
                     {/* Core Identity & Resonance Node */}
                     <section className="space-y-6 relative">
                        <div className="flex justify-between items-end border-b border-outline-variant/10 pb-5">
                           <div className="flex items-center gap-4">
                              <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(255,193,7,0.1)]">
                                 <BrainCircuit className="size-5 text-primary" />
                              </div>
                              <div>
                                 <h2 className="text-xl font-headline font-black text-on-surface uppercase tracking-tight">Neural Identity</h2>
                                 <p className="text-[9px] font-bold text-outline uppercase tracking-[0.25em] mt-0.5 opacity-60">Resonance parameters</p>
                              </div>
                           </div>
                           {formData.name && (
                              <motion.div
                                 initial={{ opacity: 0, x: 20 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-emerald-500/5 border border-emerald-500/10"
                              >
                                 <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Identity Synchronized</span>
                              </motion.div>
                           )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                           {/* Left: Identification Stacks */}
                           <div className="lg:col-span-4 space-y-5">
                              <div className="space-y-2">
                                 <div className="flex justify-between px-0">
                                    <label className="text-[9px] font-black text-primary uppercase tracking-widest">Name</label>
                                    <UserRound className="size-3 text-outline/40" />
                                 </div>
                                 <input
                                    type="text"
                                    autoFocus
                                    placeholder="Enter Persona Name"
                                    className="w-full bg-surface-low/50 backdrop-blur-md border border-outline-variant/10 rounded-xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                                    value={formData.name || ''}
                                    onChange={e => patch({ name: e.target.value })}
                                 />
                              </div>

                              <div className="space-y-2">
                                 <div className="flex justify-between px-0">
                                    <label className="text-[9px] font-black text-primary uppercase tracking-widest">Primary Logic</label>
                                    <Settings2 className="size-3 text-outline/40" />
                                 </div>
                                 <div className="relative">
                                    <input
                                       type="text"
                                       placeholder="Behavioral objective..."
                                       className="w-full bg-surface-low/50 border border-outline-variant/10 rounded-xl p-4 text-[13px] font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                       value={formData.useCase || ''}
                                       onChange={e => patch({ useCase: e.target.value })}
                                    />
                                    <Zap className="absolute right-4 top-1/2 -translate-y-1/2 size-3.5 text-primary/40" />
                                 </div>
                              </div>
                           </div>

                           {/* Center: Vocal DNA (Step 4) */}
                           <div className="lg:col-span-4 space-y-3">
                              <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1">Vocal DNA Profile</label>
                              <div className="space-y-2">
                                 {VOICE_RELAYS.slice(0, 3).map(v => (
                                    <button
                                       key={v.id}
                                       onClick={() => patch({ selectedVoice: v.id })}
                                       className={cn(
                                          "w-full px-4 py-3.5 rounded-xl border flex items-center gap-4 transition-all text-left relative overflow-hidden group/voice shadow-sm",
                                          formData.selectedVoice === v.id
                                             ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                                             : "bg-surface-low/40 border-outline-variant/5 text-outline hover:bg-surface-high/60"
                                       )}
                                    >
                                       <div className={cn(
                                          "size-9 rounded-lg flex items-center justify-center transition-all",
                                          formData.selectedVoice === v.id ? "bg-primary text-on-primary-fixed" : "bg-outline/5"
                                       )}>
                                          <Mic2 className="size-4" />
                                       </div>
                                       <div className="flex-1">
                                          <p className={cn("text-[11px] font-black", formData.selectedVoice === v.id ? 'text-on-surface' : 'text-outline')}>
                                             {v.name}
                                          </p>
                                          <p className="text-[7.5px] uppercase tracking-widest font-black opacity-50">{v.provider} Node</p>
                                       </div>
                                       {formData.selectedVoice === v.id && (
                                          <motion.div layoutId="active-voice-dot" className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(255,193,7,0.5)]" />
                                       )}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           {/* Right: Cultural Stacks */}
                           <div className="lg:col-span-4 space-y-8">
                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Linguistic Objective</label>
                                 <div className="grid grid-cols-2 gap-3">
                                    {[
                                       { id: 'English', icon: Languages },
                                       { id: 'Hindi', icon: Ghost },
                                       { id: 'Hinglish', icon: Sparkles },
                                       { id: 'Telugu', icon: Globe2 }
                                    ].map(lang => (
                                       <button
                                          key={lang.id}
                                          onClick={() => patch({ language: lang.id })}
                                          className={cn(
                                             "py-5 px-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group/lang relative overflow-hidden",
                                             formData.language === lang.id
                                                ? "bg-primary text-on-primary-fixed border-primary shadow-[0_10px_25px_rgba(255,193,7,0.3)] scale-[1.02]"
                                                : "bg-surface-low/40 border-outline-variant/10 text-outline hover:border-primary/40 hover:bg-surface-high"
                                          )}
                                       >
                                          <lang.icon className={cn("size-4 transition-transform group-hover/lang:scale-110", formData.language === lang.id ? "text-on-primary-fixed" : "text-primary/40")} />
                                          <span className="text-[10px] font-black uppercase tracking-tight">{lang.id}</span>
                                          {formData.language === lang.id && (
                                             <motion.div layoutId="lang-active-dot" className="absolute top-2 right-2 size-1.5 rounded-full bg-on-primary-fixed" />
                                          )}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                              <div className="space-y-4">
                                 <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">Behavioral Tone</label>
                                 <div className="grid grid-cols-2 gap-3">
                                    {[
                                       { id: 'Analytical', icon: Brain },
                                       { id: 'Casual', icon: Coffee },
                                       { id: 'Empathetic', icon: Heart },
                                       { id: 'Firm', icon: Shield }
                                    ].map(st => (
                                       <button
                                          key={st.id}
                                          onClick={() => patch({ emotion: st.id })}
                                          className={cn(
                                             "py-5 px-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group/tone relative overflow-hidden",
                                             formData.emotion === st.id
                                                ? "bg-primary text-on-primary-fixed border-primary shadow-[0_10px_25px_rgba(255,193,7,0.3)] scale-[1.02]"
                                                : "bg-surface-low/40 border-outline-variant/10 text-outline hover:border-primary/40 hover:bg-surface-high"
                                          )}
                                       >
                                          <st.icon className={cn("size-4 transition-transform group-hover/tone:scale-110", formData.emotion === st.id ? "text-on-primary-fixed" : "text-primary/40")} />
                                          <span className="text-[10px] font-black uppercase tracking-tight">{st.id}</span>
                                          {formData.emotion === st.id && (
                                             <motion.div layoutId="tone-active-dot" className="absolute top-2 right-2 size-1.5 rounded-full bg-on-primary-fixed" />
                                          )}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </section>

                     {/* Advanced Tuning Merger */}
                     <div className="space-y-6">
                        <div className="flex items-center gap-5">
                           <div className="h-px flex-1 bg-gradient-to-r from-transparent via-outline-variant/15 to-transparent" />
                           <button
                              onClick={() => setShowAdvanced(!showAdvanced)}
                              className={cn(
                                 "group flex items-center gap-3 px-6 py-2.5 rounded-xl border transition-all hover:scale-105 active:scale-95",
                                 showAdvanced
                                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                                    : "bg-surface-low border-outline-variant/10 text-outline"
                              )}
                           >
                              <Settings2 className={cn("size-3.5 transition-transform duration-500", showAdvanced ? "rotate-180" : "")} />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                                 {showAdvanced ? 'Neural Matrix Online' : 'Expert Tuning'}
                              </span>
                              <ChevronRight className={cn("size-3 transition-transform", showAdvanced ? "rotate-90" : "")} />
                           </button>
                           <div className="h-px flex-1 bg-gradient-to-r from-transparent via-outline-variant/15 to-transparent" />
                        </div>

                        <AnimatePresence>
                           {showAdvanced && (
                              <motion.div
                                 initial={false}
                                 animate={{ height: 'auto', opacity: 1, y: 0 }}
                                 exit={{ height: 0, opacity: 0, y: 10 }}
                                 transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                 className="overflow-hidden"
                              >
                                 <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Advanced Column 1: Sliders */}
                                    <div className="bg-gradient-to-br from-surface-low/30 to-surface-low/5 p-7 rounded-[1.5rem] border border-outline-variant/5 shadow-inner space-y-7">
                                       <p className="text-[9px] font-black text-primary/80 uppercase tracking-widest pl-1">Acoustic Signal</p>
                                       <div className="space-y-7">
                                          <StudioSlider label="Stability" value={formData.stability ?? 80} onChange={v => patch({ stability: v })} leftLabel="Variable" rightLabel="Phase Locked" />
                                          <StudioSlider label="Clarity" value={formData.clarity ?? 60} onChange={v => patch({ clarity: v })} leftLabel="Organic" rightLabel="Digital" />
                                          <StudioSlider label="Style Exaggeration" value={formData.styleExaggeration ?? 35} onChange={v => patch({ styleExaggeration: v })} leftLabel="Nuance" rightLabel="Hyper" />
                                       </div>
                                    </div>

                                    {/* Advanced Column 2: Tech Specs */}
                                    <div className="flex flex-col gap-4">
                                       <div className="bg-surface-low/30 p-7 rounded-[1.5rem] border border-outline-variant/5 flex-1 space-y-6">
                                          <p className="text-[9px] font-black text-primary/80 uppercase tracking-widest pl-1">Neural Core</p>
                                          <div className="grid grid-cols-1 gap-2">
                                             {['Sonix-Flash-1', 'Sonix-Pro-3', 'Eleven-Turbo-v2.5'].map(m => (
                                                <button
                                                   key={m}
                                                   onClick={() => patch({ baseModel: m })}
                                                   className={cn(
                                                      "px-5 py-3.5 rounded-xl border flex justify-between items-center transition-all group/model",
                                                      formData.baseModel === m
                                                         ? "bg-primary text-on-primary-fixed border-primary shadow-lg"
                                                         : "bg-surface-low/60 border-outline-variant/10 text-outline hover:bg-surface-high"
                                                   )}
                                                >
                                                   <span className="text-[11px] font-black tracking-tight">{m}</span>
                                                   {formData.baseModel === m ? (
                                                      <ShieldCheck className="size-4" />
                                                   ) : (
                                                      <Cpu className="size-3.5 opacity-20 group-hover/model:opacity-50 transition-opacity" />
                                                   )}
                                                </button>
                                             ))}
                                          </div>
                                       </div>

                                       {/* <div className="px-6 py-3.5 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                             <div className="size-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(255,193,7,0.5)]" />
                                             <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Engine: Optimal</p>
                                          </div>
                                          <Activity className="size-3.5 text-primary opacity-40" />
                                       </div> */}
                                    </div>
                                 </div>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </div>
                  </motion.div>
               </AnimatePresence>
            </div>

            {/* Action Hub */}
            <div className="p-8 bg-surface-low/80 border-t border-outline-variant/20 flex gap-4 mt-auto">
               <button
                  disabled={isSaving || !formData.name?.trim()}
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
                     "flex-1 py-5 rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 shadow-2xl relative overflow-hidden",
                     (isSaving || !formData.name?.trim())
                        ? "bg-outline/10 text-outline cursor-not-allowed opacity-50"
                        : "bg-primary text-on-primary-fixed studio-glow-amber hover:scale-[1.02] active:scale-[0.98]"
                  )}
               >
                  <span className="relative z-10 flex items-center gap-4">
                     {isSaving ? (
                        <><Loader2 className="size-5 animate-spin" /> Neural Sync Active...</>
                     ) : (
                        <><Save className="size-5" /> Deploy Neural Persona</>
                     )}
                  </span>
               </button>
            </div>
         </div>
      </div>
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// PersonaCard — individual card with edit / activate / delete
// ─────────────────────────────────────────────────────────────────────────────

interface PersonaCardProps {
   persona: AiPersona;
   index: number;
   onEdit: (p: AiPersona) => void;
   onDelete: (p: AiPersona) => void | Promise<void>;
   onToggleDeploy: (p: AiPersona) => void | Promise<void>;
   isDeleting: boolean;
   isToggling: boolean;
}

const PersonaCard: React.FC<PersonaCardProps> = ({
   persona,
   index,
   onEdit,
   onDelete,
   onToggleDeploy,
   isDeleting,
   isToggling,
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
                     <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest">Active</span>
                     </div>
                  )}
                  {!persona.isActive && (
                     <span className="text-[8px] font-bold text-outline uppercase bg-outline/10 px-1.5 py-0.5 rounded">Inactive</span>
                  )}
               </div>
            </div>
         </div>

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

      <div className="space-y-4 relative z-10">
         <p className="text-[11px] font-medium leading-relaxed line-clamp-2 text-outline/80">{persona.tone} · {persona.useCase}</p>

         <div className="p-4 rounded-2xl bg-surface-low/50 border border-outline-variant/5 group-hover:bg-surface-low transition-colors">
            <p className="text-[10px] leading-relaxed italic text-on-surface-variant line-clamp-2">
               &ldquo;{persona.psychology || 'Neural persona profile loaded.'}&rdquo;
            </p>
         </div>

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

   const handleSuggest = (rec: typeof RECOMMENDATIONS[0]) => {
      setEditingPersona({
         name: rec.name,
         useCase: rec.trigger,
         selectedVoice: rec.voice,
         emotion: rec.emotion,
      } as AiPersona);
      setIsForgeMode(true);
   };

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
