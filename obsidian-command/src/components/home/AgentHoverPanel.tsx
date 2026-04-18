import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, CheckCircle2, Play, BookOpen } from 'lucide-react';
import { AgentAvatar } from '../AgentFlipCard';

interface AgentHoverPanelProps {
  agent: {
    id: string;
    name: string;
    role: string;
    specialty: string;
    languages: string;
    benefit: string;
    details: string[];
    systemPromptPreview: string;
  };
  metric: { stat: string; tag: string };
  snippet: { bot: string; user: string };
  displayName?: string;
  customBenefit?: string;
  customDetails?: string[];
  customRole?: string;
  onTryDemo: () => void;
  /** Pass 'left' | 'right' | 'center' to shift panel horizontally */
  edge?: 'left' | 'right' | 'center';
}

export function AgentHoverPanel({
  agent,
  metric,
  snippet,
  displayName,
  customBenefit,
  customDetails,
  customRole,
  onTryDemo,
  edge = 'center',
}: AgentHoverPanelProps) {
  const [botText, setBotText] = useState('');
  const [showUser, setShowUser] = useState(false);

  const fullBot = snippet.bot.replace(/^"|"$/g, '');

  // Typewriter effect for bot message
  useEffect(() => {
    setBotText('');
    setShowUser(false);
    let i = 0;
    const iv = setInterval(() => {
      if (i < fullBot.length) {
        setBotText(fullBot.slice(0, i + 1));
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => setShowUser(true), 500);
      }
    }, 28);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  const [showPrompt, setShowPrompt] = useState(false);
  const name    = displayName   ?? agent.name;
  const role    = customRole    ?? agent.role;
  const benefit = customBenefit ?? agent.benefit;
  const details = customDetails ?? agent.details;

  const edgeCls =
    edge === 'left'  ? 'left-0 -translate-x-0' :
    edge === 'right' ? 'right-0 left-auto translate-x-0' :
    'left-1/2 -translate-x-1/2';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className={`absolute bottom-[calc(100%+8px)] ${edgeCls} z-50 w-72`}
      onClick={e => e.stopPropagation()}
    >
      <div className="rounded-2xl border border-outline-variant bg-surface/96 backdrop-blur-xl shadow-2xl p-4 overflow-hidden relative min-h-[300px] flex flex-col">
        <AnimatePresence mode="wait">
          {!showPrompt ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3 flex-1 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="size-14 rounded-xl overflow-hidden border border-outline-variant shrink-0">
                  <AgentAvatar id={agent.id} name={name} isMini={false} isSwitcher={false} instanceId={`panel-${agent.id}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{name}</p>
                  <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider truncate">{role}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary">
                    {agent.specialty}
                  </span>
                </div>
              </div>

              <div className="h-px bg-outline-variant/60" />

              {/* Benefit */}
              <p className="text-xs text-on-surface-variant leading-relaxed">{benefit}</p>

              <div className="h-px bg-outline-variant/60" />

              {/* Details */}
              <ul className="space-y-1">
                {details.map(d => (
                  <li key={d} className="flex items-start gap-1.5 text-[11px] text-on-surface-variant">
                    <CheckCircle2 className="size-3 text-emerald-400 mt-0.5 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>

              <div className="h-px bg-outline-variant/60" />

              {/* Languages + stat */}
              <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <Globe className="size-3 text-primary/60" />
                  {agent.languages}
                </div>
                <div className="ml-auto font-bold text-primary">{metric.stat}</div>
              </div>

              <div className="h-px bg-outline-variant/60" />

              {/* Conversation */}
              <div className="rounded-lg bg-surface-low/80 border border-outline-variant p-2.5 space-y-1.5 min-h-[52px]">
                <p className="text-[10px] text-on-surface-variant leading-snug">
                  <span className="text-primary mr-1">🤖</span>
                  {botText}
                  {botText.length < fullBot.length && (
                    <span className="inline-block w-px h-3 bg-primary ml-0.5 animate-pulse" />
                  )}
                </p>
                <AnimatePresence>
                  {showUser && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] text-on-surface-variant leading-snug"
                    >
                      <span className="text-secondary mr-1">👤</span>
                      {snippet.user.replace(/^"|"$/g, '')}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 mt-auto">
                <button
                  onClick={onTryDemo}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-on-primary-fixed text-[11px] font-semibold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20"
                >
                  <Play className="size-3" fill="currentColor" />
                  Try Demo
                </button>
                <button
                  onClick={() => setShowPrompt(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-[11px] font-medium text-on-surface-variant hover:border-primary/50 hover:text-primary transition-all"
                  title="View Prompt"
                >
                  <BookOpen className="size-3" />
                  Prompt
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-3 h-full flex flex-col"
            >
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="size-3.5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Neural Prompt</span>
              </div>
              
              <div className="flex-1 rounded-xl border border-outline-variant bg-surface-lowest/50 p-3 overflow-y-auto thin-scrollbar relative">
                <p className="text-[10px] text-on-surface-variant leading-relaxed font-mono whitespace-pre-wrap">
                  {agent.systemPromptPreview}
                </p>
              </div>

              <div className="flex gap-2 pt-1 mt-auto">
                <button
                  onClick={() => setShowPrompt(false)}
                  className="flex-1 py-2 rounded-lg border border-outline-variant text-[11px] font-bold text-on-surface-variant hover:bg-surface-high transition-all"
                >
                  Back to Overview
                </button>
                <button
                  onClick={onTryDemo}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary-fixed text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all"
                >
                  Launch Lab
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
