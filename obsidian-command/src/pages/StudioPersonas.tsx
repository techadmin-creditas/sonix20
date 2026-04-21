import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
   Edit3,
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
   Bot,
   Fingerprint,
   Play,
   Pause,
   MessageSquare,
   Volume2,
   CloudLightning,
   Clock,
   DollarSign,
   CheckCircle2,
   ChevronDown,
   Lock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api, type AiPersona } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../lib/theme';
import { Header } from '../components/Header';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Premium Components
// ─────────────────────────────────────────────────────────────────────────────

const PremiumInput = ({ label, placeholder, value, onChange, icon: Icon }: { label?: string, placeholder: string, value: string, onChange: (v: string) => void, icon?: any }) => (
   <div className="space-y-2 group/input">
      {label && (
         <div className="flex items-center gap-2 mb-1">
            <div className="size-1.5 rounded-full bg-primary animate-pulse" />
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{label}</label>
         </div>
      )}
      <div className="relative">
         <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-outline/30 group-focus-within/input:text-primary transition-colors">
            {Icon ? <Icon className="size-4" /> : <Fingerprint className="size-4" />}
         </div>
         <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-surface-low border border-outline-variant/10 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-on-surface focus:bg-surface-lowest focus:border-primary outline-none transition-all placeholder:text-outline/20 shadow-inner"
         />
      </div>
   </div>
);

