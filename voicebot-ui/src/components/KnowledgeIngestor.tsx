'use client';

import React, { useState } from 'react';
import { Upload, Globe, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function KnowledgeIngestor({ botId }: { botId: string }) {
  const [url, setUrl] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUrlIngest = async () => {
    if (!url) return;
    setIsUrlLoading(true);
    setMessage(null);
    try {
      const res = await fetch('http://localhost:8000/api/v1/knowledge/ingest/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, bot_id: botId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `URL ingestion started! Job ID: ${data.job_id.slice(0, 8)}` });
        setUrl('');
      } else {
        setMessage({ type: 'error', text: data.detail || 'Failed to ingest URL' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection failed' });
    } finally {
      setIsUrlLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsPdfLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bot_id', botId);

    try {
      const res = await fetch('http://localhost:8000/api/v1/knowledge/ingest/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `PDF uploaded! Job ID: ${data.job_id.slice(0, 8)}` });
      } else {
        setMessage({ type: 'error', text: data.detail || 'Failed to upload PDF' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
      {/* PDF Upload Card */}
      <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[220px] group hover:border-blue-500/30 transition-all">
        <Upload className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" size={32} />
        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Upload Knowledge PDF</h3>
        <p className="text-[10px] text-slate-500 font-bold mb-6">Policy Manuals, Product T&Cs, etc.</p>
        
        <label className="relative cursor-pointer">
          <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={isPdfLoading} />
          <div className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            isPdfLoading ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
          }`}>
            {isPdfLoading ? <Loader2 className="animate-spin inline mr-2" size={12} /> : 'Browse Documents'}
          </div>
        </label>
      </div>

      {/* URL Crawl Card */}
      <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 flex flex-col min-h-[220px] hover:border-amber-500/30 transition-all">
        <div className="flex flex-col items-center mb-6">
          <Globe className="text-amber-500 mb-4 group-hover:scale-110 transition-transform" size={32} />
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Crawl Website</h3>
          <p className="text-[10px] text-slate-500 font-bold">Index live data from a URL</p>
        </div>
        
        <div className="space-y-3 w-full">
          <input 
            type="text" 
            placeholder="https://example.com/api/docs"
            className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-2.5 px-4 text-[11px] font-bold text-slate-300 focus:border-amber-500/50 focus:outline-none transition-all"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button 
            onClick={handleUrlIngest}
            disabled={isUrlLoading || !url}
            className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              isUrlLoading || !url ? 'bg-slate-800 text-slate-500' : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {isUrlLoading ? <Loader2 className="animate-spin inline mr-2" size={12} /> : 'Start Ingestion'}
          </button>
        </div>
      </div>

      {/* Global Message Toast-like */}
      {message && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`col-span-1 md:col-span-2 p-3 rounded-xl flex items-center gap-3 border ${
            message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}
        >
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span className="text-[11px] font-bold uppercase tracking-widest">{message.text}</span>
        </motion.div>
      )}
    </div>
  );
}
