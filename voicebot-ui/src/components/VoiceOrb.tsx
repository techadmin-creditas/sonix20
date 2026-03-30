'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BotState } from '@/hooks/useVoiceBot';

interface VoiceOrbProps {
  state: BotState;
  onClick: () => void;
  className?: string;
}

const stateStyles: Record<BotState, string> = {
  idle: 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]',
  listening: 'bg-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.7)]',
  processing: 'bg-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.6)]',
  speaking: 'bg-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.8)]',
  interrupted: 'bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]',
  error: 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
};

export function VoiceOrb({ state, onClick, className }: VoiceOrbProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'w-48 h-48 rounded-full cursor-pointer transition-all duration-500 ease-in-out',
            stateStyles[state]
          )}
          onClick={onClick}
        >
          {/* Pulsing effect */}
          {state !== 'idle' && (
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.2, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={cn(
                'absolute inset-0 rounded-full blur-xl',
                stateStyles[state]
              )}
            />
          )}

          {/* Ripple effect for speaking */}
          {state === 'speaking' && (
            <>
              {[1.2, 1.5, 1.8].map((scale, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.4
                  }}
                  className="absolute inset-0 rounded-full bg-rose-400/30"
                />
              ))}
            </>
          )}

          {/* Core glow */}
          <div className="absolute inset-4 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center overflow-hidden">
             {/* Dynamic waves if speaking/listening */}
             {(state === 'speaking' || state === 'listening') && (
                <div className="flex gap-1 items-end h-12">
                   {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <motion.div
                         key={i}
                         animate={{
                            height: i % 2 === 0 ? [10, 40, 10] : [20, 50, 20],
                         }}
                         transition={{
                            duration: 0.5 + Math.random(),
                            repeat: Infinity,
                            delay: i * 0.1
                         }}
                         className={cn(
                            "w-1.5 rounded-full bg-white",
                             state === 'speaking' ? "bg-rose-100" : "bg-purple-100"
                         )}
                      />
                   ))}
                </div>
             )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute -bottom-12 text-center w-full">
        <span className="text-sm font-medium text-slate-400 tracking-widest uppercase">
          {state === 'idle' ? 'Click to Start' : state}
        </span>
      </div>
    </div>
  );
}
