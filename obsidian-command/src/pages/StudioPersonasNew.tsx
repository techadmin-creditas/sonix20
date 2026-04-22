import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Search,
    X,
    Edit2,
    Edit3,
    Check,
    Trash2,
    Zap,
    Loader2,
    RefreshCw,
    Bot,
    UserRound,
    Sparkles,
    BrainCircuit,
    Fingerprint,
    Orbit,
    Activity,
    Play,
    Pause,
    ChevronRight,
    MessageSquare,
    Volume2,
    Settings2,
    Cpu,
    ShieldCheck,
    Languages,
    Mic2,
    Brain,
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

const GlassPanel = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
    <div
        onClick={onClick}
        className={cn(
            "bg-white/10 dark:bg-black/20 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-[2.5rem] shadow-2xl",
            className
        )}
    >
        {children}
    </div>
);

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
                className="w-full bg-white/5 dark:bg-black/20 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-on-surface focus:bg-white/10 dark:focus:bg-primary/5 focus:border-primary/50 outline-none transition-all placeholder:text-outline/20 shadow-inner"
            />
            <div className="absolute inset-0 rounded-2xl bg-primary/0 group-focus-within/input:bg-primary/5 pointer-events-none transition-all" />
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
            <span className="text-xs font-bold text-primary">{value}%</span>
        </div>
        <div className="relative h-6 flex items-center group">
            <div className="absolute inset-0 h-1.5 top-1/2 -translate-y-1/2 bg-white/5 rounded-full" />
            <motion.div
                className="absolute inset-y-0 left-0 h-1.5 top-1/2 -translate-y-1/2 bg-linear-to-r from-primary/50 to-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
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
                className="absolute size-4 bg-white rounded-full shadow-lg border-2 border-primary pointer-events-none"
                animate={{ left: `calc(${value}% - 8px)` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
            />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Next-Gen Neural Identity Forge
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
        isDeployed: initialPersona?.isDeployed || false
    }));

    const [activeTab, setActiveTab] = React.useState<'Voice' | 'Language' | 'Tone'>('Voice');
    const [isPlaying, setIsPlaying] = React.useState(false);

    const patch = (val: Partial<AiPersona>) => setFormData(prev => ({ ...prev, ...val }));

    const handlePlayPreview = () => {
        if (!formData.selectedVoice || !formData.language || !formData.emotion) return;
        if (isPlaying) {
            setIsPlaying(false);
            return;
        }
        setIsPlaying(true);
    };

    // Auto-stop after 5s
    React.useEffect(() => {
        let timer: any;
        if (isPlaying) {
            timer = setTimeout(() => setIsPlaying(false), 5000);
        }
        return () => clearTimeout(timer);
    }, [isPlaying]);

    // Restart logic on settings change
    React.useEffect(() => {
        if (isPlaying) {
            setIsPlaying(false);
            setTimeout(() => {
                if (formData.selectedVoice && formData.language && formData.emotion) {
                    setIsPlaying(true);
                }
            }, 300); // Short recalibration gap
        }
    }, [formData.selectedVoice, formData.language, formData.emotion, formData.stability, formData.clarity, formData.expressiveness]);

    const isComplete = !!(formData.selectedVoice && formData.language && formData.emotion);

    const avatars = [
        { id: 'v1', name: 'Rachel', image: '/avatars/rachel.png', label: 'Female • 24y', info: 'Best for: Collections' },
        { id: 'v2', name: 'Marcus', image: '/avatars/marcus.png', label: 'Male • 30y', info: 'Control Room' },
        { id: 'v3', name: 'Saira', image: '/avatars/saira.png', label: 'Female • 28y', info: 'Tech Expert' },
    ];

    const languages = [
        { id: 'en', name: 'English', label: 'United States', sub: 'Primary' },
        { id: 'hi', name: 'Hindi', label: 'India', sub: 'Regional' },
        { id: 'hinglish', name: 'Hinglish', label: 'In-Hi Mix', sub: 'Native Mix' },
        { id: 'es', name: 'Spanish', label: 'Spain', sub: 'Europe' },
    ];

    const tones = [
        { id: 'empathetic', name: 'Empathetic', label: 'Warm & Caring', icon: Brain },
        { id: 'analytical', name: 'Analytical', label: 'Precise & Calm', icon: Cpu },
        { id: 'firm', name: 'Firm', label: 'Direct & Strong', icon: ShieldCheck },
        { id: 'casual', name: 'Casual', label: 'Friendly & Chill', icon: MessageSquare },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Voice':
                return avatars.map((av, i) => (
                    <button
                        key={i}
                        onClick={() => patch({ gender: av.name.includes('Marcus') ? 'Male' : 'Female', selectedVoice: av.name })}
                        className={cn(
                            "flex items-center gap-3 p-2 pr-4 rounded-2xl border transition-all shrink-0",
                            formData.selectedVoice === av.name ? "bg-primary/10 border-primary/20 shadow-lg" : "bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40"
                        )}
                    >
                        <div className="size-10 rounded-full bg-surface-high overflow-hidden border border-white/60">
                            {av.image ? <img src={av.image} alt={av.name} className="w-full h-full object-cover" /> : <Bot className="size-full p-2 text-outline" />}
                        </div>
                        <div className="text-left">
                            <div className="text-[11px] font-bold text-on-surface">{av.name}</div>
                            <div className="text-[8px] font-medium text-outline/60">{av.info}</div>
                        </div>
                    </button>
                ));
            case 'Language':
                return languages.map((lang, i) => (
                    <button
                        key={i}
                        onClick={() => patch({ language: lang.name })}
                        className={cn(
                            "flex items-center gap-3 p-3 px-6 rounded-2xl border transition-all shrink-0",
                            formData.language === lang.name ? "bg-primary/10 border-primary/20 shadow-lg" : "bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40"
                        )}
                    >
                        <div className="text-left">
                            <div className="text-[11px] font-bold text-on-surface">{lang.name}</div>
                            <div className="text-[8px] font-medium text-outline/60">{lang.sub}</div>
                        </div>
                    </button>
                ));
            case 'Tone':
                return tones.map((tone, i) => (
                    <button
                        key={i}
                        onClick={() => patch({ emotion: tone.name })}
                        className={cn(
                            "flex items-center gap-3 p-3 px-6 rounded-2xl border transition-all shrink-0",
                            formData.emotion === tone.name ? "bg-primary/10 border-primary/20 shadow-lg" : "bg-white/40 dark:bg-white/5 border-white/20 hover:border-white/40"
                        )}
                    >
                        <tone.icon className={cn("size-4", formData.emotion === tone.name ? "text-primary" : "text-outline")} />
                        <div className="text-left">
                            <div className="text-[11px] font-bold text-on-surface">{tone.name}</div>
                            <div className="text-[8px] font-medium text-outline/60">{tone.label}</div>
                        </div>
                    </button>
                ));
        }
    };

    return (
        <div className="fixed inset-0 z-100 flex justify-end pointer-events-none" >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/5 backdrop-blur-[2px] pointer-events-auto"
                onClick={onClose}
            />

            <motion.div
                initial={{ x: '100%', opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.5 }}
                transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                className="relative w-full max-w-[1100px] h-[calc(100vh-32px)] m-4 bg-[#F4F1FD] dark:bg-[#0A0A0E] border border-white/40 dark:border-white/10 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col pointer-events-auto"
            >
                {/* 1. Transparent Header */}
                <div className="px-10 py-6 flex items-center justify-between border-b border-white/20 dark:border-white/5 shrink-0 z-10 bg-inherit/50 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="size-10 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20">
                            <Brain className="size-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-on-surface tracking-tight">NEURALIDENTITY</h2>
                            <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Persona Builder</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="px-5 py-2 rounded-full bg-white/40 dark:bg-white/5 border border-white/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/60 transition-all">
                            <Sparkles className="size-3.5 text-primary" /> AI Suggest
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-all">
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                {/* 2. Main Content Split Area */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Left Column (Scrollable Controls) */}
                    <div className="flex-1 overflow-y-auto p-8 scrollbar-none space-y-6">
                        <div className="space-y-6">

                            {/* Designation Block */}
                            <div className="p-8 bg-white/40 dark:bg-black/30 border border-white/20 dark:border-white/5 rounded-[2.5rem] space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden group/forge">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/forge:opacity-10 transition-opacity">
                                    <Fingerprint className="size-24 text-primary" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <PremiumInput
                                        label="Name"
                                        placeholder="e.g. Athena-7"
                                        value={formData.name || ''}
                                        onChange={v => patch({ name: v })}
                                        icon={Bot}
                                    />
                                    <div className="space-y-2 group/input">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="size-1.5 rounded-full bg-primary/50" />
                                            <label className="text-[10px] font-black text-outline uppercase tracking-[0.2em]">Primary Logic</label>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute top-1/2 -translate-y-1/2 left-6 text-outline/30 group-focus-within/input:text-primary transition-colors">
                                                <BrainCircuit className="size-4" />
                                            </div>
                                            <input
                                                placeholder="Primary Logic..."
                                                className="w-full bg-white/5 dark:bg-black/20 border border-white/10 rounded-2xl pl-14 pr-6 py-5 text-sm font-bold text-on-surface focus:bg-white/10 dark:focus:bg-primary/5 focus:border-primary/50 outline-none transition-all placeholder:text-outline/20 shadow-inner"
                                                value={formData.psychology || ''}
                                                onChange={e => patch({ psychology: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="inline-flex p-1 bg-white/40 dark:bg-white/5 border border-white/20 rounded-2xl">
                                        {['Voice', 'Language', 'Tone'].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab as any)}
                                                className={cn(
                                                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                    activeTab === tab ? "bg-primary text-on-primary-fixed shadow-md" : "text-outline hover:text-on-surface"
                                                )}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                                    {renderTabContent()}
                                </div>
                            </div>

                            {/* Secondary Controls Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white/40 dark:bg-white/5 border border-white/20 rounded-[2.5rem] p-8 space-y-6 shadow-sm relative overflow-hidden">
                                    <h4 className="text-[10px] font-black text-on-surface uppercase tracking-widest">Acoustic Tuning</h4>
                                    <div className="space-y-6">
                                        <PremiumSlider label="Stability" value={formData.stability || 80} onChange={v => patch({ stability: v })} />
                                        <PremiumSlider label="Clarity" value={formData.clarity || 60} onChange={v => patch({ clarity: v })} />
                                        <PremiumSlider label="Expressiveness" value={formData.expressiveness || 35} onChange={v => patch({ expressiveness: v })} />
                                    </div>
                                </div>

                                {/* <div className="bg-white/40 dark:bg-white/5 border border-white/20 rounded-[2.5rem] p-8 space-y-6 shadow-sm relative overflow-hidden">
                                    <h4 className="text-[10px] font-black text-on-surface uppercase tracking-widest">Behavior Matrix</h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-outline uppercase tracking-widest ml-1">Goal</label>
                                            <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 text-xs font-bold text-on-surface outline-none appearance-none">
                                                <option>Recover Payments</option>
                                                <option>Lead Generation</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-outline uppercase tracking-widest ml-1">Style</label>
                                            <select className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-3.5 text-xs font-bold text-primary outline-none appearance-none">
                                                <option>Soft Persuasion</option>
                                                <option>Direct & Firm</option>
                                            </select>
                                        </div>
                                        <div className="pt-2 flex items-center justify-between">
                                            <span className="text-[9px] font-black text-outline uppercase tracking-widest">Strictness</span>
                                            <div className="flex gap-1">
                                                {[1, 2, 3].map(i => <div key={i} className={cn("size-2 rounded-full", i <= 2 ? "bg-primary" : "bg-white/10")} />)}
                                            </div>
                                        </div>
                                    </div>
                                </div> */}
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Fixed Preview) */}
                    <div className="w-[440px] p-10 bg-white/5 dark:bg-black/30 border-l border-white/20 dark:border-white/5 flex flex-col shrink-0">
                        <div className="flex flex-col gap-8 sticky top-0">
                            <h3 className="text-xl font-bold text-on-surface flex items-center gap-3">
                                <Activity className="size-5 text-primary" /> Entity Preview
                            </h3>

                            <div className={cn(
                                "relative group rounded-[3rem] overflow-hidden bg-white/40 dark:bg-white/5 border border-white/20 shadow-2xl transition-all",
                                !isComplete && "opacity-50 grayscale blur-[2px] pointer-events-none"
                            )}>
                                {!isComplete && (
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md p-10 text-center">
                                        <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center mb-6 animate-pulse">
                                            <Lock className="size-8 text-primary" />
                                        </div>
                                        <h5 className="text-white font-bold text-lg mb-2 uppercase tracking-tighter">Acoustic Link Offline</h5>
                                        <p className="text-white/60 text-[10px] font-medium leading-relaxed uppercase tracking-widest">
                                            Select Voice, Language, and Tone <br /> to initialize identity
                                        </p>
                                    </div>
                                )}
                                <div className="aspect-4/5 relative">
                                    <img
                                        src={avatars.find(a => a.name === formData.selectedVoice)?.image || avatars[0].image}
                                        alt="Current Persona"
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40" />
                                    <img
                                        src="/ui/neural-waves.png"
                                        alt="Neural Waves"
                                        className="w-full h-full object-cover mix-blend-screen opacity-60"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/99 to-transparent flex flex-col justify-end p-8 space-y-6">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className={cn("size-2 rounded-full bg-primary", isPlaying && "animate-ping")} />
                                                <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isPlaying ? "text-primary" : "text-white/20")}>
                                                    {isPlaying ? 'Audio Link Active' : 'System Standby'}
                                                </span>
                                            </div>
                                            <h4 className="text-3xl font-bold text-white tracking-tighter">{formData.selectedVoice || 'Rachel'}</h4>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-1.5 text-[9px] text-white/60 font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                                <Languages className="size-3" /> {formData.language || 'English'}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] text-white/60 font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                                <ShieldCheck className="size-3" /> {formData.emotion || 'Empathetic'}
                                            </div>
                                        </div>

                                        <div className="relative pt-4 border-t border-white/10">
                                            <div className="flex items-center gap-0.5 h-16">
                                                {[0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.2, 0.6, 1, 0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.2, 0.6, 1, 0.4, 0.7].map((h, i) => (
                                                    <motion.div
                                                        key={i}
                                                        animate={isPlaying ? { height: ['10%', `${h * 100}%`, '10%'] } : { height: '10%' }}
                                                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.05 }}
                                                        className={cn(
                                                            "flex-1 rounded-full transition-colors duration-500",
                                                            isPlaying ? "bg-linear-to-t from-primary/20 via-primary to-primary/20 opacity-60" : "bg-white/10 opacity-20"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                onClick={handlePlayPreview}
                                                disabled={!isComplete}
                                                className="absolute right-0 bottom-6 size-16 rounded-full bg-primary flex items-center justify-center text-on-primary-fixed shadow-[0_0_50px_rgba(var(--primary-rgb),0.5)] hover:scale-110 transition-all z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isPlaying ? <Pause className="size-8" /> : <Play className="size-7 fill-current" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-white/20 backdrop-blur-md flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                            <Settings2 className="size-4 text-primary" />
                                        </div>
                                        <span className="text-xs font-bold text-on-surface">Neural Signature V2.1</span>
                                    </div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="size-1.5 rounded-full bg-primary" />)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Bottom Action Bar */}
                <div className="px-10 py-8 bg-white/40 dark:bg-white/5 backdrop-blur-xl border-t border-white/20 dark:border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                        {isComplete ? (
                            <><CheckCircle2 className="size-4" /> Persona Ready ✓</>
                        ) : (
                            <><Loader2 className="size-4 animate-spin" /> Neural Profile Incomplete</>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handlePlayPreview}
                            disabled={!isComplete}
                            className="px-10 py-5 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/20 text-on-surface font-black text-[12px] uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-white/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
                            {isPlaying ? 'Stop Stream' : 'Preview Voice'}
                        </button>
                        <button
                            onClick={() => onSave(formData)}
                            disabled={isSaving || !formData.name}
                            className={cn(
                                "px-10 py-5 rounded-3xl bg-linear-to-r from-primary to-[#7C3AED] text-on-primary-fixed font-black text-[12px] uppercase tracking-[0.3em] flex items-center gap-3 shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.02] transition-all",
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
    deletingId: string | null;
    togglingId: string | null;
}

const PersonaCard: React.FC<PersonaCardProps> = ({
    persona,
    index,
    onEdit,
    onDelete,
    onToggleDeploy,
    deletingId,
    togglingId,
}) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="bg-white rounded-[2.5rem] p-8 group relative overflow-hidden transition-all border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] flex flex-col h-full"
    >
        {/* Header */}
        <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="flex items-center gap-5">
                <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-primary/70 transition-transform group-hover:scale-105 shadow-inner">
                    <UserRound className="size-8 stroke-[1.5]" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1">{persona.name}</h3>
                    <div className="flex items-center gap-3">
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">{persona.language}</p>
                        {persona.isDeployed && (
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                                <div className="size-1 rounded-full bg-emerald-500" />
                                <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">Active</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => onEdit(persona)}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-500 transition-all border border-slate-100"
                    title="Edit Persona"
                >
                    <Edit2 className="size-4" />
                </button>
                <button
                    onClick={() => onDelete(persona)}
                    disabled={deletingId === persona.id}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-all border border-slate-100 disabled:opacity-50"
                    title="Delete Persona"
                >
                    {deletingId === persona.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
            </div>
        </div>

        <div className="space-y-6 relative z-10 flex-1 flex flex-col">
            <p className="text-[11px] font-bold text-slate-400 tracking-wide uppercase">
                {persona.tone} · {persona.useCase}
            </p>

            <div className="p-6 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                <p className="text-[13px] leading-relaxed font-semibold italic text-slate-700">
                    &ldquo;{persona.psychology || 'Neural persona profile synchronized and operational.'}&rdquo;
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-auto">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><Activity className="size-3.5" /> Urgency</p>
                    <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 transition-all" style={{ width: `${persona.urgency ?? 45}%` }} />
                    </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><Sparkles className="size-3.5" /> Empathy</p>
                    <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${persona.empathy ?? 75}%` }} />
                    </div>
                </div>
            </div>

            <button
                onClick={() => onToggleDeploy(persona)}
                disabled={togglingId === persona.id}
                className={cn(
                    "w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all group/btn border disabled:opacity-60",
                    persona.isDeployed
                        ? "bg-indigo-50 border-indigo-100 text-indigo-500 shadow-sm"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-500 border-slate-100"
                )}
            >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2">
                    {persona.isDeployed ? 'Decommission Node' : 'Initialize Node'}
                </span>
                {togglingId === persona.id
                    ? <Loader2 className="size-4 animate-spin" />
                    : persona.isDeployed
                        ? <Check className="size-4 text-indigo-400" />
                        : <ChevronRight className="size-4 group-hover/btn:translate-x-1 transition-transform" />
                }
            </button>
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function StudioPersonasNew() {
    const [personas, setPersonas] = React.useState<AiPersona[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isForgeOpen, setIsForgeOpen] = React.useState(false);
    const [editingPersona, setEditingPersona] = React.useState<AiPersona | null>(null);
    const [search, setSearch] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    const [togglingId, setTogglingId] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api.listAiPersonas();
            setPersonas(data);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

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
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (p: AiPersona) => {
        setDeletingId(p.id);
        try {
            await api.deleteAiPersona(p.id);
            setPersonas(prev => prev.filter(x => x.id !== p.id));
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggle = async (p: AiPersona) => {
        setTogglingId(p.id);
        try {
            const updated = await api.toggleAiPersonaDeploy(p.id);
            setPersonas(prev => prev.map(x => x.id === updated.id ? updated : x));
        } finally {
            setTogglingId(null);
        }
    };

    const filtered = personas.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-20">
                <Loader2 className="size-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col space-y-10">
            {/* Quick Actions & Search Row */}
            <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 relative group w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-5 text-outline opacity-40" />
                    <input
                        type="text"
                        placeholder="Neural Signature Search..."
                        className="w-full h-16 pl-14 pr-6 bg-surface-low/30 border border-outline-variant/10 rounded-2xl text-on-surface font-bold placeholder:text-outline/30 focus:bg-white/10 focus:border-primary/30 outline-none transition-all"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => { setEditingPersona(null); setIsForgeOpen(true); }}
                        className="h-16 px-8 rounded-2xl bg-linear-to-r from-primary to-[#7C3AED] text-on-primary-fixed font-black text-[12px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all flex items-center gap-3"
                    >
                        <Plus className="size-5" />
                        New Agent
                    </button>
                    <button onClick={load} className="size-16 rounded-2xl bg-surface-low/50 border border-outline-variant/10 text-outline hover:text-primary transition-all flex items-center justify-center">
                        <RefreshCw className="size-6" />
                    </button>
                </div>
            </div>

            {/* Entity Grid */}
            <AnimatePresence mode="popLayout">
                <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {filtered.map((p, i) => (
                        <PersonaCard
                            key={p.id}
                            persona={p}
                            index={i}
                            onEdit={(persona) => { setEditingPersona(persona); setIsForgeOpen(true); }}
                            onDelete={handleDelete}
                            onToggleDeploy={handleToggle}
                            deletingId={deletingId}
                            togglingId={togglingId}
                        />
                    ))}
                </motion.div>
            </AnimatePresence>

            <AnimatePresence>
                {isForgeOpen && (
                    <NeuralIdentityForge
                        onClose={() => setIsForgeOpen(false)}
                        onSave={handleSave}
                        initialPersona={editingPersona}
                        isSaving={isSaving}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