const PremiumSlider = ({ label, value, onChange, description }: { label: string, value: number, onChange: (v: number) => void, description?: string }) => (
   <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
         <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-on-surface uppercase tracking-widest">{label}</span>
            <span className="text-xs font-bold text-primary">{value}%</span>
         </div>
      </div>
      <div className="relative h-6 flex items-center group">
         <div className="absolute inset-0 h-1.5 top-1/2 -translate-y-1/2 bg-surface-highest rounded-full" />
         <motion.div
            className="absolute inset-y-0 left-0 h-1.5 top-1/2 -translate-y-1/2 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
            style={{ width: `${value}%` }}
         />
         <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={e => onChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
         />
         <motion.div
            className="absolute size-4 bg-surface-lowest rounded-full shadow-lg border-2 border-primary pointer-events-none"
            animate={{ left: `calc(${value}% - 8px)` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
         />
      </div>
   </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Next-Gen Neural Identity Forge Panel
// ─────────────────────────────────────────────────────────────────────────────

const NeuralIdentityForge = ({
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
   const [formData, setFormData] = React.useState<Partial<AiPersona>>(() => ({
      name: initialPersona?.name || '',
      emotion: initialPersona?.emotion || '',
      language: initialPersona?.language || '',
      stability: initialPersona?.stability || 80,
      clarity: initialPersona?.clarity || 60,
      expressiveness: initialPersona?.expressiveness || 35,
      gender: initialPersona?.gender || 'Female',
      psychology: initialPersona?.psychology || '',
      selectedVoice: initialPersona?.selectedVoice || '',
      isDeployed: initialPersona?.isDeployed || false,
      useCase: initialPersona?.useCase || '',
      tone: initialPersona?.tone || '',
      urgency: initialPersona?.urgency || 45,
      empathy: initialPersona?.empathy || 75,
   }));

   const [activeTab, setActiveTab] = React.useState<'Voice' | 'Language' | 'Tone'>('Voice');
   const [isPlaying, setIsPlaying] = React.useState(false);
   const [isCloning, setIsCloning] = React.useState(false);
   const [mediaRecorder, setMediaRecorder] = React.useState<MediaRecorder | null>(null);
   const [audioChunks, setAudioChunks] = React.useState<Blob[]>([]);
   const [isRecording, setIsRecording] = React.useState(false);

   const startRecording = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
         const blob = new Blob(chunks, { type: 'audio/wav' });
         setIsCloning(true);
         try {
            const result = await api.cloneVoice(blob, `Clone-${Date.now()}`);
            setAvailableVoices(prev => [{ id: result.voice_id, name: result.name, provider: 'elevenlabs' }, ...prev]);
            patch({ selectedVoice: result.voice_id });
         } catch (e) {
            alert('Cloning failed: ' + e);
         } finally {
            setIsCloning(false);
            stream.getTracks().forEach(t => t.stop());
         }
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setTimeout(() => recorder.stop(), 5000); // 5s recording
   };
   const [availableVoices, setAvailableVoices] = React.useState<{ id: string, name: string, provider: string }[]>([]);
   const [isFetchingVoices, setIsFetchingVoices] = React.useState(false);

   // Metadata state
   const [metadata, setMetadata] = React.useState<{ languages: any[], tones: any[], stress_corpus: any[] }>({
      languages: [],
      tones: [],
      stress_corpus: []
   });
   const [selectedStressIndex, setSelectedStressIndex] = React.useState(0);

   React.useEffect(() => {
      const loadData = async () => {
         setIsFetchingVoices(true);
         try {
            const [voices, meta] = await Promise.all([
               api.getVoices(),
               api.getTestingMetadata()
            ]);
            setAvailableVoices(voices);
            setMetadata(meta);
         } catch (e) {
            console.error('Failed to load metadata:', e);
         } finally {
            setIsFetchingVoices(false);
         }
      };
      loadData();
   }, []);

   const patch = (val: Partial<AiPersona>) => setFormData(prev => ({ ...prev, ...val }));

   const handlePlayPreview = async () => {
      if (!formData.selectedVoice || !formData.language || !formData.emotion) return;

      if (isPlaying) {
         setIsPlaying(false);
         return;
      }

      setIsPlaying(true);

      const voice = availableVoices.find(v => v.id === formData.selectedVoice || v.name === formData.selectedVoice);
      if (!voice) {
         console.warn('Voice not found for preview:', formData.selectedVoice);
         setIsPlaying(false);
         return;
      }

      // 🎯 Stress Corpus or Dynamic Greeting
      const currentCategory = metadata.stress_corpus[selectedStressIndex % metadata.stress_corpus.length];
      // Rotate through items in the category based on index
      const phraseIndex = Math.floor(selectedStressIndex / metadata.stress_corpus.length) % (currentCategory?.items?.length || 1);
      const testPhrase = currentCategory ? currentCategory.items[phraseIndex] : null;

      const text = testPhrase || `Hello! I am ${formData.name || voice.name}. My tone is ${formData.emotion} and I am speaking in ${formData.language}. How do I sound?`;

      try {
         const response = await api.testTts({
            tts_provider: voice.provider,
            voice_id: voice.id,
            text: text,
            language: formData.language,
            emotion: formData.emotion,
            stability: (formData.stability || 80) / 100,
            similarity_boost: (formData.clarity || 60) / 100,
            style: (formData.expressiveness || 35) / 100
         });

         const blob = await response.blob();
         const url = URL.createObjectURL(blob);
         const audio = new Audio(url);

         audio.onended = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
         };

         audio.onerror = () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
         };

         await audio.play();
      } catch (e) {
         console.error('Preview failed:', e);
         setIsPlaying(false);
      }
   };

   React.useEffect(() => {
      if (isPlaying) {
         setIsPlaying(false);
         setTimeout(() => {
            if (formData.selectedVoice && formData.language && formData.emotion) {
               setIsPlaying(true);
            }
         }, 300);
      }
   }, [formData.selectedVoice, formData.language, formData.emotion, formData.stability, formData.clarity, formData.expressiveness]);

   const isComplete = !!(formData.selectedVoice && formData.language && formData.emotion);

   const avatars = [
      { id: 'v1', name: 'Rachel', image: '/avatars/rachel.png', label: 'Female • 24y', info: 'Best for: Collections' },
      { id: 'v2', name: 'Marcus', image: '/avatars/marcus.png', label: 'Male • 30y', info: 'Control Room' },
      { id: 'v3', name: 'Saira', image: '/avatars/saira.png', label: 'Female • 28y', info: 'Tech Expert' },
   ];

   const getVoiceAvatar = (voiceName?: string) => {
      return avatars.find(a => a.name === voiceName)?.image || avatars[0].image;
   };

   const renderTabContent = () => {
      switch (activeTab) {
         case 'Voice':
            if (isFetchingVoices) {
               return (
                  <div className="flex items-center gap-2 p-4 text-[10px] font-bold text-outline uppercase tracking-widest">
                     <Loader2 className="size-4 animate-spin" /> Fetching Neural Assets...
                  </div>
               );
            }
            return availableVoices.map((av, i) => (
               <button
                  key={i}
                  onClick={() => patch({
                     gender: av.name.toLowerCase().includes('female') || av.name === 'Rachel' || av.name === 'Saira' ? 'Female' : 'Male',
                     selectedVoice: av.id
                  })}
                  className={cn(
                     "flex items-center gap-3 p-2 pr-4 rounded-2xl border transition-all shrink-0",
                     formData.selectedVoice === av.id ? "bg-primary/10 border-primary/20 shadow-lg" : "bg-surface-lowest border-outline-variant/10 hover:border-outline-variant/30"
                  )}
               >
                  <div className="size-10 rounded-full bg-surface-low overflow-hidden border border-outline-variant/5 flex items-center justify-center">
                     <Bot className="size-6 text-primary/40" />
                  </div>
                  <div className="text-left">
                     <div className="text-[11px] font-bold text-on-surface line-clamp-1 max-w-[120px]">{av.name}</div>
                     <div className="text-[8px] font-medium text-outline uppercase tracking-tighter">{av.provider}</div>
                  </div>
               </button>
            ));
         case 'Language':
            return (metadata.languages.length > 0 ? metadata.languages : []).map((lang, i) => (
               <button
                  key={i}
                  onClick={() => patch({ language: lang.name })}
                  className={cn(
                     "flex items-center gap-3 p-3 px-6 rounded-2xl border transition-all shrink-0",
                     formData.language === lang.name ? "bg-primary/10 border-primary/20 shadow-lg" : "bg-surface-lowest border-outline-variant/10 hover:border-outline-variant/30"
                  )}
               >
                  <div className="text-left">
                     <div className="text-[11px] font-bold text-on-surface">{lang.name}</div>
                     <div className="text-[8px] font-medium text-outline">{lang.sub}</div>
                  </div>
               </button>
            ));
         case 'Tone':
            const toneIcons: Record<string, any> = { Heart, Cpu, ShieldCheck, MessageSquare };
            return (metadata.tones.length > 0 ? metadata.tones : []).map((tone, i) => {
               const Icon = toneIcons[tone.icon] || MessageSquare;
               return (
                  <button
                     key={i}
                     onClick={() => patch({ emotion: tone.name })}
                     className={cn(
                        "flex items-center gap-3 p-3 px-6 rounded-2xl border transition-all shrink-0",
                        formData.emotion === tone.name ? "bg-primary/10 border-primary/20 shadow-lg" : "bg-surface-lowest border-outline-variant/10 hover:border-outline-variant/30"
                     )}
                  >
                     <Icon className={cn("size-4", formData.emotion === tone.name ? "text-primary" : "text-outline")} />
                     <div className="text-left">
                        <div className="text-[11px] font-bold text-on-surface">{tone.name}</div>
                        <div className="text-[8px] font-medium text-outline">{tone.label}</div>
                     </div>
                  </button>
               );
            });
      }
   };

   return (
      <div className="fixed inset-0 z-100 flex justify-end pointer-events-none" >
         <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/5 backdrop-blur-[2px] pointer-events-auto"
            onClick={onClose}
         />

         <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 35, stiffness: 250 }}
            className="relative w-full max-w-[80%] h-full bg-surface-low border-l border-outline-variant/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col pointer-events-auto rounded-l-[3rem]"
         >
            {/* Header */}
            <div className="px-10 py-6 flex items-center justify-between border-b border-outline-variant/10 shrink-0 z-10 bg-surface/80 backdrop-blur-md">
               <div className="flex items-center gap-4">
                  <div className="size-10 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10">
                     <Brain className="size-6 text-primary" />
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-on-surface tracking-tight">NEURALIDENTITY</h2>
                     <p className="text-[10px] font-black text-outline uppercase tracking-widest">Persona Forge</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-high transition-all">
                     <X className="size-5" />
                  </button>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
               {/* Left Column */}
               <div className="flex-1 overflow-y-auto p-10 scrollbar-none space-y-8">
                  <div className="space-y-8">
                     <div className="p-10 bg-surface-lowest border border-outline-variant/10 rounded-6xl space-y-10 shadow-sm relative overflow-hidden group/forge">
                        <div className="absolute -right-12 -top-12 size-48 bg-primary/5 blur-[80px] group-hover/forge:bg-primary/10 transition-all" />
                        <div className="flex items-center gap-10">
                           <div className="size-24 shrink-0 rounded-4xl bg-surface-low flex items-center justify-center border border-outline-variant/5 shadow-inner">
                              <Fingerprint className="size-14 text-primary" />
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3 px-1">
                                 <div className="size-1.5 rounded-full bg-primary" />
                                 <label className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Identity Node Protocol</label>
                              </div>
                              <input
                                 placeholder="e.g. Maya, Elite Concierge"
                                 className="w-full bg-surface-low border border-outline-variant/10 rounded-3xl px-8 py-5 text-xl font-black text-on-surface focus:bg-surface-lowest focus:border-primary outline-none transition-all placeholder:text-outline/20"
                                 value={formData.name || ''}
                                 onChange={e => patch({ name: e.target.value })}
                              />
                           </div>
                        </div>
                        <div className="space-y-4">
                           <div className="flex items-center gap-2 mb-1 px-1">
                              <div className="size-1.5 rounded-full bg-primary opacity-60" />
                              <label className="text-[10px] font-black text-outline uppercase tracking-[0.2em]">Primary Neural Logic</label>
                           </div>
                           <div className="relative group/input">
                              <div className="absolute top-1/2 -translate-y-1/2 left-8 text-outline/30 group-focus-within/input:text-primary transition-colors">
                                 <BrainCircuit className="size-5" />
                              </div>
                              <input
                                 placeholder="Neural Logic Description..."
                                 className="w-full bg-surface-low border border-outline-variant/10 rounded-3xl pl-16 pr-8 py-6 text-sm font-bold text-on-surface focus:bg-surface-lowest focus:border-primary outline-none transition-all placeholder:text-outline/20 shadow-inner"
                                 value={formData.psychology || ''}
                                 onChange={e => patch({ psychology: e.target.value })}
                              />
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <div className="inline-flex p-1 bg-surface-lowest border border-outline-variant/10 rounded-2xl">
                              {['Voice', 'Language', 'Tone'].map(tab => (
                                 <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={cn(
                                       "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                       activeTab === tab ? "bg-primary text-white shadow-md" : "text-outline hover:text-on-surface"
                                    )}
                                 >
                                    {tab}
                                 </button>
                              ))}
                           </div>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                           {activeTab === 'Voice' && (
                              <button
                                 onClick={startRecording}
                                 disabled={isRecording || isCloning}
                                 className={cn(
                                    "flex flex-col items-center justify-center gap-2 p-2 px-6 rounded-2xl border border-dashed transition-all shrink-0",
                                    isRecording ? "border-error bg-error/5 text-error" : "border-outline-variant/30 bg-surface-low text-outline hover:border-primary/40 hover:bg-primary/5"
                                 )}
                              >
                                 {isCloning ? <Loader2 className="size-5 animate-spin" /> : isRecording ? <Mic2 className="size-5 animate-pulse" /> : <Plus className="size-5" />}
                                 <div className="text-[9px] font-black uppercase tracking-tighter">
                                    {isCloning ? 'Cloning...' : isRecording ? 'Recording...' : 'Clone Me'}
                                 </div>
                              </button>
                           )}
                           {renderTabContent()}
                        </div>
                     </div>

                     <div className="bg-surface-lowest border border-outline-variant/10 rounded-5xl p-8 space-y-6 shadow-sm">
                        <div className="flex items-center justify-between">
                           <h4 className="text-[10px] font-black text-on-surface uppercase tracking-widest flex items-center gap-2">
                              <CloudLightning className="size-3 text-primary" /> Acoustic Tuning
                           </h4>
                           {metadata.stress_corpus.length > 0 && (
                              <button
                                 onClick={() => setSelectedStressIndex(i => i + 1)}
                                 className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[9px] font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                              >
                                 <RefreshCw className="size-2.5" />
                                 Test: {metadata.stress_corpus[selectedStressIndex % metadata.stress_corpus.length]?.category}
                              </button>
                           )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-6">
                              <PremiumSlider label="Urgency" value={formData.urgency || 45} onChange={v => patch({ urgency: v })} />
                              <PremiumSlider label="Empathy" value={formData.empathy || 75} onChange={v => patch({ empathy: v })} />
                           </div>
                           <div className="space-y-6">
                              <PremiumSlider label="Stability" value={formData.stability || 80} onChange={v => patch({ stability: v })} />
                              <PremiumSlider label="Clarity" value={formData.clarity || 60} onChange={v => patch({ clarity: v })} />
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Right Column (Fixed Preview) */}
               <div className="w-[440px] p-10 bg-surface-low border-l border-outline-variant/10 flex flex-col shrink-0">
                  <div className="flex flex-col gap-8 sticky top-0">
                     <h3 className="text-xl font-bold text-on-surface flex items-center gap-3">
                        <Activity className="size-5 text-primary" /> Entity Preview
                     </h3>

                     <div className={cn(
                        "relative group rounded-6xl overflow-hidden bg-surface-lowest border border-outline-variant/10 shadow-2xl transition-all",
                        !isComplete && "opacity-50 grayscale blur-[2px] pointer-events-none"
                     )}>
                        {!isComplete && (
                           <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/40 backdrop-blur-md p-10 text-center">
                              <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center mb-6 animate-pulse">
                                 <Lock className="size-8 text-white" />
                              </div>
                              <h5 className="text-white font-bold text-lg mb-2 uppercase tracking-tighter">Acoustic Link Offline</h5>
                              <p className="text-white/60 text-[10px] font-medium leading-relaxed uppercase tracking-widest">
                                 Select Voice, Language, and Tone <br /> to initialize identity
                              </p>
                           </div>
                        )}
                        <div className="aspect-4/5 relative">
                           <img
                              src={getVoiceAvatar(availableVoices.find(v => v.id === formData.selectedVoice)?.name)}
                              alt="Current Persona"
                              className="absolute inset-0 w-full h-full object-cover"
                           />
                           <div className="absolute inset-0 bg-surface-low/40" />
                           <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-surface-low to-transparent flex flex-col justify-end p-8 space-y-6 pb-2">
                              <div className="flex flex-col">
                                 <div className="flex items-center gap-2 mb-2">
                                    <div className={cn("size-2 rounded-full bg-primary", isPlaying && "animate-ping")} />
                                    <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isPlaying ? "text-primary" : "text-outline/20")}>
                                       {isPlaying ? 'Audio Link Active' : 'System Standby'}
                                    </span>
                                 </div>
                                 <h4 className="text-3xl font-bold text-on-surface tracking-tighter">
                                    {availableVoices.find(v => v.id === formData.selectedVoice)?.name || 'Select Identity'}
                                 </h4>
                              </div>

                              <div className="flex gap-4">
                                 <div className="flex items-center gap-1.5 text-[9px] text-outline font-black uppercase tracking-widest bg-surface-lowest px-3 py-1.5 rounded-full border border-outline-variant/20">
                                    <Languages className="size-3" /> {formData.language || 'English'}
                                 </div>
                                 <div className="flex items-center gap-1.5 text-[9px] text-outline font-black uppercase tracking-widest bg-surface-lowest px-3 py-1.5 rounded-full border border-outline-variant/20">
                                    <ShieldCheck className="size-3" /> {formData.emotion || 'Empathetic'}
                                 </div>
                              </div>

                              <div className="relative pt-4 border-t border-outline-variant/20">
                                 <div className="flex items-center gap-0.5 h-16">
                                    {[0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.2, 0.6, 1, 0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.2, 0.6, 1, 0.4, 0.7].map((h, i) => (
                                       <motion.div
                                          key={i}
                                          animate={isPlaying ? { height: ['10%', `${h * 100}%`, '10%'] } : { height: '10%' }}
                                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.05 }}
                                          className={cn(
                                             "flex-1 rounded-full transition-colors duration-500",
                                             isPlaying ? "bg-primary opacity-60" : "bg-outline/20 opacity-20"
                                          )}
                                       />
                                    ))}
                                 </div>
                                 <button
                                    onClick={handlePlayPreview}
                                    disabled={!isComplete}
                                    className="absolute right-0 bottom-6 size-16 rounded-full bg-primary flex items-center justify-center text-white shadow-lg hover:scale-110 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                    {isPlaying ? <Pause className="size-8" /> : <Play className="size-7 fill-current" />}
                                 </button>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="px-10 py-8 bg-surface-lowest border-t border-outline-variant/10 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2 px-6 py-2 rounded-full bg-surface-low border border-outline-variant/10 text-outline text-[10px] font-black uppercase tracking-widest">
                  {isComplete ? (
                     <span className="text-emerald-500 flex items-center gap-2"><CheckCircle2 className="size-4" /> Persona Ready ✓</span>
                  ) : (
                     <><Loader2 className="size-4 animate-spin" /> Neural Profile Incomplete</>
                  )}
               </div>
               <div className="flex items-center gap-4">
                  <button
                     onClick={() => {
                        const finalPersona: Partial<AiPersona> = {
                           ...formData,
                           useCase: formData.useCase || `${formData.emotion} Agent`,
                           tone: `${formData.emotion || 'Neural'} · Active`,
                           psychology: formData.psychology || `Empathetic logic sync completed.`
                        };
                        onSave(finalPersona);
                     }}
                     disabled={isSaving || !formData.name}
                     className={cn(
                        "px-10 py-5 rounded-3xl bg-primary text-on-primary-fixed font-black text-[12px] uppercase tracking-[0.3em] flex items-center gap-3 shadow-xl hover:bg-primary/90 hover:scale-[1.02] transition-all",
                        (!formData.name || isSaving) && "opacity-50 cursor-not-allowed"
                     )}
                  >
                     <CloudLightning className="size-5" /> {isSaving ? 'Synchronizing...' : 'Deploy Persona ☄'}
                  </button>
               </div>
            </div>
         </motion.div>
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
   onQuickPreview: (p: AiPersona) => void;
   activePreviewId: string | null;
}

