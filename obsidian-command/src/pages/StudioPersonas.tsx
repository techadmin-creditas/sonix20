import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  Save, 
  Play, 
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
  TrendingUp,
  BrainCircuit,
  Settings2,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { PERSONA_TEMPLATES } from '../data/personaData';
import { cn } from '../lib/utils';
import { useStudio, type PersonaProfile, type PersonaTemplate } from '../contexts/StudioContext';
import { VOICE_RELAYS, type VoiceRelay } from '../data/voiceData';
import { StudioSlider } from '../components/StudioSlider';

// --- Sub-components ---

const QuickForgeView = ({ 
  onClose, 
  onSave, 
  initialPersona 
}: { 
  onClose: () => void; 
  onSave: (p: any) => void;
  initialPersona?: any;
}) => {
  const [step, setStep] = React.useState(1);
  const [isScanning, setIsScanning] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [formData, setFormData] = React.useState<any>(initialPersona || {
    name: '',
    templateId: 'nurturer',
    gender: 'Female',
    tone: 'Warm · Empathetic',
    stability: 80,
    clarity: 60,
    speed: 50,
    emotion: 'Empathetic',
    style: 'consultative',
    selectedVoice: 'v1',
    urgency: 45,
    empathy: 75,
    styleExaggeration: 35,
    baseModel: 'Sonix-Flash-1',
    useCase: '',
    language: 'English'
  });

  React.useEffect(() => {
    setStep(1);
    if (initialPersona) {
      setFormData({ ...formData, ...initialPersona });
    }
  }, [initialPersona]);

  const handleNext = () => {
    if (step === 1 || step === 2) {
      setIsScanning(true);
      setTimeout(() => {
        setStep(prev => prev + 1);
        setIsScanning(false);
      }, 1200); // Cinematic pause
    } else {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(1, prev - 1));
  };

  const applyTemplate = (tpl: PersonaTemplate) => {
    setFormData({
      ...formData,
      templateId: tpl.id,
      gender: tpl.defaultGender,
      tone: tpl.defaultTone,
      stability: tpl.behavior.stability,
      clarity: tpl.behavior.clarity,
      emotion: tpl.behavior.emotion,
      style: tpl.behavior.style,
      urgency: formData.urgency || 45,
      empathy: formData.empathy || 75,
      baseModel: formData.baseModel || 'Sonix-Flash-1'
    });
  };



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
                   <h2 className="text-2xl font-headline font-extrabold text-on-surface uppercase tracking-tight line-clamp-1">Create AI Persona</h2>
                   <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border transition-all",
                          showAdvanced ? "bg-primary text-on-primary-fixed border-primary shadow-[0_0_10px_rgba(255,193,7,0.3)]" : "bg-surface-low border-outline-variant/10 text-outline hover:text-on-surface"
                        )}
                      >
                         {showAdvanced ? 'Advanced Tuning: ON' : 'Show Advanced'}
                      </button>
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                         <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest">{formData.baseModel || 'Sonix-Flash-1'} Active</span>
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
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Primary Objective</label>
                              <input 
                                type="text" 
                                placeholder="Debt Collection / Sales / Support..."
                                className="w-full bg-surface-low border border-outline-variant/10 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                value={formData.useCase}
                                onChange={e => setFormData({ ...formData, useCase: e.target.value })}
                              />
                           </div>
                        </div>
                        <div className="space-y-4">
                           <div className="space-y-2">
                              <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Linguistic Objective</label>
                              <div className="flex gap-2">
                                 {['English', 'Hindi', 'Hinglish'].map(lang => (
                                   <button
                                     key={lang}
                                     onClick={() => setFormData({ ...formData, language: lang })}
                                     className={cn(
                                       "px-4 py-2 rounded-lg text-[9px] font-bold border transition-all",
                                       formData.language === lang ? "bg-primary/10 border-primary/20 text-primary shadow-sm" : "bg-surface-low border-outline-variant/5 text-outline hover:border-outline-variant/20"
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
                                     onClick={() => setFormData({ ...formData, emotion: st })}
                                     className={cn(
                                       "p-3.5 rounded-lg text-[10px] font-bold border transition-all truncate",
                                       formData.emotion === st ? "bg-primary/10 border-primary/20 text-primary" : "bg-surface-low border-outline-variant/5 text-outline hover:border-outline-variant/20"
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
                        <StudioSlider 
                           label="Urgency Profile"
                           value={formData.urgency} 
                           onChange={v => setFormData({ ...formData, urgency: v })}
                           leftLabel="Patient"
                           rightLabel="Aggressive"
                        />
                        <StudioSlider 
                           label="Empathy Depth"
                           value={formData.empathy} 
                           onChange={v => setFormData({ ...formData, empathy: v })}
                           leftLabel="Rational"
                           rightLabel="Warm"
                        />
                     </div>
                  </motion.div>
                )}

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
                        <div className="flex gap-3">
                           <button className="px-5 py-2 rounded-xl bg-surface-low border border-outline-variant/10 text-[9px] font-bold uppercase tracking-widest text-outline hover:text-primary transition-all">
                              Preview Baseline
                           </button>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-8 bg-surface-low/20 p-6 rounded-3xl border border-outline-variant/5">
                           <StudioSlider 
                              label="Stability"
                              value={formData.stability} 
                              onChange={v => setFormData({ ...formData, stability: v })}
                              leftLabel="Variable"
                              rightLabel="Monotone"
                           />
                           <StudioSlider 
                              label="Clarity"
                              value={formData.clarity} 
                              onChange={v => setFormData({ ...formData, clarity: v })}
                              leftLabel="Natural"
                              rightLabel="Crystalline"
                           />
                        </div>

                        <div className="space-y-8 bg-surface-low/20 p-6 rounded-3xl border border-outline-variant/5">
                           <StudioSlider 
                              label="Style Exaggeration"
                              value={formData.styleExaggeration} 
                              onChange={v => setFormData({ ...formData, styleExaggeration: v })}
                              leftLabel="Subtle"
                              rightLabel="Extreme"
                           />
                           
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
                        <div className="space-y-4">
                           <div className="space-y-2">
                              <label className="text-[9px] font-bold text-primary uppercase tracking-[0.2em]">Selected Voice Relay</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {VOICE_RELAYS.slice(0, 4).map(v => (
                                   <button 
                                     key={v.id}
                                     onClick={() => setFormData({ ...formData, selectedVoice: v.id })}
                                     className={cn(
                                       "p-3 rounded-xl border flex flex-col gap-1.5 transition-all text-left",
                                       formData.selectedVoice === v.id ? "bg-primary/5 border-primary/30 shadow-lg ring-1 ring-primary/20" : "bg-surface-low border-outline-variant/5 text-outline hover:bg-surface-high"
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
                     </div>
                     <div className="space-y-6">
                        <div className="bg-surface-low/80 backdrop-blur-sm rounded-3xl p-6 border border-outline-variant/10 shadow-sm relative overflow-hidden h-full flex flex-col">
                           <div className="absolute top-0 right-0 p-4">
                              <ShieldCheck className="size-4 text-emerald-500" />
                           </div>
                           
                           <p className="text-[8px] font-bold text-primary uppercase tracking-[0.4em] mb-4">Neural Certificate</p>
                           
                           <div className="flex-1 space-y-6">
                              {/* Layer 1: Identity */}
                              <div className="space-y-2">
                                 <p className="text-[7px] font-bold text-outline uppercase tracking-widest">Linguistic Objective</p>
                                 <div className="flex items-center justify-between">
                                    <div>
                                       <h4 className="text-base font-headline font-extrabold text-on-surface">{formData.name}</h4>
                                       <p className="text-[8px] font-bold text-primary uppercase tracking-widest">{formData.language}</p>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-surface-lowest border border-outline-variant/5 text-[7px] font-bold text-outline uppercase">{formData.useCase || 'General Agent'}</span>
                                 </div>
                              </div>

                              {/* Layer 2: Behavioral DNA */}
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

                              {/* Layer 3: Technical Trace */}
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
                                       onClick={() => setFormData({ ...formData, baseModel: m })}
                                       className={cn(
                                         "p-4 rounded-xl border flex justify-between items-center transition-all",
                                         formData.baseModel === m ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-low border-outline-variant/5 text-outline"
                                       )}
                                     >
                                        <span className="text-[11px] font-bold">{m}</span>
                                        {formData.baseModel === m && <ShieldCheck className="size-3.5" />}
                                     </button>
                                   ))}
                                </div>
                             </div>
                             
                             <div className="space-y-3">
                                <label className="text-[9px] font-bold text-outline uppercase tracking-widest">Response Latency Target</label>
                                <StudioSlider 
                                   label="Strictness"
                                   value={45} 
                                   onChange={() => {}} 
                                   leftLabel="Quality"
                                   rightLabel="Speed"
                                />
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
                                <p className="text-[9px] leading-relaxed text-outline">These settings bypass the standard "Soul Alignment" logic and interact directly with the hardware acceleration layer.</p>
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
                disabled={step === 1 && !formData.name}
                className={cn(
                  "flex-2 py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl relative overflow-hidden group/save",
                  (step === 1 && !formData.name) ? "bg-outline/20 text-outline cursor-not-allowed opacity-50" : "bg-primary text-on-primary-fixed studio-glow-amber hover:scale-105"
                )}
               >
                 <span className="relative z-10 flex items-center gap-3">
                   {step === 1 ? 'Analyze DNA' : step === 2 ? 'Calibrate Soul' : 'Finalize Synthesis'}
                   <ArrowRight className="size-4" />
                 </span>
               </button>
            ) : (
              <button 
                onClick={() => {
                  // Dynamic Synthesis of Metadata
                  const finalPersona = { ...formData };
                  if (!finalPersona.useCase) finalPersona.useCase = `${formData.emotion} Agent`;
                  
                  // Psychological Profile Synthesis
                  const urgLabel = formData.urgency > 70 ? 'assertive' : formData.urgency > 30 ? 'balanced' : 'deliberate';
                  const empLabel = formData.empathy > 70 ? 'high-resonance' : formData.empathy > 30 ? 'measured' : 'analytical';
                  
                  finalPersona.psychology = `Synthesizing ${formData.emotion?.toLowerCase() || 'neutral'} intent with ${urgLabel} urgency and ${empLabel} empathy profiles.`;
                  finalPersona.tone = `${formData.emotion || 'Neural'} · ${formData.baseModel?.split('-')[1] || 'Neural'}`;
                  
                  onSave(finalPersona);
                }}
                className="flex-2 py-4 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] bg-primary text-on-primary-fixed studio-glow-amber shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <Save className="size-4" />
                Deploy Persona
              </button>
            )}
          </div>
      </div>
    </div>
  );
};

// --- Main Page ---

export default function StudioPersonas() {
  const { personas, deploymentIds, addPersona, updatePersona, toggleDeployment, deletePersona } = useStudio();
  const [isForgeMode, setIsForgeMode] = React.useState(false);
  const [editingPersona, setEditingPersona] = React.useState<any>(null);
  const [search, setSearch] = React.useState('');

  const recommendations = [
    { name: 'Hardship Advisor', trigger: 'DPD 120+', voice: 'Rachel' },
    { name: 'Early Bird', trigger: 'DPD -5', voice: 'Marcus' },
    { name: 'Loyalty Guide', trigger: 'Churn Risk', voice: 'Saira' },
  ];

  const handleForgeClose = () => {
    setIsForgeMode(false);
    setEditingPersona(null);
  };

  const handleSuggest = (rec: any) => {
    setEditingPersona({
      name: rec.name,
      useCase: rec.trigger,
      selectedVoice: rec.voice === 'Rachel' ? 'v1' : 'v2',
      emotion: 'Empathetic',
    });
    setIsForgeMode(true);
  };

  if (isForgeMode) {
    return (
      <QuickForgeView 
        onClose={handleForgeClose}
        initialPersona={editingPersona}
        onSave={(data) => {
          if (editingPersona?.id) {
            updatePersona(editingPersona.id, data);
          } else {
            addPersona({
              ...data,
              name: data.name || 'New Identity'
            });
          }
          handleForgeClose();
        }}
      />
    );
  }

  const filteredPersonas = personas.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-10">
       {/* Header & Strategic Insights */}
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-b border-outline-variant/10 pb-8">
         <div className="lg:col-span-8 space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-primary">AI Voice Personas</p>
            <h1 className="text-3xl lg:text-4xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Persona Studio</h1>
            <p className="text-outline text-[11px] font-medium max-w-2xl opacity-80">
              Manage and create your Neural Personas. Active capacity: <span className="text-on-surface font-bold">{personas.length}/500 Entities</span>.
            </p>
         </div>
         <div className="lg:col-span-4 flex justify-end">
           <button 
             onClick={() => setIsForgeMode(true)}
             className="flex items-center gap-2.5 bg-primary text-on-primary-fixed px-8 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-primary/10 hover:scale-105 active:scale-95 transition-all w-full lg:w-auto justify-center"
           >
             <Plus className="size-4" />
             Create New Persona
           </button>
         </div>
       </div>

      {/* Recommendations & Filtering */}
      <div className="flex flex-col lg:flex-row gap-4">
         <div className="flex-1 flex gap-3 p-1.5 bg-surface-low rounded-2xl border border-outline-variant/10 shadow-sm">
            <div className="flex-1 flex items-center gap-2 px-3">
               <Search className="size-3.5 text-outline" />
               <input 
                 type="text" 
                 placeholder="Search agents..."
                 className="bg-transparent border-none focus:ring-0 text-xs flex-1 shadow-none"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
            </div>
            <button className="p-2.5 bg-surface-lowest rounded-xl text-outline hover:text-on-surface border border-outline-variant/5 transition-all">
               <Filter className="size-3.5" />
            </button>
         </div>

          <div className="flex gap-2 scrollbar-hide overflow-x-auto">
             {recommendations.map((rec, i) => (
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
         {personas.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((persona, i) => (
           <motion.div 
             key={persona.id}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: i * 0.04 }}
             className="bg-surface-lowest rounded-4xl p-6 group relative overflow-hidden transition-all border border-outline-variant/10 hover:border-primary/30 shadow-sm hover:shadow-xl"
           >
              <div className="flex justify-between items-center mb-6 relative z-10 border-b border-outline-variant/5 pb-4">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-surface-low border border-outline-variant/5 flex items-center justify-center text-primary shadow-inner group-hover:bg-primary/5 transition-colors">
                     <UserRound className="size-7" />
                  </div>
                   <div>
                    <h3 className="text-lg font-headline font-extrabold text-on-surface">{persona.name}</h3>
                    <div className="flex items-center gap-2">
                       <p className="text-[9px] font-bold text-primary uppercase tracking-widest">{persona.language}</p>
                       {deploymentIds?.includes(persona.id) && (
                         <>
                           <span className="size-1 rounded-full bg-primary pulse-neural" />
                           <span className="text-[8px] font-bold text-primary uppercase">Active</span>
                         </>
                       )}
                    </div>
                  </div>
                </div>
                 <div className="flex gap-1.5">
                   <button 
                     onClick={() => {
                       setEditingPersona(persona);
                       setIsForgeMode(true);
                     }}
                     className="p-2.5 rounded-lg bg-surface-low hover:bg-surface-high text-outline hover:text-primary transition-all border border-outline-variant/10 shadow-sm"
                     title="Edit Persona"
                   >
                      <Edit2 className="size-3.5" />
                   </button>
                   <button 
                     onClick={() => {
                       if (confirm(`Are you sure you want to delete ${persona.name}?`)) {
                         deletePersona(persona.id);
                       }
                     }}
                     className="p-2.5 rounded-lg bg-surface-low hover:bg-error/10 text-outline hover:text-error transition-all border border-outline-variant/10 shadow-sm"
                     title="Delete Persona"
                   >
                      <Trash2 className="size-3.5" />
                   </button>
                 </div>
              </div>

              <div className="space-y-4 relative z-10">
                  <p className="text-[11px] font-medium leading-relaxed line-clamp-2 text-outline/80">{persona.tone} · {persona.useCase}</p>
                  <div className="p-4 rounded-2xl bg-surface-low/50 border border-outline-variant/5 group-hover:bg-surface-low transition-colors">
                     <p className="text-[10px] leading-relaxed italic text-on-surface-variant line-clamp-2">
                       &ldquo;{persona.psychology}&rdquo;
                     </p>
                  </div>

                  <button 
                    onClick={() => toggleDeployment(persona.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3.5 rounded-xl transition-all group/btn border",
                      deploymentIds?.includes(persona.id) 
                        ? "bg-primary/10 border-primary/20 text-primary" 
                        : "bg-surface-low hover:bg-primary text-outline hover:text-on-primary-fixed border-outline-variant/5"
                    )}
                  >
                     <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
                       {deploymentIds?.includes(persona.id) ? 'Decommission Node' : 'Activate Persona'}
                     </span>
                     {deploymentIds?.includes(persona.id) ? (
                       <Check className="size-3.5" />
                     ) : (
                       <ChevronRight className="size-3.5 group-hover/btn:translate-x-1 transition-transform" />
                     )}
                  </button>
              </div>
           </motion.div>
         ))}
      </div>

    </div>
  );
}
