import React from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import {
  Mic2,
  Sparkles,
  Play,
  Pause,
  ChevronRight,
  Brain,
  Target,
  Users,
  Globe,
  ShieldCheck,
  Zap,
  UserRound,
  ArrowRight
} from 'lucide-react';
import { api, type AiPersona } from '../lib/api';
import { cn } from '../lib/utils';
import { Header } from '../components/Header';
import { Loader2 } from 'lucide-react';
import { LogoLoader } from '../components/LogoLoader';

// --- Components ---

const VoiceWave = ({ isPlaying, color }: { isPlaying: boolean; color: string }) => {
  return (
    <div className="flex items-center gap-1 h-8 px-2">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className={cn("w-1 rounded-full", color)}
          animate={isPlaying ? {
            height: [8, 24, 12, 28, 10, 20, 8],
          } : {
            height: 4
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
};

const PerspectiveCard = ({ children, className, ...props }: { children: React.ReactNode; className?: string;[key: string]: any }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);
  const shadowX = useTransform(mouseXSpring, [-0.5, 0.5], [20, -20]);
  const shadowY = useTransform(mouseYSpring, [-0.5, 0.5], [20, -20]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
      className={cn("group relative transition-all duration-300", className)}
      {...props}
    >
      <motion.div
        className="absolute -inset-2 bg-primary/5 blur-2xl rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ x: shadowX, y: shadowY }}
      />
      <div style={{ transform: "translateZ(40px)", transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </motion.div>
  );
};

const PersonaCard = ({ persona, isPlaying, onTogglePlay }: { persona: AiPersona; isPlaying: boolean; onTogglePlay: () => void }) => {
  const colorMap: Record<string, string> = {
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-amber-500/10",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-blue-500/10",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10",
    rose: "text-rose-500 bg-rose-500/10 border-rose-500/20 shadow-rose-500/10",
    purple: "text-purple-500 bg-purple-500/10 border-purple-500/20 shadow-purple-500/10",
    cyan: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20 shadow-cyan-500/10",
    teal: "text-teal-500 bg-teal-500/10 border-teal-500/20 shadow-teal-500/10",
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20 shadow-orange-500/10",
  };

  const colorClass = colorMap[persona.themeColor] || colorMap.blue;
  const barColor = `bg-${persona.themeColor}-500`;

  return (
    <PerspectiveCard className="h-full">
      <div className={cn(
        "glass-panel rounded-[2rem] p-6 h-full flex flex-col gap-6 transition-all duration-500",
        "hover:shadow-2xl hover:border-primary/30 active:scale-[0.98]",
        isPlaying ? "border-primary/40 shadow-primary/10" : ""
      )}>
        <div className="flex justify-between items-start">
          <div className={cn("size-14 rounded-2xl flex items-center justify-center border shadow-inner", colorClass)}>
            <UserRound className="size-8" />
          </div>
          <button
            onClick={onTogglePlay}
            className={cn(
              "p-3 rounded-full transition-all duration-300 active:scale-90",
              isPlaying ? "bg-primary text-on-primary shadow-lg shadow-primary/40 ring-4 ring-primary/20" : "bg-surface-high over:bg-surface-highest text-outline"
            )}
          >
            {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-headline font-extrabold tracking-tight">{persona.name}</h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">{persona.gender}</span>
          </div>
          <p className="text-primary text-[10px] font-bold uppercase tracking-[0.2em] mt-1">{persona.language}</p>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-outline uppercase tracking-wider">
              <Mic2 className="size-3 text-primary" />
              Tone
            </div>
            <p className="text-sm font-medium leading-relaxed">{persona.tone}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-outline uppercase tracking-wider">
              <Target className="size-3 text-primary" />
              Use Case
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">{persona.useCase}</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-low border border-outline-variant/5 bg-gradient-to-br from-surface-low to-surface-low/30 relative overflow-hidden group/psych">
            <div className="absolute inset-y-0 left-0 w-1 bg-primary/20 group-hover/psych:bg-primary transition-colors" />
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-widest mb-2">
              <Brain className="size-3.5" />
              Psychology
            </div>
            <p className="text-[11px] leading-relaxed text-on-surface-variant italic">
              &ldquo;{persona.psychology}&rdquo;
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-outline-variant/10 flex items-center justify-between">
          <VoiceWave isPlaying={isPlaying} color={barColor} />
          <button className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:gap-2 transition-all group/btn">
            Select Persona
            <ChevronRight className="size-3 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </PerspectiveCard>
  );
};

// --- Main Page ---

export default function VoicePersonas() {
  const [personas, setPersonas] = React.useState<AiPersona[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [activeTheme, setActiveTheme] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api.listAiPersonas();
        setPersonas(data);
      } catch (err) {
        console.error('Failed to load personas:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = personas.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.language.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const togglePlay = (id: string) => {
    setPlayingId(prev => prev === id ? null : id);
  };

  const handleGenerate = () => {
    if (!searchQuery.trim()) return;
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Animated Background Glow that shifts with Persona */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            backgroundColor: playingId ? "rgba(var(--primary-rgb), 0.05)" : "rgba(0,0,0,0)",
            scale: playingId ? 1.2 : 1
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] rounded-full blur-[160px] opacity-20 transition-all duration-1000"
        />
      </div>

      <Header
        title="Persona Studio"
        subtitle="Voice Character Gallery"
        actions={
          <div className="flex items-center gap-4">
            <div className="bg-surface-low rounded-2xl p-1 pr-3 flex items-center gap-3 border border-outline-variant/10 focus-within:border-primary/50 transition-all shadow-sm shadow-primary/5">
              <input
                type="text"
                placeholder="Describe a voice persona..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm px-4 py-2 w-72"
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="size-3 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    <span>One-Step Create</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      />

      <main className="p-8 lg:p-12 relative z-10">
        <div className="max-w-7xl mx-auto space-y-12">

          <div className="flex items-center justify-between pb-6 border-b border-outline-variant/5">
            <div className="space-y-1">
              <h2 className="text-xl font-headline font-bold">Recommended Personas</h2>
              <p className="text-xs text-outline font-medium tracking-wide uppercase">Psychology-tuned agents for every debt stage</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-outline-variant/20 bg-surface-low text-[10px] font-bold uppercase tracking-widest">
                <Globe className="size-3 text-primary" />
                8 Languages
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-outline-variant/20 bg-surface-low text-[10px] font-bold uppercase tracking-widest">
                <ShieldCheck className="size-3 text-primary" />
                Enterprise Trained
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 min-h-[400px]">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <div className="col-span-full">
                  <LogoLoader text="Syncing Neural Grid..." />
                </div>
              ) : filtered.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                  <UserRound className="size-16 text-outline" />
                  <p className="text-sm font-bold text-outline">No personas found matching your search.</p>
                </div>
              ) : (
                filtered.map((persona, i) => (
                  <motion.div
                    key={persona.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.5 }}
                    onMouseEnter={() => setActiveTheme(persona.themeColor)}
                    onMouseLeave={() => setActiveTheme(null)}
                    layout
                  >
                    <PersonaCard
                      persona={persona}
                      isPlaying={playingId === persona.id}
                      onTogglePlay={() => togglePlay(persona.id)}
                    />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="mt-20 p-12 rounded-[3rem] border border-primary/10 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Brain className="size-48" />
            </div>
            <div className="max-w-2xl space-y-6 relative z-10">
              <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-[0.3em] text-xs">
                <Zap className="size-4" />
                Neural Synergy
              </div>
              <h3 className="text-4xl font-headline font-extrabold tracking-tight leading-[1.1]">
                Voice isn&apos;t just audio.<br />
                It&apos;s <span className="text-primary">Psychology.</span>
              </h3>
              <p className="text-on-surface-variant leading-relaxed">
                Sonix personas aren&apos;t just synthesized text. Each one is trained on a specific behavioral economics model—from warmth-first cooperative triggers (Empathy) to data-driven decision pressure (Authority).
              </p>
              <div className="flex gap-4 pt-4">
                <button className="px-6 py-3 rounded-xl ember-gradient text-on-primary-fixed font-bold text-sm shadow-xl shadow-primary/20 flex items-center gap-2 group">
                  Deep Configuration
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="px-6 py-3 rounded-xl border border-outline-variant/30 font-bold text-sm bg-surface-low/50 backdrop-blur-md">
                  Persona Documentation
                </button>
              </div>
            </div>
          </motion.section>

        </div>
      </main>
    </div>
  );
}
