'use client';

import { motion } from 'framer-motion';
import { BotState } from '@/hooks/useVoiceBot';
import { Mic, Radio, Brain, MessageSquare, Speaker } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineVisualizerProps {
  state: BotState;
  className?: string;
}

const steps = [
  { id: 'listening', label: 'User Audio', icon: Mic, color: 'text-blue-500' },
  { id: 'stt', label: 'STT (Deepgram)', icon: Radio, color: 'text-purple-500' },
  { id: 'processing', label: 'LLM (OpenAI)', icon: Brain, color: 'text-indigo-500' },
  { id: 'tts', label: 'TTS (ElevenLabs)', icon: MessageSquare, color: 'text-rose-500' },
  { id: 'speaking', label: 'Bot Audio', icon: Speaker, color: 'text-emerald-500' },
];

export function PipelineVisualizer({ state, className }: PipelineVisualizerProps) {
  
  const getActiveStep = () => {
    switch (state) {
      case 'listening': return 0;
      case 'processing': return 2;
      case 'speaking': return 4;
      default: return -1;
    }
  };

  const activeIndex = getActiveStep();

  return (
    <div className={cn('flex items-center justify-between w-full px-4 py-8 relative', className)}>
      {/* Background Line */}
      <div className="absolute top-[50%] left-8 right-8 h-[1px] bg-slate-800 -z-10" />
      
      {steps.map((step, i) => {
        const isActive = activeIndex === i;
        const isPassed = activeIndex > i;
        const isProcessing = (state === 'processing' && i === 1) || (state === 'speaking' && i === 3);

        return (
          <div key={step.id} className="flex flex-col items-center gap-3 relative">
            <motion.div
              animate={{
                scale: isActive || isProcessing ? 1.2 : 1,
                borderColor: isActive || isProcessing || isPassed ? 'var(--tw-color-blue-500)' : 'var(--tw-color-slate-800)',
              }}
              className={cn(
                "w-12 h-12 rounded-2xl bg-slate-900 border flex items-center justify-center transition-colors duration-500",
                isActive || isProcessing || isPassed ? "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]" : "border-slate-800"
              )}
            >
              <step.icon 
                size={20} 
                className={cn(
                  "transition-colors duration-500",
                  isActive || isProcessing || isPassed ? step.color : "text-slate-600"
                )} 
              />

              {/* Pulse effect for active node */}
              {(isActive || isProcessing) && (
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={cn("absolute inset-0 rounded-2xl bg-blue-500/20 -z-10")}
                />
              )}
            </motion.div>

            <span className={cn(
              "text-[9px] font-bold uppercase tracking-widest transition-colors duration-500 whitespace-nowrap",
              isActive || isProcessing || isPassed ? "text-slate-200" : "text-slate-600"
            )}>
              {step.label}
            </span>

            {/* Connecting arrows would be better as animated lines, but keep it minimal */}
          </div>
        );
      })}

      {/* Animated Flowing Dots */}
      {state !== 'idle' && (
         <div className="absolute top-[50%] left-0 right-0 h-1 overflow-hidden pointer-events-none -z-10">
            <motion.div
               animate={{ x: ['-100%', '100%'] }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className="w-1/2 h-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"
            />
         </div>
      )}
    </div>
  );
}
