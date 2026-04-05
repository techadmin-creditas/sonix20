'use client';

import React, { useState } from 'react';
import { Shield, Zap, Settings, Loader2, Plus, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function NoCodeToolForge() {
  const [toolName, setToolName] = useState('');
  const [toolDescription, setToolDescription] = useState('');
  const [toolUrl, setToolUrl] = useState('');
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCreateTool = async () => {
    if (!toolName || !toolUrl) return;
    setIsSubmitLoading(true);
    setSuccess(false);

    try {
      const res = await fetch('http://localhost:8000/api/v1/tools/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: toolName.toLowerCase().replace(/\s+/g, '_'),
          description: toolDescription || `A custom tool to access ${toolUrl}`,
          config: {
            method: 'GET',
            url_template: toolUrl,
          }
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setToolName('');
        setToolDescription('');
        setToolUrl('');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to create tool:', err);
    } finally {
      setIsSubmitLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 group hover:border-blue-500/30 transition-all flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Zap size={20} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">No-Code Tool Forge</h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1.5 italic">Craft dynamic API tools instantly</p>
          </div>
        </div>
        <div className="flex -space-x-2">
           <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900" />
           <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900" />
           <div className="w-6 h-6 rounded-full bg-blue-500/20 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-blue-500">+</div>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">Tool Identifier</label>
          <input 
            type="text" 
            placeholder="e.g. check_balance_api"
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-3 px-4 text-[11px] font-bold text-slate-300 focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-slate-600"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">Logic Endpoint (URL)</label>
          <div className="relative">
            <Settings size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="https://api.yourbank.com/v1/data/{id}"
              className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-[11px] font-bold text-slate-300 focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-slate-600"
              value={toolUrl}
              onChange={(e) => setToolUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">LLM Instruction (Description)</label>
          <textarea 
            placeholder="Tell the bot when to use this tool..."
            rows={3}
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-3 px-4 text-[11px] font-bold text-slate-300 focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-slate-600 resize-none"
            value={toolDescription}
            onChange={(e) => setToolDescription(e.target.value)}
          />
        </div>
      </div>

      <button 
        onClick={handleCreateTool}
        disabled={isSubmitLoading || !toolName || !toolUrl}
        className={`w-full mt-6 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group ${
          success ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-slate-100 text-black hover:bg-white hover:translate-y-[-2px] active:translate-y-[0px] shadow-xl'
        } disabled:opacity-50 disabled:grayscale`}
      >
        {isSubmitLoading ? <Loader2 className="animate-spin" size={16} /> : 
         success ? <CheckCircle size={16} className="text-white" /> : 
         <><Plus size={16} className="group-hover:rotate-90 transition-transform" /> Forge New Tool</>}
      </button>

      <div className="mt-4 flex items-center gap-2 justify-center opacity-30 text-white group-hover:opacity-100 transition-opacity">
         <Shield size={10} />
         <span className="text-[8px] font-bold uppercase tracking-widest italic">Encrypted Secure Inflow</span>
      </div>
    </div>
  );
}
