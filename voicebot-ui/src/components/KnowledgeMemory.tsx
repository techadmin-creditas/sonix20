'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Trash2, Search, ExternalLink, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Fact {
  id: string;
  content: string;
  source: string;
  category: string;
  timestamp: string;
}

interface KnowledgeMemoryProps {
  botId?: string;
  className?: string;
}

export function KnowledgeMemory({ botId, className = "" }: KnowledgeMemoryProps) {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMemory = async () => {
    if (!botId) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/bots/${botId}/memory`);
      const data = await res.json();
      setFacts(data.facts || []);
    } catch (err) {
      console.error('Failed to fetch memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteFact = async (factId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/memory/${factId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFacts(prev => prev.filter(f => f.id !== factId));
      }
    } catch (err) {
      console.error('Failed to delete fact:', err);
    }
  };

  useEffect(() => {
    fetchMemory();
  }, [botId]);

  const filteredFacts = facts.filter(f => 
    f.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`flex flex-col bg-slate-900/40 border border-white/10 rounded-3xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-white/5 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Brain size={16} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">Autonomous Knowledge</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Learned Facts & Memory</p>
          </div>
        </div>
        <button 
          onClick={fetchMemory}
          className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text"
            placeholder="Search learned knowledge..."
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-[11px] font-medium text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Facts List */}
      <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar p-2">
        <AnimatePresence mode="popLayout">
          {filteredFacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center mb-4 opacity-50">
                <Brain size={20} className="text-slate-600" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No learned facts found</p>
              <p className="text-[9px] text-slate-700 font-medium mt-1">When the bot learns from the web, facts will appear here.</p>
            </div>
          ) : (
            filteredFacts.map((fact) => (
              <motion.div 
                key={fact.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-4 mb-2 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                      fact.source === 'google_search' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {fact.source.replace('_', ' ')}
                    </span>
                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-1">
                      <Clock size={8} /> {new Date(parseFloat(fact.timestamp) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => deleteFact(fact.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                  {fact.content}
                </p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Stats */}
      <div className="p-4 bg-slate-900/20 border-t border-white/5 flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
          {filteredFacts.length} Learned Entries
        </span>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-500 text-[8px] font-bold uppercase tracking-widest">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Auto-Indexer Active
        </div>
      </div>
    </div>
  );
}
