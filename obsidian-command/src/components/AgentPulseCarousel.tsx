import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { motion } from 'framer-motion';
import { AgentFlipCard } from './AgentFlipCard';
import { Sparkles, ArrowRight } from 'lucide-react';

gsap.registerPlugin(Draggable);

const CATEGORIES = [
  { id: 'all', label: 'All Fintech' },
  { id: 'banking', label: 'Core Banking' },
  { id: 'fintech', label: 'Digital Wealth' }
];

import { AGENTS } from '../data/agents';

export function AgentPulseCarousel({ 
  onSelectAgent, 
  isMini = false,
  isDemoMode = false,
  selectedAgentId = null
}: { 
  onSelectAgent?: (agent: any) => void, 
  isMini?: boolean,
  isDemoMode?: boolean,
  selectedAgentId?: string | null
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef({ x: 0 });
  const driftRef = useRef<gsap.core.Tween | null>(null);

  const filteredAgents = activeCategory === 'all' 
    ? AGENTS 
    : AGENTS.filter(a => a.category === activeCategory);

  const updatePosition = () => {
    if (!trackRef.current) return;
    const items = Array.from(trackRef.current.children) as HTMLElement[];
    if (items.length === 0) return;
    const totalWidth = items[filteredAgents.length].offsetLeft;
    const wrappedX = gsap.utils.wrap(-totalWidth, 0, proxyRef.current.x);
    gsap.set(trackRef.current, { x: wrappedX });
  };

  // MAIN ENGINE & AUTO-DRIFT
  useEffect(() => {
    if (!trackRef.current) return;

    const track = trackRef.current;
    const items = Array.from(track.children) as HTMLElement[];
    if (items.length < filteredAgents.length) return;
    const totalWidth = items[filteredAgents.length].offsetLeft;

    gsap.set(items, { clearProps: "all" });
    gsap.set(track, { opacity: 0, x: 0 });
    proxyRef.current.x = 0;

    driftRef.current = gsap.to(proxyRef.current, {
      x: `-=${totalWidth}`,
      duration: isMini ? 80 : 50,
      ease: "none",
      repeat: -1,
      onUpdate: updatePosition
    });

    // Fade In
    gsap.to(track, { opacity: 1, duration: 0.5, delay: 0.1 });

    // RE-MEASURE ON DEMO END
    if (!isDemoMode && !isMini) {
       // Force a re-measurement of the track
       const refreshMeasurements = () => {
         const currentItems = Array.from(track.children) as HTMLElement[];
         if (currentItems.length >= filteredAgents.length && driftRef.current) {
           const newWidth = currentItems[filteredAgents.length].offsetLeft;
           driftRef.current.vars.x = `-=${newWidth}`;
           driftRef.current.invalidate();
         }
       };
       setTimeout(refreshMeasurements, 100);
    }

    // Wheel Support
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault();
      const delta = (e.deltaY + e.deltaX) * 0.5;
      driftRef.current?.pause();
      proxyRef.current.x -= delta;
      updatePosition();
    };

    const container = containerRef.current;
    container?.addEventListener('wheel', handleWheel, { passive: false });

    // Draggable Support
    const dragProxy = document.createElement("div");
    const draggable = Draggable.create(dragProxy, {
      trigger: containerRef.current,
      type: "x",
      onPress() {
        driftRef.current?.pause();
        this.startX = proxyRef.current.x;
      },
      onDrag() {
        proxyRef.current.x = this.startX + this.x;
        updatePosition();
      }
    });

    return () => {
      driftRef.current?.kill();
      container?.removeEventListener('wheel', handleWheel);
      draggable[0].kill();
    };
  }, [activeCategory, filteredAgents.length, isMini]);

  // RESET & SNAPPING LOGIC
  useEffect(() => {
    if (!isMini && onSelectAgent && !isDemoMode) {
      const centerIndex = filteredAgents.findIndex(a => a.id === (selectedAgentId || 'astra')) + filteredAgents.length;
      if (centerIndex !== -1 && containerRef.current) {
         // Cards are 280px wide + gap-6 (24px) = 304px
         const cardWidth = 304; 
         const targetX = -(centerIndex * cardWidth) + (window.innerWidth / 2) - (cardWidth / 2);
         
         gsap.to(proxyRef.current, {
           x: targetX,
           duration: 1.2,
           ease: "power4.out",
           onUpdate: updatePosition
         });
      }
    }
  }, [isMini, isDemoMode, selectedAgentId]);

  return (
    <div className={`w-full transition-all duration-700 ${isMini ? 'scale-90 -translate-y-4' : 'space-y-4'}`}>
      {!isMini && (
        <div className="reveal-item mx-auto flex w-full max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2 rounded-full border border-outline/10 bg-surface-low/5 p-1 backdrop-blur-3xl">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`relative rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                  activeCategory === cat.id ? 'text-on-primary-fixed' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {activeCategory === cat.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 z-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{cat.label}</span>
              </button>
            ))}
          </div>

          <button className="group flex items-center gap-2 rounded-full border border-outline bg-surface/5 px-4 py-2 transition-all hover:bg-on-surface hover:text-background">
            <span className="text-[9px] font-black uppercase tracking-widest">Fintech Studio</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}

      <div 
        ref={containerRef}
        className={`reveal-item relative flex overflow-hidden cursor-grab active:cursor-grabbing selection:bg-none transition-all duration-700 ${isMini ? 'py-2' : 'py-4'}`}
        onMouseEnter={() => driftRef.current?.pause()}
        onMouseLeave={() => !isDemoMode && driftRef.current?.play()}
      >
        <div className={`pointer-events-none absolute inset-y-0 left-0 z-20 bg-linear-to-r from-background to-transparent ${isMini ? 'w-20' : 'w-32'}`} />
        <div className={`pointer-events-none absolute inset-y-0 right-0 z-20 bg-linear-to-l from-background to-transparent ${isMini ? 'w-20' : 'w-32'}`} />

        <div 
          ref={trackRef} 
          key={activeCategory + (isMini ? '-mini' : '')}
          className="flex gap-6 will-change-transform"
        >
          {[...filteredAgents, ...filteredAgents, ...filteredAgents].map((agent, i) => (
            <div key={`${agent.id}-${i}`} className="shrink-0">
              <AgentFlipCard 
                agent={agent as any} 
                isMini={isMini} 
                instanceId={i.toString()}
                isSelected={agent.id === selectedAgentId}
                isSwitcher={true}
                onTryDemo={(instId) => onSelectAgent?.({ ...agent, instanceId: instId })} 
              />
            </div>
          ))}
        </div>
      </div>

      {!isMini && (
        <div className="reveal-item flex justify-center pt-2">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Full manual wheel & drag control // auto-drifts on mouse out</span>
          </div>
        </div>
      )}
    </div>
  );
}
