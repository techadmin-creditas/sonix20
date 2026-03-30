'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Bot, User, MessageCircle } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface Transcript {
  id: string;
  text: string;
  role: 'user' | 'bot';
  isFinal: boolean;
  timestamp: number;
}

interface TranscriptProps {
  transcripts: Transcript[];
  className?: string;
}

export function Transcript({ transcripts, className }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div 
      ref={scrollRef}
      className={cn('flex flex-col gap-6 overflow-y-auto px-4 py-8 custom-scrollbar scroll-smooth', className)}
    >
      <AnimatePresence mode="popLayout">
        {transcripts.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn(
              "flex flex-col max-w-[85%]",
              t.role === 'user' ? "self-end items-end" : "self-start items-start"
            )}
          >
            {/* Role Header */}
            <div className={cn(
               "flex items-center gap-2 mb-2 px-1",
               t.role === 'user' ? "flex-row-reverse" : "flex-row"
            )}>
               <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center border",
                  t.role === 'user' ? "bg-slate-800 border-slate-700" : "bg-blue-600 border-blue-500"
               )}>
                  {t.role === 'user' ? <User size={12} className="text-slate-400" /> : <Bot size={12} className="text-white" />}
               </div>
               <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t.role === 'user' ? 'You' : 'Agentic Voice'}
               </span>
            </div>

            {/* Message Bubble */}
            <div className={cn(
              "px-4 py-3 rounded-2xl relative break-words text-sm",
              t.role === 'user' 
                ? "bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-slate-100 rounded-tr-none" 
                : "bg-blue-600/10 border border-blue-500/20 text-blue-100 rounded-tl-none ring-1 ring-blue-500/10"
            )}>
              {t.text}
              {!t.isFinal && <motion.span animate={{ opacity: [0.1, 1, 0.1] }} transition={{ repeat: Infinity, duration: 1 }} className="ml-1 text-sky-400">...</motion.span>}
            </div>

            {/* Timestamp */}
            <span className="mt-1.5 px-1 text-[10px] text-slate-600">
              {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {transcripts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center opacity-20 mt-20">
          <MessageCircle size={64} className="text-slate-400 mb-4" />
          <p className="text-slate-400 text-sm italic">Conversation history will appear here...</p>
        </div>
      )}
    </div>
  );
}
