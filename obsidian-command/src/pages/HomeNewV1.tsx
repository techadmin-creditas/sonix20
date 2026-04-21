import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronDown, X, Shield, Zap, MessageSquare, Brain, Target, User, ChevronRight, Activity, Play, Layout, Globe, Star, Users } from 'lucide-react';
import { AgentAvatar } from '../components/AgentFlipCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { HomeHero } from '../components/home/HomeHero';
import { HomeTeam } from '../components/home/HomeTeam';
import { HomeCreationLab } from '../components/home/HomeCreationLab';
import { HomeCta } from '../components/home/HomeCta';
import { AGENTS } from '../data/agents';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';
import { NeuralAgentConsolV1 } from '../components/NeuralAgentConsoleV1';
import { NeuralBackground2DV1 } from '../components/NeuralBackground2DV1';

gsap.registerPlugin(ScrollTrigger, Observer);

// MEMOIZED HEAVY BACKGROUND
const MemoBackground = React.memo(() => <NeuralBackground2DV1 />);

// LOCALIZED COMMAND RAIL FOR RENDER ISOLATION
const CommandRail = React.memo(({ agents, selectedId, onSelect }: { agents: any[], selectedId?: string, onSelect: (agent: any) => void }) => {
  return (
    <div className="flex flex-col gap-6 py-8">
      {agents.map((agent, index) => (
        <motion.div
           key={agent.id}
           initial={{ opacity: 0, x: -30 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
        >
          <button 
            onClick={() => onSelect(agent)}
            className={`group relative size-12 md:size-14 rounded-2xl transition-all duration-500 flex items-center justify-center border overflow-hidden ${
              selectedId === agent.id 
              ? 'border-primary shadow-[0_0_20px_var(--primary)] bg-primary/10 scale-110' 
              : 'border-outline-variant opacity-40 hover:opacity-100 hover:border-outline'
            }`}
          >
            <AgentAvatar 
              id={agent.id} 
              name={agent.name} 
              isMini={true} 
              isSwitcher={true} 
              instanceId="sidebar" 
            />

            {selectedId === agent.id && (
              <motion.div layoutId="activeRailIndicator" className="absolute -left-1 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full" />
            )}
            
            {/* TOOLTIP: TACTICAL SUMMARY */}
            <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 w-48 p-3 rounded-2xl bg-surface-lowest border border-outline opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-[100] shadow-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-on-surface uppercase">{agent.name}</span>
                <span className="text-[8px] font-bold text-primary uppercase tracking-widest">{agent.specialty}</span>
              </div>
              <p className="text-[9px] text-on-surface-variant leading-relaxed font-medium">{agent.benefit}</p>
            </div>
          </button>
        </motion.div>
      ))}
    </div>
  );
});

export default function HomeNewV1() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const currentIndexRef = useRef(0);
  const animatingRef = useRef(false);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [activeStep, setActiveStep] = useState(0);

  const totalSections = 4; 

  const handleTryDemo = (agent: any) => {
    setSelectedAgent(agent);
    setIsDemoMode(true);
  };

  useEffect(() => {
    if (isDemoMode) return; 

    const ctx = gsap.context((self) => {
      const gotoSection = (index: number) => {
        if (animatingRef.current || index < 0 || index >= totalSections) return;

        const prevIndex = currentIndexRef.current;
        animatingRef.current = true;
        setAnimating(true);
        setCurrentIndex(index);
        currentIndexRef.current = index;

        const incoming = sectionsRef.current[index];
        const outgoing = sectionsRef.current[prevIndex];

        const tl = gsap.timeline({
          onComplete: () => {
            animatingRef.current = false;
            setAnimating(false);
          }
        });

        gsap.set(incoming, { zIndex: 20, visibility: 'visible', opacity: 0, pointerEvents: 'auto' });
        
        if (outgoing && prevIndex !== index) {
          gsap.set(outgoing, { zIndex: 10, pointerEvents: 'none' });
          tl.to(outgoing, {
            y: index > prevIndex ? -150 : 150,
            scale: 0.85,
            opacity: 0,
            duration: 0.5,
            ease: "power4.inOut"
          }, 0);
          tl.set(outgoing, { visibility: 'hidden' });
        }

        tl.fromTo(incoming, 
          { y: index > prevIndex ? 150 : -150, scale: 1.15, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "power4.inOut" }, 0);
      };

      sectionsRef.current.forEach((section, i) => {
        if (i !== currentIndexRef.current) {
          gsap.set(section, { opacity: 0, visibility: 'hidden', y: 100, pointerEvents: 'none' });
        } else {
          gsap.set(section, { opacity: 1, visibility: 'visible', y: 0, pointerEvents: 'auto' });
        }
      });

      const obs = Observer.create({
        target: window,
        type: "wheel,touch,pointer",
        onDown: () => !animatingRef.current && gotoSection(currentIndexRef.current + 1),
        onUp: () => !animatingRef.current && gotoSection(currentIndexRef.current - 1),
        wheelSpeed: 1,
        tolerance: 100,
        preventDefault: true
      });

      return () => obs.kill();
    }, wrapperRef);

    return () => ctx.revert();
  }, [isDemoMode]); 

  return (
    <div id="smooth-wrapper" ref={wrapperRef} className="fixed inset-0 overflow-hidden bg-background text-on-surface selection:bg-primary/30 touch-none">
      
      <div className="bg-3d-wrapper pointer-events-none fixed inset-0 z-0 opacity-40">
        <MemoBackground />
      </div>

      <header className={`fixed top-0 z-50 w-full border-b border-outline/30 bg-background/40 backdrop-blur-xl transition-transform duration-500 ${isDemoMode ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
            SONIX <span className="text-primary">2.0</span>
          </Link>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link to="/login" className="studio-glow rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-primary-fixed transition-transform hover:scale-105 active:scale-95">
                Login
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div id="smooth-content" ref={contentRef} className="relative z-10 w-full h-full">
        <HomeHero ref={el => { sectionsRef.current[0] = el; }} />
        <HomeTeam 
          ref={el => { sectionsRef.current[1] = el; }} 
          isDemoMode={isDemoMode}
          selectedAgentId={selectedAgent?.id}
          onTryDemo={handleTryDemo}
        />
        <HomeCreationLab 
          ref={el => { sectionsRef.current[2] = el; }}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
        />
        <HomeCta ref={el => { sectionsRef.current[3] = el; }} />
      </div>

      {/* DYNAMIC LABORATORY OVERLAY */}
      <AnimatePresence>
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-3xl overflow-hidden pt-6"
          >
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10 px-6">
               <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-[10px] font-black text-primary tracking-tighter">S2</span>
                  </div>
                  <h3 className="text-[10px] font-black uppercase text-on-surface-variant tracking-[0.3em]">Neural_Console</h3>
               </div>
               <button 
                  onClick={() => setIsDemoMode(false)}
                  className="flex items-center gap-2 rounded-full border border-outline bg-surface/5 py-2.5 px-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant transition-all hover:bg-on-surface hover:text-background"
                >
                  Exit Lab
                  <X className="size-3.5" />
                </button>
            </div>

            <div className="flex h-full w-full pt-20">
              {/* VERTICAL SELECTOR RAIL */}
              <aside className="w-20 md:w-24 border-r border-outline/50 flex flex-col items-center shrink-0 bg-background/20">
                 <div className="text-[9px] font-bold text-on-surface-variant uppercase [writing-mode:vertical-lr] rotate-180 tracking-[0.4em] mb-4">Command Rail</div>
                 <CommandRail 
                   agents={AGENTS} 
                   selectedId={selectedAgent?.id} 
                   onSelect={setSelectedAgent} 
                 />
              </aside>

              {/* MAIN CONSOLE AREA */}
              <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-6 pb-20">
                 <div className="max-w-6xl mx-auto flex flex-col gap-8 h-full">
                    <motion.header
                       layout
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.8, ease: "circOut" }}
                       className="flex flex-col md:flex-row md:items-end justify-between gap-6"
                    >
                       <div className="space-y-1">
                          <motion.div layoutId="tag" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                            <Activity className="size-3 text-primary" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary">Simulation_Active</span>
                          </motion.div>
                          <motion.h1 layoutId="title" className="text-4xl md:text-6xl font-black text-on-surface uppercase tracking-tighter">
                            Astra <span className="text-on-surface-variant">Console</span>
                          </motion.h1>
                       </div>

                       <div className="flex items-center gap-6 divide-x divide-outline/50 p-6 rounded-3xl bg-surface/2 bg-opacity-10 border border-outline/50">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">Bot Persona</span>
                            <span className="text-xs font-black text-on-surface uppercase">{selectedAgent.role}</span>
                          </div>
                          <div className="flex flex-col pl-6">
                            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Network latency</span>
                            <div className="flex items-center gap-1.5">
                               <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                               <span className="text-xs font-black text-emerald-500 uppercase tracking-tight">12ms Response</span>
                            </div>
                          </div>
                       </div>
                    </motion.header>

                    <motion.div
                       layout
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       transition={{ delay: 0.2, duration: 0.8 }}
                       className="flex-1 min-h-0"
                    >
                       <NeuralAgentConsolV1 agent={selectedAgent} />
                    </motion.div>
                 </div>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        section { 
          opacity: 0; 
          visibility: hidden; 
          pointer-events: none;
          will-change: transform, opacity;
          transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        section:first-of-type {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}
