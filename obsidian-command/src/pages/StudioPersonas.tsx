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
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-on-surface focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-outline/20 shadow-inner"
         />
      </div>
   </div>
);

const PremiumSlider = ({ label, value, onChange, description }: { label: string, value: number, onChange: (v: number) => void, description?: string }) => (
   <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
         <div className="flex flex-col">
            <span className="text-[11px] font-black text-on-surface uppercase tracking-tight">{label}</span>
            {description && <span className="text-[9px] text-outline/60 font-medium italic">{description}</span>}
         </div>
         <span className="text-xs font-bold text-indigo-500">{value}%</span>
      </div>
      <div className="relative h-6 flex items-center group">
         <div className="absolute inset-0 h-1.5 top-1/2 -translate-y-1/2 bg-slate-100 rounded-full" />
         <motion.div
            className="absolute inset-y-0 left-0 h-1.5 top-1/2 -translate-y-1/2 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)]"
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
            className="absolute size-4 bg-white rounded-full shadow-lg border-2 border-indigo-500 pointer-events-none"
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
                  <div className="flex items-center gap-2 p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
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
                     formData.selectedVoice === av.id ? "bg-indigo-50 border-indigo-200 shadow-lg" : "bg-white border-slate-100 hover:border-slate-300"
                  )}
               >
                  <div className="size-10 rounded-full bg-slate-50 overflow-hidden border border-slate-200 flex items-center justify-center">
                     <Bot className="size-6 text-indigo-500/40" />
                  </div>
                  <div className="text-left">
                     <div className="text-[11px] font-bold text-slate-900 line-clamp-1 max-w-[120px]">{av.name}</div>
                     <div className="text-[8px] font-medium text-slate-400 uppercase tracking-tighter">{av.provider}</div>
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
                     formData.language === lang.name ? "bg-indigo-50 border-indigo-200 shadow-lg" : "bg-white border-slate-100 hover:border-slate-300"
                  )}
               >
                  <div className="text-left">
                     <div className="text-[11px] font-bold text-slate-900">{lang.name}</div>
                     <div className="text-[8px] font-medium text-slate-400">{lang.sub}</div>
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
                        formData.emotion === tone.name ? "bg-indigo-50 border-indigo-200 shadow-lg" : "bg-white border-slate-100 hover:border-slate-300"
                     )}
                  >
                     <Icon className={cn("size-4", formData.emotion === tone.name ? "text-indigo-500" : "text-slate-400")} />
                     <div className="text-left">
                        <div className="text-[11px] font-bold text-slate-900">{tone.name}</div>
                        <div className="text-[8px] font-medium text-slate-400">{tone.label}</div>
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
            className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] pointer-events-auto"
            onClick={onClose}
         />

         <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="relative w-full max-w-[1100px] h-full bg-slate-50 border-l border-slate-200 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col pointer-events-auto"
         >
            {/* Header */}
            <div className="px-10 py-6 flex items-center justify-between border-b border-slate-200 shrink-0 z-10 bg-white/80 backdrop-blur-md">
               <div className="flex items-center gap-4">
                  <div className="size-10 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                     <Brain className="size-6 text-indigo-500" />
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-slate-900 tracking-tight">NEURALIDENTITY</h2>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Persona Forge</p>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-all">
                     <X className="size-5" />
                  </button>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
               {/* Left Column */}
               <div className="flex-1 overflow-y-auto p-10 scrollbar-none space-y-8">
                  <div className="space-y-8">
                     <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] space-y-8 shadow-sm relative overflow-hidden group/forge">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/forge:opacity-10 transition-opacity">
                           <Fingerprint className="size-24 text-indigo-500" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <PremiumInput
                              label="Name"
                              placeholder="e.g. Athena-7"
                              value={formData.name || ''}
                              onChange={v => patch({ name: v })}
                              icon={Bot}
                           />
                           <div className="space-y-2 group/input">
                              <div className="flex items-center gap-2 mb-1">
                                 <div className="size-1.5 rounded-full bg-indigo-500/50" />
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Primary Logic</label>
                              </div>
                              <div className="relative">
                                 <div className="absolute top-1/2 -translate-y-1/2 left-6 text-slate-300 group-focus-within/input:text-indigo-500 transition-colors">
                                    <BrainCircuit className="size-4" />
                                 </div>
                                 <input
                                    placeholder="Primary Logic..."
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-on-surface focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-outline/20 shadow-inner"
                                    value={formData.psychology || ''}
                                    onChange={e => patch({ psychology: e.target.value })}
                                 />
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <div className="inline-flex p-1 bg-white border border-slate-200 rounded-2xl">
                              {['Voice', 'Language', 'Tone'].map(tab => (
                                 <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={cn(
                                       "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                       activeTab === tab ? "bg-indigo-500 text-white shadow-md" : "text-slate-400 hover:text-slate-900"
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
                                    isRecording ? "border-red-500 bg-red-50 text-red-500" : "border-slate-300 bg-slate-50 text-slate-400 hover:border-indigo-400 hover:bg-indigo-50"
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

                     <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
                        <div className="flex items-center justify-between">
                           <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                              <CloudLightning className="size-3 text-indigo-500" /> Acoustic Tuning
                           </h4>
                           {metadata.stress_corpus.length > 0 && (
                              <button 
                                 onClick={() => setSelectedStressIndex(i => i + 1)}
                                 className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
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
               <div className="w-[440px] p-10 bg-slate-100 border-l border-slate-200 flex flex-col shrink-0">
                  <div className="flex flex-col gap-8 sticky top-0">
                     <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                        <Activity className="size-5 text-indigo-500" /> Entity Preview
                     </h3>

                     <div className={cn(
                        "relative group rounded-[3rem] overflow-hidden bg-white border border-slate-200 shadow-2xl transition-all",
                        !isComplete && "opacity-50 grayscale blur-[2px] pointer-events-none"
                     )}>
                        {!isComplete && (
                           <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-md p-10 text-center">
                              <div className="size-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6 animate-pulse">
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
                           <div className="absolute inset-0 bg-slate-900/40" />
                           <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-slate-900 to-transparent flex flex-col justify-end p-8 space-y-6 pb-2">
                              <div className="flex flex-col">
                                 <div className="flex items-center gap-2 mb-2">
                                    <div className={cn("size-2 rounded-full bg-indigo-400", isPlaying && "animate-ping")} />
                                    <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isPlaying ? "text-indigo-400" : "text-white/20")}>
                                       {isPlaying ? 'Audio Link Active' : 'System Standby'}
                                    </span>
                                 </div>
                                 <h4 className="text-3xl font-bold text-white tracking-tighter">
                                    {availableVoices.find(v => v.id === formData.selectedVoice)?.name || 'Select Identity'}
                                 </h4>
                              </div>

                              <div className="flex gap-4">
                                 <div className="flex items-center gap-1.5 text-[9px] text-white/80 font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                                    <Languages className="size-3" /> {formData.language || 'English'}
                                 </div>
                                 <div className="flex items-center gap-1.5 text-[9px] text-white/80 font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
                                    <ShieldCheck className="size-3" /> {formData.emotion || 'Empathetic'}
                                 </div>
                              </div>

                              <div className="relative pt-4 border-t border-white/20">
                                 <div className="flex items-center gap-0.5 h-16">
                                    {[0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.2, 0.6, 1, 0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.2, 0.6, 1, 0.4, 0.7].map((h, i) => (
                                       <motion.div
                                          key={i}
                                          animate={isPlaying ? { height: ['10%', `${h * 100}%`, '10%'] } : { height: '10%' }}
                                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.05 }}
                                          className={cn(
                                             "flex-1 rounded-full transition-colors duration-500",
                                             isPlaying ? "bg-indigo-400 opacity-60" : "bg-white/20 opacity-20"
                                          )}
                                       />
                                    ))}
                                 </div>
                                 <button
                                    onClick={handlePlayPreview}
                                    disabled={!isComplete}
                                    className="absolute right-0 bottom-6 size-16 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg hover:scale-110 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="px-10 py-8 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2 px-6 py-2 rounded-full bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest">
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
                        "px-10 py-5 rounded-3xl bg-indigo-600 text-white font-black text-[12px] uppercase tracking-[0.3em] flex items-center gap-3 shadow-xl hover:bg-indigo-700 hover:scale-[1.02] transition-all",
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
            <div className="flex-1 min-w-0">
               <h3 className="text-lg font-headline font-extrabold text-on-surface truncate">{persona.name}</h3>
               <div className="flex flex-wrap items-center gap-2 mt-1">
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
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-low border border-outline-variant/10">
                     <Clock className="size-2.5 text-outline" />
                     <span className="text-[7px] font-bold text-outline uppercase tracking-tighter">
                        {new Date(persona.createdAt * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(persona.createdAt * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                     </span>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex gap-1.5">
            <button
               onClick={() => onQuickPreview(persona)}
               className={cn(
                  "p-2.5 rounded-lg transition-all border border-outline-variant/10 shadow-sm",
                  activePreviewId === persona.id ? "bg-primary text-white" : "bg-surface-low hover:bg-surface-high text-outline hover:text-primary"
               )}
               title="Quick Preview"
            >
               {activePreviewId === persona.id ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
            </button>
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
   { name: 'Hardship Advisor', trigger: 'DPD 120+', voice: 'Rachel', emotion: 'Empathetic', language: 'English', urgency: 20, empathy: 95, stability: 90, clarity: 85 },
   { name: 'Early Bird', trigger: 'DPD -5', voice: 'Marcus', emotion: 'Firm', language: 'Hindi', urgency: 85, empathy: 30, stability: 70, clarity: 95 },
   { name: 'Casual Reminder', trigger: 'Standard', voice: 'Saira', emotion: 'Casual', language: 'English', urgency: 45, empathy: 75, stability: 80, clarity: 60 },
];

export default function StudioPersonas() {
   const [personas, setPersonas] = React.useState<AiPersona[]>([]);
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
         <div className="flex justify-between items-start border-b border-outline-variant/10">
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
                  onClick={() => { setEditingPersona(null); setIsForgeOpen(true); }}
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

            {/* <div className="flex gap-2 scrollbar-hide overflow-x-auto">
               {RECOMMENDATIONS.map((rec, i) => (
                  <button
                     key={i}
                     onClick={() => handleSuggest(rec)}
                     className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-white border border-slate-100 whitespace-nowrap group hover:bg-white hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer"
                  >
                     <div className="size-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-100 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        <Sparkles className="size-4" />
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] font-black group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{rec.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{rec.voice}</span>
                           <div className="size-1 rounded-full bg-slate-200" />
                           <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{rec.emotion}</span>
                           <div className="size-1 rounded-full bg-slate-200" />
                           <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{rec.language}</span>
                        </div>
                     </div>
                  </button>
               ))}
            </div> */}
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
                     onClick={() => setIsForgeOpen(true)}
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
                     onEdit={p => { setEditingPersona(p); setIsForgeOpen(true); }}
                     onDelete={handleDelete}
                     onToggleDeploy={handleToggleDeploy}
                     isDeleting={deletingId === persona.id}
                     isToggling={togglingId === persona.id}
                     onQuickPreview={handleQuickPreview}
                     activePreviewId={activePreviewId}
                  />
               ))}
            </div>
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
