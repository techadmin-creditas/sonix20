'use client';

import { useState, useEffect } from 'react';
import { useVoiceBot } from '@/hooks/useVoiceBot';
import { VoiceOrb } from '@/components/VoiceOrb';
import { Transcript } from '@/components/Transcript';
import { PipelineVisualizer } from '@/components/PipelineVisualizer';
import { KnowledgeMemory } from '@/components/KnowledgeMemory';
import { Settings, LogOut, Terminal, Activity, Zap, Shield, HelpCircle, User, MessageCircle, FileText, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KnowledgeIngestor } from '@/components/KnowledgeIngestor';
import { NoCodeToolForge } from '@/components/NoCodeToolForge';

export default function Home() {
  const { state, transcripts, error, startSession, endSession, interrupt, metrics } = useVoiceBot();
  const [activeTab, setActiveTab] = useState<'transcript' | 'memory'>('transcript');
  const [activeBotId, setActiveBotId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch active bot on mount
    const fetchBots = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/bots');
        const data = await res.json();
        if (data.bots && data.bots.length > 0) {
          setActiveBotId(data.bots[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch bots:', err);
      }
    };
    fetchBots();
  }, []);

  return (
    <main className="min-h-screen bg-[#050608] text-slate-100 flex flex-col font-sans selection:bg-blue-500/30">
      
      {/* 🚀 Header */}
      <header className="h-20 border-b border-white/5 bg-slate-900/10 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center group-hover:rotate-12 transition-all duration-300">
             <Zap size={20} fill="white" className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-white">Agentic Voice</h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
               <Activity size={10} className="text-blue-500" /> Platform Active
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-400">
           <a href="#" className="hover:text-white transition-colors">Architecture</a>
           <a href="#" className="hover:text-white transition-colors">API Keys</a>
           <a href="#" className="hover:text-white transition-colors">Environment</a>
           <a href="#" className="hover:text-white transition-colors font-black text-blue-400 border-b-2 border-blue-500 pb-1">Real-time Lab</a>
        </nav>

        <div className="flex items-center gap-4">
           {error && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold max-w-[200px] truncate">
                 <Shield size={12} /> {error}
              </motion.div>
           )}
           <button className="p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-slate-400">
              <Settings size={20} />
           </button>
           <button className="bg-white/95 text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-white transition-all shadow-lg hover:translate-y-[-2px] active:translate-y-[0px]">
              Deploy Hub
           </button>
        </div>
      </header>

      <section className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto p-6 lg:p-10 gap-8 min-h-0">
        
        {/* 🦾 Live Experience (Left) */}
        <div className="flex-[1.4] flex flex-col gap-8">
           
           <motion.div 
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             className="bg-slate-900/30 border border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl"
           >
              {/* Background Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent opacity-50 pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

              <VoiceOrb state={state} onClick={state === 'idle' ? startSession : interrupt} className="mb-12" />

              {/* Real-time Flow Chart */}
              <div className="w-full max-w-[700px] mt-8 mb-4">
                 <div className="flex items-center justify-between px-2 mb-4">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                       <Activity size={12} className="text-blue-500" /> Pipeline Flow
                    </h2>
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest italic">
                       Latency: {state === 'idle' ? '0ms' : 'Active'}
                    </span>
                 </div>
                 <PipelineVisualizer state={state} />
              </div>

              <div className="flex gap-4 mt-12">
                 <button 
                   onClick={startSession}
                   disabled={state !== 'idle'}
                   className="px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20"
                 >
                   {state === 'idle' ? 'Start Laboratory Session' : 'Reconnect'}
                 </button>
                 <button 
                   onClick={endSession}
                   disabled={state === 'idle'}
                   className="px-8 py-3 rounded-2xl border border-white/10 hover:bg-white/5 disabled:opacity-30 transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2"
                 >
                   <LogOut size={16} /> End Stream
                 </button>
              </div>
           </motion.div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 group cursor-default">
                 <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Shield size={20} className="text-blue-500" />
                 </div>
                 <h3 className="text-xs font-black text-white mb-2 uppercase tracking-widest">Security Guardrails</h3>
                 <p className="text-[10px] text-slate-500 font-bold leading-relaxed tracking-wider">
                    In-memory PII filtering and Prompt Injection protection active. 
                    Latency impact: <span className="text-emerald-500">&lt; 2ms</span>
                 </p>
              </div>
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 group cursor-default">
                 <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative">
                    <Brain size={20} className="text-amber-500" />
                    {metrics?.tokens_turn?.total_tokens > 0 && (
                       <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
                    )}
                 </div>
                 <h3 className="text-xs font-black text-white mb-2 uppercase tracking-widest flex items-center gap-2">
                    Cognitive Load
                    {metrics?.tokens_turn?.total_tokens > 0 && (
                       <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                          +{metrics.tokens_turn.total_tokens}
                       </span>
                    )}
                 </h3>
                 <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-500 tracking-tight">
                       {metrics?.tokens_session?.total?.toLocaleString() || '0'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Tokens consumed</span>
                 </div>
                 <div className="mt-4 flex gap-4 border-t border-white/5 pt-4">
                    <div className="flex flex-col">
                       <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Input</span>
                       <span className="text-[11px] font-mono text-slate-300">
                          {metrics?.tokens_session?.prompt?.toLocaleString() || '0'}
                       </span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Output</span>
                       <span className="text-[11px] font-mono text-slate-300">
                          {metrics?.tokens_session?.completion?.toLocaleString() || '0'}
                       </span>
                    </div>
                 </div>
              </div>
           </div>

        </div>

        {/* 📜 Center/Right Panel: Tabs for History vs Memory */}
        <div className="flex-[0.6] flex flex-col bg-slate-900/30 border border-white/10 rounded-3xl overflow-hidden min-h-[500px] lg:min-h-0 backdrop-blur-sm">
           <div className="p-2 border-b border-white/5 bg-slate-900/40 flex items-center justify-between">
              <div className="flex p-1 bg-black/20 rounded-xl">
                 <button 
                   onClick={() => setActiveTab('transcript')}
                   className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                     activeTab === 'transcript' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                   }`}
                 >
                    <FileText size={12} /> Transcript
                 </button>
                 <button 
                   onClick={() => setActiveTab('memory')}
                   className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                     activeTab === 'memory' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                   }`}
                 >
                    <Brain size={12} /> Knowledge
                 </button>
              </div>
              <div className="flex gap-2 pr-4">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse" />
                 <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              </div>
           </div>
           
           <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'transcript' ? (
                 <>
                   <Transcript transcripts={transcripts} className="flex-1" />
                   <div className="p-6 border-t border-white/5 bg-slate-900/20 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-center gap-2 italic">
                         <HelpCircle size={10} /> Conversation history is stored in local session cache
                      </p>
                   </div>
                 </>
              ) : (
                 <KnowledgeMemory botId={activeBotId || 'default'} className="flex-1 border-none bg-transparent" />
              )}
           </div>
        </div>

      </section>

      {/* 🛠️ Platform Administration Section */}
      <section className="max-w-[1600px] w-full mx-auto px-6 lg:px-10 pb-20">
        <div className="flex items-center justify-between mb-8 px-4">
          <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-3">
             <div className="w-6 h-6 rounded-lg bg-blue-600/10 flex items-center justify-center">
                <Settings size={14} className="text-blue-500" />
             </div>
             Platform Administration
          </h2>
          <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest italic flex items-center gap-2">
             Deployment Zone: Alpha-v1.5
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2">
              <KnowledgeIngestor botId={activeBotId || 'default'} />
           </div>
           <div>
              <NoCodeToolForge />
           </div>
        </div>
      </section>

      {/* 🧭 Footing */}
      <footer className="h-14 border-t border-white/5 bg-slate-900/10 flex items-center justify-center px-8 text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
         Agentic AI Platform v1.5.0-monolith — Secure Build 0xEE22
      </footer>

      {/* 🪄 Floating Glow Elements */}
      <div className="fixed top-[20%] right-[10%] w-[500px] h-[500px] bg-blue-600/5 blur-[150px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-[10%] left-[5%] w-[400px] h-[400px] bg-indigo-600/5 blur-[150px] rounded-full -z-10 pointer-events-none" />

    </main>
  );
}
