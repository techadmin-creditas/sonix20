import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { AgentAvatar } from './AgentFlipCard';
import { useTheme } from '../lib/theme';

interface Agent {
  id: string;
  name: string;
  role: string;
  category: string;
  specialty: string;
  languages: string;
  benefit: string;
  details: string[];
  systemPromptPreview?: string;
  icon?: string;
  color?: string;
  [key: string]: unknown;
}

interface AgentCommandRailProps {
  agents: Agent[];
  selectedId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSelect: (agent: any) => void;
  instanceId: string;
}

export const AgentCommandRail: React.FC<AgentCommandRailProps> = React.memo(({ agents, selectedId, onSelect, instanceId }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const hoveredAgent = agents.find(a => a.id === hoveredId) ?? null;

  const handleMouseEnter = (e: React.MouseEvent, id: string) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    
    // Calculate vertical position relative to the rail container
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (parentRect) {
      let top = rect.top - parentRect.top;
      
      // Smart adjustment: ensure panel doesn't overflow bottom
      const PANEL_H = 480; // Full height estimate
      const parentH = parentRect.height;
      const spaceBelow = parentH - top;
      
      if (spaceBelow < PANEL_H) {
        // Shift up by the deficit, plus a bit of padding
        top = Math.max(12, top - (PANEL_H - spaceBelow) - 12);
      }
      
      setHoveredTop(top);
    }
    
    setHoveredId(id);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredId(null);
    }, 150); // Small buffer to bridge gap
  };

  return (
    <div className="relative h-full flex flex-col overflow-visible">
      {/* Scrollable buttons container */}
      <div ref={scrollRef}
      onWheel={(e) => e.stopPropagation()}
      className="flex-1 overflow-y-auto no-scrollbar py-4 flex flex-col items-center gap-3 w-full">
        {/* Label */}
        <div className="text-[8px] font-bold text-on-surface-variant uppercase [writing-mode:vertical-lr] rotate-180 tracking-[0.4em] mb-2 opacity-50 shrink-0">
          Agents
        </div>

      {/* Agent buttons */}
      {agents.map((agent, index) => {
        const isSelected = agent.id === selectedId;
        const isHovered  = agent.id === hoveredId;
        return (
          <motion.button
            key={agent.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.07, type: 'spring', stiffness: 200, damping: 22 }}
            onClick={() => onSelect(agent)}
            onMouseEnter={(e) => handleMouseEnter(e, agent.id)}
            onMouseLeave={handleMouseLeave}
            className={`relative flex flex-col items-center gap-1 w-14 md:w-16 px-1 py-2 rounded-2xl transition-all duration-300 focus:outline-none shrink-0 ${
              isSelected
                ? isDark
                  ? 'bg-primary/12 border border-primary/40 shadow-[0_0_16px_var(--primary)] shadow-primary/20'
                  : 'bg-primary/8 border border-primary/30 shadow-sm'
                : isDark
                ? 'border border-transparent hover:border-outline-variant opacity-50 hover:opacity-100'
                : 'border border-transparent hover:border-outline-variant opacity-60 hover:opacity-100'
            }`}
          >
            {/* Active left indicator */}
            {isSelected && (
              <motion.div
                layoutId={`railActiveIndicator-${instanceId}`}
                className="absolute -left-0.5 top-1/4 bottom-1/4 w-0.5 rounded-r-full bg-primary"
              />
            )}

            {/* Avatar */}
            <div className={`size-10 rounded-xl overflow-hidden transition-transform duration-200 ${isHovered || isSelected ? 'scale-105' : ''}`}>
              <AgentAvatar id={agent.id} name={agent.name} isMini={true} isSwitcher={true} instanceId={`${instanceId}-${agent.id}`} />
            </div>

            {/* Name */}
            <span className={`text-[9px] font-semibold truncate w-full text-center leading-tight transition-colors ${
              isSelected ? 'text-primary' : 'text-on-surface-variant'
            }`}>
              {agent.name}
            </span>

            {/* Role */}
            <span className="text-[7px] text-outline truncate w-full text-center leading-none hidden md:block">
              {agent.role.split(' ')[0]}
            </span>

            {/* Selected dot */}
            {isSelected && (
              <div className="size-1 rounded-full bg-primary" />
            )}
          </motion.button>
        );
      })}
      </div>

      {/* Hover detail panel - OUTSIDE scroll container to avoid clipping */}
      <AnimatePresence>
        {hoveredAgent && (
          <motion.div
            key={hoveredAgent.id}
            className={`absolute left-[calc(100%+12px)] z-50 w-72 rounded-2xl border shadow-2xl overflow-hidden pointer-events-auto ${
              isDark
                ? 'bg-surface/95 border-outline-variant backdrop-blur-xl shadow-black/40'
                : 'bg-white/97 border-outline-variant backdrop-blur-xl shadow-black/10'
            }`}
            style={{ top: hoveredTop }}
            initial={{ opacity: 0, x: -16, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onMouseEnter={(e) => handleMouseEnter(e, hoveredAgent.id)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Panel header */}
            <div className={`p-4 border-b border-outline-variant ${
              isDark ? 'bg-surface-low/60' : 'bg-surface-low/80'
            }`}>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl overflow-hidden border border-outline-variant shrink-0">
                  <AgentAvatar id={hoveredAgent.id} name={hoveredAgent.name} isMini={false} isSwitcher={false} instanceId={`panel-${instanceId}-${hoveredAgent.id}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-on-surface">{hoveredAgent.name}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      isDark ? 'bg-primary/12 border-primary/30 text-primary' : 'bg-primary/8 border-primary/20 text-primary'
                    }`}>
                      {hoveredAgent.specialty.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">{hoveredAgent.role}</p>
                </div>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed italic">
                "{hoveredAgent.benefit}"
              </p>
            </div>

            <div className="p-4 space-y-4">

              {/* Capabilities */}
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">Capabilities</p>
                <ul className="space-y-1.5">
                  {hoveredAgent.details.map((detail, i) => (
                    <li key={i} className="flex items-start gap-2 text-[10px] text-on-surface-variant">
                      <CheckCircle2 className="size-3 text-primary shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Meta row */}
              <div className="flex items-start gap-4">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-outline mb-1">Languages</p>
                  <p className="text-[9px] text-on-surface-variant">{hoveredAgent.languages}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-outline mb-1">Category</p>
                  <p className="text-[9px] text-on-surface-variant capitalize">{hoveredAgent.category}</p>
                </div>
              </div>

              {/* System prompt preview */}
              {hoveredAgent.systemPromptPreview && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">System Prompt Preview</p>
                  <div className={`rounded-xl border p-2.5 ${
                    isDark ? 'bg-surface-lowest border-outline-variant' : 'bg-surface-low border-outline-variant'
                  }`}>
                    <p className="text-[9px] text-on-surface-variant leading-relaxed line-clamp-3 font-mono">
                      "{hoveredAgent.systemPromptPreview}"
                    </p>
                    <button className="text-[8px] text-primary mt-1 font-medium hover:underline">Read more</button>
                  </div>
                </div>
              )}

              {/* Action */}
              <button
                onClick={() => onSelect(hoveredAgent)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold transition-all ${
                  hoveredAgent.id === selectedId
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-default'
                    : 'bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 active:scale-98'
                }`}
              >
                {hoveredAgent.id === selectedId ? (
                  <><CheckCircle2 className="size-3.5" /> Currently Selected</>
                ) : (
                  <>Select {hoveredAgent.name} <ChevronRight className="size-3.5" /></>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
