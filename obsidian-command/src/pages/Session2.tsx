import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mic, Shield, Zap, Activity, Clock } from 'lucide-react';
import { api, Bot as BotType } from '../lib/api';
import { useTheme } from '../lib/theme';
import { AgentCommandRail } from '../components/AgentCommandRail';
import { CallDemoPanel } from '../components/home/CallDemoPanel';
import { NeuralBackground2D } from '../components/NeuralBackground2D';
import { Header } from '../components/Header';

export default function Session2() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [allBots, setAllBots] = useState<BotType[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBots() {
      try {
        const bots = await api.getBots();
        setAllBots(bots);
        if (bots.length > 0) {
          setSelectedAgent(bots[0]);
        }
      } catch (err) {
        console.error('Failed to load bots for Session V2:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBots();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5">
          <Activity className="size-8 text-primary animate-spin opacity-40" />
          <p className="text-outline font-bold uppercase tracking-[0.3em] text-[10px]">Synchronizing Neural Streams</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
      {/* Neural Atmosphere */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-30">
        <NeuralBackground2D />
      </div>

      <Header
        title="Live Session"
        subtitle="Advanced neural reality explorer and live-agent rail."
      />

      {/* Main Layout Wrapper */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Inner Station Rail */}
        <aside className={cn(
          "w-20 border-r border-outline-variant/10 shrink-0 overflow-visible transition-all duration-500 z-20 flex flex-col",
          isDark ? "bg-background/20" : "bg-white/10 shadow-lg"
        )}>
          <div className="flex-1 py-6">
            <AgentCommandRail 
              agents={allBots.map(b => ({
                id: b.id,
                name: b.name,
                role: b.role,
                category: 'all',
                specialty: 'NEURAL_LINK',
                languages: 'Multilingual',
                benefit: b.description || 'Neural reality exploration',
                icon: (b as any).icon || 'Zap',
                color: (b as any).color || 'from-primary/20 to-secondary/20',
                details: ['Enterprise Grade', 'Low Latency', 'High Fidelity']
              }))} 
              selectedId={selectedAgent?.id} 
              onSelect={(agent) => {
                const found = allBots.find(b => b.id === agent.id);
                if (found) setSelectedAgent(found);
              }} 
              instanceId="session2-rail" 
            />
          </div>
        </aside>

        {/* Neural Canvas */}
        <main className="flex-1 relative overflow-hidden p-6">
          <AnimatePresence mode="wait">
            {selectedAgent && (
              <motion.div
                key={selectedAgent.id}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 rounded-3xl border border-outline-variant/10 overflow-hidden bg-surface/30 backdrop-blur-xl shadow-2xl shadow-black/5">
                   <CallDemoPanel 
                    className="h-full" 
                    selectedAgent={{
                      ...selectedAgent,
                      category: 'all' // Adapter for the demo panel expectations
                    }} 
                   />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

import { cn } from '../lib/utils';
