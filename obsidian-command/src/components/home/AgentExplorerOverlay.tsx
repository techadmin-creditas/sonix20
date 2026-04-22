import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, CheckCircle2, Globe, Play } from 'lucide-react';
import { AgentAvatar } from '../AgentFlipCard';

interface Agent {
  id: string;
  name: string;
  role: string;
  category: string;
  specialty: string;
  languages: string;
  benefit: string;
  details: string[];
}

interface AgentExplorerOverlayProps {
  agents: Agent[];
  metrics: { stat: string; tag: string; useCases: string[] }[];
  customizations?: Record<string, { displayName?: string; customRole?: string }>;
  onClose: () => void;
  onTryDemo: (agent: Agent) => void;
}

const CATEGORIES = ['All', 'fintech', 'banking'];

export function AgentExplorerOverlay({
  agents,
  metrics,
  customizations = {},
  onClose,
  onTryDemo,
}: AgentExplorerOverlayProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = agents.filter(a => {
    const matchesCat = category === 'All' || a.category === category;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      a.specialty.toLowerCase().includes(q) ||
      a.languages.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background/97 backdrop-blur-3xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-outline-variant/40 shrink-0">
        <div className="flex-1 space-y-0.5">
          <h2 className="text-xl font-bold text-on-surface tracking-tight">Agent Library</h2>
          <p className="text-xs text-on-surface-variant">{agents.length} specialized agents available</p>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-on-surface-variant/50" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents, roles, languages…"
            className="w-full pl-8 pr-4 py-2 rounded-xl bg-surface-low border border-outline-variant text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                category === cat
                  ? 'bg-primary text-on-primary-fixed shadow-md shadow-primary/20'
                  : 'text-on-surface-variant hover:bg-surface-low border border-outline-variant'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant text-xs font-medium text-on-surface-variant hover:bg-surface-low transition-all"
        >
          <X className="size-3.5" /> Close
        </button>
      </div>

      {/* Grid */}
      <div onWheel={(e) => e.stopPropagation()} className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-48 text-on-surface-variant"
            >
              <Search className="size-8 mb-3 opacity-30" />
              <p className="text-sm">No agents match your search.</p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              layout
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {filtered.map((agent, i) => {
                const cust = customizations[agent.id] ?? {};
                const name = cust.displayName ?? agent.name;
                const role = cust.customRole ?? agent.role;
                const metricData = metrics[i % metrics.length];

                return (
                  <motion.div
                    key={agent.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 200, damping: 20 }}
                    className="group rounded-2xl border border-outline-variant bg-surface/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 p-5 flex flex-col gap-4 cursor-pointer"
                    onClick={() => onTryDemo(agent)}
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3">
                      <div className="size-14 rounded-xl overflow-hidden border border-outline-variant group-hover:border-primary/40 transition-colors shrink-0">
                        <AgentAvatar id={agent.id} name={name} isMini={false} isSwitcher={false} instanceId={`explorer-${agent.id}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="text-sm font-bold text-on-surface truncate">{name}</h3>
                          <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                        </div>
                        <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider truncate">{role}</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[8px] font-bold text-primary">
                          {agent.specialty}
                        </span>
                      </div>
                    </div>

                    {/* Benefit */}
                    <p className="text-xs text-on-surface-variant leading-relaxed">{agent.benefit}</p>

                    {/* Details */}
                    <ul className="space-y-1 flex-1">
                      {agent.details.map(d => (
                        <li key={d} className="flex items-start gap-1.5 text-[10px] text-on-surface-variant">
                          <CheckCircle2 className="size-2.5 text-emerald-400 mt-0.5 shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-on-surface-variant/60">
                        <Globe className="size-3" />
                        <span className="truncate max-w-[100px]">{agent.languages}</span>
                      </div>
                      <div className="text-[10px] font-bold text-primary">{metricData?.stat}</div>
                    </div>

                    <button
                      onClick={e => { e.stopPropagation(); onTryDemo(agent); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-semibold text-primary group-hover:bg-primary group-hover:text-on-primary-fixed transition-all"
                    >
                      <Play className="size-3" />
                      Try Demo
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