const PersonaCard: React.FC<PersonaCardProps> = ({
   persona,
   index,
   onEdit,
   onDelete,
   onToggleDeploy,
   isDeleting,
   isToggling,
   onQuickPreview,
   activePreviewId,
}) => {
   const { theme } = useTheme();
   const isDark = theme === 'dark';

   return (
      <motion.div
         layout
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         transition={{ 
            layout: { type: 'spring', stiffness: 500, damping: 35, mass: 0.5 },
            opacity: { duration: 0.2 }
         }}
         className={cn(
            "group relative flex flex-col p-7 rounded-[10px] border",
            isDark 
               ? "bg-surface/40 border-outline-variant/10 hover:border-primary/40 hover:bg-surface/60 shadow-[0_0_20px_rgba(0,0,0,0.1)]" 
               : "bg-surface border-outline-variant/10 shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/30",
            isDeleting && "border-red-500/50 bg-red-500/5"
         )}
      >
         {/* Header */}
         <div className="flex justify-between items-start mb-6 relative z-10 border-b border-outline-variant/5 pb-5">
            <div className="flex items-center gap-5">
               <div className={cn(
                  "size-14 rounded-2xl flex items-center justify-center transition-all duration-300",
                  isDark 
                    ? "bg-primary/5 border border-primary/20 text-primary shadow-[0_0_15px_rgba(56,189,248,0.05)]" 
                    : "bg-primary/10 border border-primary/30 text-primary shadow-sm"
               )}>
                  <UserRound className="size-7" />
               </div>
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                     <h3 className="text-xl font-headline font-black text-on-surface truncate group-hover:text-primary transition-colors duration-300">
                        {persona.name}
                     </h3>
                     {persona.isDeployed && (
                        <div className="relative">
                           <div className="size-2 rounded-full bg-emerald-500" />
                           <div className="absolute inset-0 size-2 rounded-full bg-emerald-500 animate-ping opacity-40" />
                        </div>
                     )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                     <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{persona.language}</p>
                     <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full border",
                        isDark ? "bg-surface-low border-outline-variant/10" : "bg-primary/5 border-primary/10"
                     )}>
                        <Clock className="size-2.5 text-outline" />
                        <span className={cn(
                           "text-[8px] font-bold uppercase tracking-tighter",
                           isDark ? "text-outline" : "text-on-surface/60"
                        )}>
                           {new Date(persona.createdAt * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex gap-2">
               <button
                  onClick={() => onQuickPreview(persona)}
                  className={cn(
                     "p-2.5 rounded-xl transition-all border",
                     activePreviewId === persona.id 
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                        : "bg-surface-high border-outline-variant/10 text-outline hover:text-primary hover:bg-surface-highest"
                  )}
               >
                  {activePreviewId === persona.id ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
               </button>
               <button
                  onClick={() => onEdit(persona)}
                  className="p-2.5 rounded-xl bg-surface-high border border-outline-variant/10 text-outline hover:text-primary hover:bg-surface-highest transition-all"
               >
                  <Edit2 className="size-4" />
               </button>
               <button
                  onClick={() => onDelete(persona)}
                  disabled={isDeleting}
                  className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
               >
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
               </button>
            </div>
         </div>

         <div className="space-y-6 relative z-10 flex-1 flex flex-col">
            <p className={cn(
               "text-xs font-bold uppercase tracking-widest",
               isDark ? "text-outline/80" : "text-on-surface/60"
            )}>
               {persona.tone} · {persona.useCase}
            </p>

            <div className={cn(
               "p-5 rounded-3xl border italic group-hover:bg-surface-high transition-colors flex-1",
               isDark ? "bg-surface-low/50 border-outline-variant/5" : "bg-primary/5 border-primary/10"
            )}>
               <p className={cn(
                  "text-sm leading-relaxed line-clamp-3",
                  isDark ? "text-on-surface-variant opacity-80" : "text-on-surface font-medium"
               )}>
                  &ldquo;{persona.psychology || 'Neural persona profile loaded.'}&rdquo;
               </p>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
               <div className="space-y-2">
                  <div className={cn(
                     "flex justify-between text-[10px] font-black uppercase tracking-widest",
                     isDark ? "text-on-surface/80" : "text-on-surface"
                  )}>
                     <span className="flex items-center gap-1.5"><Activity className="size-3" /> Logic</span>
                     <span className="text-primary font-bold">{persona.urgency ?? 45}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-highest/20 rounded-full overflow-hidden border border-outline-variant/10">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${persona.urgency ?? 45}%` }}
                        transition={{ 
                           duration: 1.2, 
                           ease: [0.34, 1.56, 0.64, 1], 
                           delay: 0.15 + (index * 0.03) 
                        }}
                        className="h-full bg-primary" 
                     />
                  </div>
               </div>
               <div className="space-y-2">
                  <div className={cn(
                     "flex justify-between text-[10px] font-black uppercase tracking-widest",
                     isDark ? "text-on-surface/80" : "text-on-surface"
                  )}>
                     <span className="flex items-center gap-1.5"><Sparkles className="size-3" /> Empathy</span>
                     <span className="text-emerald-500 font-bold">{persona.empathy ?? 75}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-highest/20 rounded-full overflow-hidden border border-outline-variant/10">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${persona.empathy ?? 75}%` }}
                        transition={{ 
                           duration: 1.2, 
                           ease: [0.34, 1.56, 0.64, 1], 
                           delay: 0.2 + (index * 0.03) 
                        }}
                        className="h-full bg-emerald-500" 
                     />
                  </div>
               </div>
            </div>

            <button
               onClick={() => onToggleDeploy(persona)}
               disabled={isToggling}
               className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl transition-all group/btn border disabled:opacity-60",
                  persona.isDeployed
                     ? "bg-primary/10 border-primary/20 text-primary shadow-inner"
                     : "bg-surface-high hover:bg-primary text-outline hover:text-on-primary-fixed border-outline-variant/10 shadow-sm"
               )}
            >
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  {persona.isDeployed ? 'Decommission Node' : 'Activate Persona'}
               </span>
               {isToggling
                  ? <Loader2 className="size-4 animate-spin" />
                  : persona.isDeployed
                     ? <CheckCircle2 className="size-4" />
                     : <ChevronRight className="size-4 group-hover/btn:translate-x-1 transition-transform" />
               }
            </button>
         </div>
      </motion.div>
   );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

const RECOMMENDATIONS = [
   // { name: 'Hardship Advisor', trigger: 'DPD 120+', voice: 'Rachel', emotion: 'Empathetic', language: 'English', urgency: 20, empathy: 95, stability: 90, clarity: 85 },
   // { name: 'Early Bird', trigger: 'DPD -5', voice: 'Marcus', emotion: 'Firm', language: 'Hindi', urgency: 85, empathy: 30, stability: 70, clarity: 95 },
   // { name: 'Casual Reminder', trigger: 'Standard', voice: 'Saira', emotion: 'Casual', language: 'English', urgency: 45, empathy: 75, stability: 80, clarity: 60 },
];

export default function StudioPersonas({ debug }: { debug?: boolean }) {
   const { currentUser, canUpdate } = useAuth();
   const location = useLocation();
   const [personas, setPersonas] = React.useState<AiPersona[]>([]);
   const [users, setUsers] = React.useState<any[]>([]);
   const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
   const [roles, setRoles] = React.useState<any[]>([]);
   const [isLoading, setIsLoading] = React.useState(true);
   const [loadError, setLoadError] = React.useState<string | null>(null);
   const [isForgeOpen, setIsForgeOpen] = React.useState(false);
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

         if (debug) {
            try {
               const [userData, rolesData] = await Promise.all([
                  api.listUsers(),
                  api.listRoles()
               ]);
               setUsers(userData);
               setRoles(rolesData.roles);

               // Handle preselection
               const state = location.state as { initialUserId?: string };
               if (state?.initialUserId) {
                  const target = userData.find(u => u.id === state.initialUserId);
                  if (target) setSelectedUser(target);
               } else if (userData.length > 0) {
                  setSelectedUser(userData[0]);
               }
            } catch (adminErr) {
               console.error('Administrative link failed:', adminErr);
            }
         }
      } catch (e: any) {
         setLoadError(e?.message || 'Failed to load personas');
      } finally {
         setIsLoading(false);
      }
   }, [debug]);

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
         setIsForgeOpen(false);
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

   const handleToggleAssignment = async (persona: AiPersona, isAssigned: boolean) => {
      if (!selectedUser) return;
      try {
         if (isAssigned) {
            // Create a unique clone for this user
            const clone = await api.createAiPersona({
               ...persona,
               id: undefined,
               owner_user_id: selectedUser.id,
            });
            setPersonas(prev => [clone, ...prev]);
         } else {
            // Only allow unassigning (deleting) if this IS the user's instance
            if (persona.owner_user_id === selectedUser.id) {
               await api.deleteAiPersona(persona.id);
               setPersonas(prev => prev.filter(p => p.id !== persona.id));
            }
         }
      } catch (err) {
         alert('Neural link replication failed');
      }
   };

   const handleSuggest = (rec: typeof RECOMMENDATIONS[0]) => {
      setEditingPersona({
         name: rec.name,
         useCase: rec.trigger,
         selectedVoice: rec.voice,
         emotion: rec.emotion,
         language: rec.language,
         stability: rec.stability,
         clarity: rec.clarity,
         urgency: rec.urgency,
         empathy: rec.empathy,
      } as AiPersona);
      setIsForgeOpen(true);
   };

   // --- Registry Grid Logic ---
   const [activePreviewId, setActivePreviewId] = React.useState<string | null>(null);

   const handleQuickPreview = async (persona: AiPersona) => {
      if (activePreviewId) {
         setActivePreviewId(null);
         return;
      }

      setActivePreviewId(persona.id);
      try {
         const response = await api.testTts({
            tts_provider: 'elevenlabs',
            voice_id: persona.selectedVoice || 'Sarah',
            text: `Hello, I am ${persona.name}. My current role is ${persona.useCase}.`
         });

         const blob = await response.blob();
         const url = URL.createObjectURL(blob);
         const audio = new Audio(url);

         audio.onended = () => {
            setActivePreviewId(null);
            URL.revokeObjectURL(url);
         };

         audio.onerror = () => {
            setActivePreviewId(null);
            URL.revokeObjectURL(url);
         };

         await audio.play();
      } catch (e) {
         console.error('Quick preview failed:', e);
         setActivePreviewId(null);
      }
   };

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
         <div className="flex justify-between items-start border-b border-outline-variant/10 pb-6">
            <div className="space-y-1">
               <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em]">
                  {debug ? "Neural Permission Matrix" : "Neural Registry"}
               </p>
               <h1 className="text-3xl font-headline font-extrabold text-on-surface uppercase tracking-tight">
                  {debug ? "Debug Configuration" : `${personas.length} Voice Agents Deployed`}
               </h1>
               <p className="text-[10px] text-outline font-medium max-w-md uppercase tracking-widest leading-relaxed">
                  {debug ? "Manage user identity assignments and neural link protocols." : "Manage and create your AI voice agents."}
                  <span className="text-primary ml-2">Active capacity: {personas.length}/500</span>
               </p>
            </div>
            <div className="flex items-center gap-3">
               {debug ? (
                  <Link to="/persona" className="px-6 py-3.5 rounded-xl bg-surface-low text-outline text-[10px] font-bold uppercase tracking-widest hover:bg-surface-high transition-all">
                     Back to Registry
                  </Link>
               ) : (
                  <>
                     <button
                        onClick={loadPersonas}
                        className="p-2.5 rounded-xl bg-surface-low border border-outline-variant/10 text-outline hover:text-primary transition-all"
                        title="Refresh"
                     >
                        <RefreshCw className="size-4" />
                     </button>
                     <button
                        onClick={() => { setEditingPersona(null); setIsForgeOpen(true); }}
                        className="flex items-center gap-2.5 bg-primary text-on-primary-fixed px-8 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-primary/10 hover:scale-105 active:scale-95 transition-all"
                     >
                        <Plus className="size-4" />
                        Create New Persona
                     </button>
                  </>
               )}
            </div>
         </div>

         {debug ? (
            <div className="flex flex-col lg:flex-row gap-10">
               {/* User Sidebar */}
               <div className="w-full lg:w-96 flex flex-col gap-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1 flex items-center gap-2">
                     <UserRound className="size-4" /> Select Identity
                  </h3>
                  <div className="flex flex-col gap-3">
                     {users.map(u => (
                        <button
                           key={u.id}
                           onClick={() => setSelectedUser(u)}
                           className={cn(
                              "p-5 rounded-4xl border text-left transition-all flex flex-col gap-1 group relative overflow-hidden",
                              selectedUser?.id === u.id
                                 ? "bg-primary border-primary shadow-2xl text-on-primary-fixed"
                                 : "bg-surface-lowest border-outline-variant/10 hover:border-primary/30 text-on-surface"
                           )}
                        >
                           <div className="flex items-center justify-between">
                              <span className="font-headline font-black text-sm tracking-tight">{u.username}</span>
                              <span className={cn(
                                 "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                                 selectedUser?.id === u.id ? "bg-white/10 border-white/20" : "bg-primary/5 border-primary/20 text-primary"
                              )}>
                                 {u.role}
                              </span>
                           </div>
                           <span className={cn("text-[9px] font-bold uppercase tracking-widest mt-1 opacity-60", selectedUser?.id === u.id ? "text-white" : "text-outline")}>
                              {personas.filter(p => p.owner_user_id === u.id).length} Neural Assets Assigned
                           </span>
                        </button>
                     ))}
                  </div>
               </div>

               {/* Assignment Panel */}
               <div className="flex-1 space-y-8">
                  {selectedUser ? (
                     <>
                        <div className="bg-surface-low p-8 rounded-6xl border border-primary/20 shadow-xl flex items-center justify-between">
                           <div>
                              <h4 className="text-xl font-headline font-black tracking-tight uppercase">{selectedUser.username} Permissions</h4>
                              <p className="text-[10px] text-outline font-bold uppercase tracking-[0.2em] mt-2">Managing neural link access protocols for this identity.</p>
                           </div>
                           <div className="flex gap-2">
                              <span className="px-4 py-2 rounded-xl bg-surface-lowest border border-outline-variant/10 text-[9px] font-black uppercase tracking-[0.2em] text-primary">ID: {selectedUser.id.substring(0, 8)}</span>
                           </div>
                        </div>

                        <div className="space-y-12">
                           {/* Unique Fleet Section */}
                           <div className="space-y-6">
                              <div className="flex items-center justify-between px-1">
                                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 flex items-center gap-2">
                                    <Zap className="size-4" /> Unique Identity Fleet
                                 </h3>
                                 <span className="text-[10px] font-bold text-outline uppercase tracking-widest">{personas.filter(p => p.owner_user_id === selectedUser.id).length} Active Links</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {personas.filter(p => p.owner_user_id === selectedUser.id).map(p => (
                                    <div key={p.id} className="p-6 rounded-4xl border bg-emerald-500/5 border-emerald-500/20 shadow-sm flex items-center justify-between transition-all hover:bg-emerald-500/10">
                                       <div className="flex items-center gap-4">
                                          <div className="size-12 rounded-2xl bg-surface-lowest flex items-center justify-center text-emerald-500 border border-emerald-500/10">
                                             <UserRound className="size-6" />
                                          </div>
                                          <div>
                                             <h5 className="font-headline font-black text-sm text-emerald-500 uppercase">{p.name}</h5>
                                             <p className="text-[9px] font-bold uppercase tracking-widest text-outline mt-0.5">{p.language} · {p.emotion}</p>
                                          </div>
                                       </div>
                                       <button
                                          onClick={() => handleToggleAssignment(p, false)}
                                          className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                       >
                                          Revoke
                                       </button>
                                    </div>
                                 ))}
                                 {personas.filter(p => p.owner_user_id === selectedUser.id).length === 0 && (
                                    <div className="md:col-span-2 p-14 rounded-6xl border-2 border-dashed border-outline-variant/10 flex flex-col items-center justify-center text-center opacity-40">
                                       <p className="text-[10px] font-black uppercase tracking-[0.3em]">No active neural links</p>
                                    </div>
                                 )}
                              </div>
                           </div>

                           {/* Templates Section */}
                           <div className="space-y-6">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary px-1 flex items-center gap-2">
                                 <Brain className="size-4" /> Neural Blueprints (Source)
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {personas.filter(p => p.owner_user_id!=selectedUser.id).map(p => (
                                    <div key={p.id} className="p-6 rounded-5xl border bg-surface-lowest border-outline-variant/5 hover:border-primary/20 hover:bg-surface-low flex items-center justify-between transition-all group">
                                       <div className="flex items-center gap-4">
                                          <div className="size-12 rounded-2xl bg-surface-low border border-outline-variant/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                             <UserRound className="size-6" />
                                          </div>
                                          <div>
                                             <h5 className="font-headline font-black text-sm text-on-surface uppercase group-hover:text-primary transition-colors">{p.name}</h5>
                                             <p className="text-[9px] font-bold uppercase tracking-widest text-outline mt-0.5">Base Blueprint · {p.language}</p>
                                          </div>
                                       </div>
                                       <button
                                          onClick={() => handleToggleAssignment(p, true)}
                                          className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-[9px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-on-primary-fixed transition-all flex items-center gap-2 shadow-sm"
                                       >
                                          <Plus className="size-3" />
                                          Clone
                                       </button>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </>
                  ) : (
                     <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center opacity-30 mt-10">
                        <div className="size-28 rounded-full bg-surface-low flex items-center justify-center mb-10 border border-outline-variant/10 shadow-inner">
                           <UserRound className="size-12 text-outline/40" />
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-[0.4em] mb-3 font-headline">Select Identity Protocol</h4>
                        <p className="text-[10px] font-bold text-outline uppercase tracking-widest max-w-[240px] mx-auto leading-relaxed">Choose a user identity to configure and assign neural assets from the sidebar.</p>
                     </div>
                  )}
               </div>
            </div>
         ) : (
            <>
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
                  <div className="flex flex-col items-center justify-center py-32 gap-6">
                     <div className="size-24 rounded-4xl bg-surface-low border border-outline-variant/10 flex items-center justify-center group">
                        <UserRound className="size-10 text-outline/40 group-hover:scale-110 transition-transform" />
                     </div>
                     <div className="text-center">
                        <p className="text-lg font-bold text-on-surface">
                           {search ? `No personas match "${search}"` : 'No personas yet'}
                        </p>
                        <p className="text-sm text-outline mt-2 uppercase tracking-widest font-medium">
                           {search ? 'Try a different neural search term' : 'Create your first AI persona to get started'}
                        </p>
                     </div>
                     {!search && (
                        <button
                           onClick={() => setIsForgeOpen(true)}
                           className="flex items-center gap-3 px-8 py-4 bg-primary text-on-primary-fixed rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] hover:scale-105 transition-all mt-4 shadow-xl shadow-primary/20"
                        >
                           <Plus className="size-5" /> Initialize Persona
                        </button>
                     )}
                  </div>
               ) : (
                  <motion.div 
                     layout
                     initial="hidden"
                     animate="visible"
                     variants={{
                        hidden: { opacity: 0 },
                        visible: {
                           opacity: 1,
                           transition: { 
                              staggerChildren: 0.03,
                              delayChildren: 0.1
                           }
                        }
                     }}
                     className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20"
                  >
                     <AnimatePresence mode="popLayout">
                        {filtered.map((persona, i) => (
                           <PersonaCard
                              key={persona.id}
                              persona={persona}
                              index={i}
                              onEdit={p => { setEditingPersona(p); setIsForgeOpen(true); }}
                              onDelete={handleDelete}
                              onToggleDeploy={handleToggleDeploy}
                              isDeleting={deletingId === persona.id}
                              isToggling={togglingId === persona.id}
                              onQuickPreview={handleQuickPreview}
                              activePreviewId={activePreviewId}
                           />
                        ))}
                     </AnimatePresence>
                  </motion.div>
               )}
            </>
         )}

         <AnimatePresence>
            {isForgeOpen && (
               <NeuralIdentityForge
                  onClose={() => { setIsForgeOpen(false); setEditingPersona(null); }}
                  onSave={handleSave}
                  initialPersona={editingPersona}
                  isSaving={isSaving}
               />
            )}
         </AnimatePresence>
      </div>
   );
}
