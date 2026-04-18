import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Bot, ArrowRight, Zap, RefreshCw } from 'lucide-react';

interface AgentData {
  id: string;
  name: string;
  role: string;
  specialty: string;
  languages: string;
  benefit: string;
  color: string;
  details: string[];
}

// SHARED AVATAR COMPONENT FOR PERFECT MORPHING
export const AgentAvatar = ({ id, name, color, isMini, instanceId, isSwitcher = false }: { id: string, name: string, color?: string, isMini: boolean, instanceId?: string, isSwitcher?: boolean }) => {
  const getAvatarContent = () => {
    return (
      <img 
        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} 
        alt={name} 
        className="size-full bg-zinc-950 object-cover"
      />
    );
  };

  return (
    <motion.div 
      layoutId={isSwitcher ? `avatar-container-${id}-${instanceId}-switcher` : `avatar-container-${id}-${instanceId}`}
      className={`relative rounded-full bg-linear-to-br from-zinc-800 to-black ring-1 ring-white/10 flex items-center justify-center overflow-hidden size-full p-[10%]`}
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-30 pointer-events-none" />
      <motion.div 
        layoutId={isSwitcher ? `avatar-svg-${id}-${instanceId}-switcher` : `avatar-svg-${id}-${instanceId}`} 
        className="size-full items-center justify-center flex"
      >
        {getAvatarContent()}
      </motion.div>
    </motion.div>
  );
};

export const AgentFlipCard = ({ 
  agent, 
  onTryDemo,
  isMini = false,
  instanceId = 'base',
  isSelected = false,
  isSwitcher = false
}: { 
  agent: AgentData; 
  onTryDemo?: (instanceId: string) => void;
  isMini?: boolean;
  instanceId?: string;
  isSelected?: boolean;
  isSwitcher?: boolean;
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className={`group relative transition-all duration-500 ${isMini ? 'w-[280px] h-[80px]' : 'w-[280px] h-[400px] [perspective:1200px]'}`}
    >
      <motion.div
        className={`relative h-full w-full transition-all duration-700 ${!isMini && '[transform-style:preserve-3d]'}`}
        animate={{ rotateY: isFlipped && !isMini ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* FRONT SIDE */}
        <div 
          onClick={isMini ? () => onTryDemo?.(instanceId) : undefined}
          className={`absolute inset-0 backface-hidden rounded-[32px] border transition-all ${
            isMini 
              ? `p-3 cursor-pointer active:scale-[0.98] ${isSelected ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.2)]' : 'border-white/10 bg-zinc-900/40 hover:bg-white/5'}` 
              : 'p-6 border-white/10 bg-zinc-900/40 backdrop-blur-xl'
          }`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-0 rounded-[32px] bg-radial-at-tr from-white/5 to-transparent opacity-50" />
          
          <div className={`relative z-10 flex h-full ${isMini ? 'flex-row items-center gap-4' : 'flex-col justify-between'}`}>
            
            {/* COLUMN 1: IMAGE (AVATAR) */}
            <div className={isMini ? 'shrink-0' : 'space-y-4'}>
              {!isMini && (
                <div className="flex items-center justify-between mb-4">
                  <span className={`rounded-full bg-linear-to-r px-3 py-1 text-[8px] font-black uppercase tracking-widest text-white shadow-lg ${agent.color}`}>
                    {agent.specialty}
                  </span>
                  <div className="flex size-6 items-center justify-center rounded-full border border-zinc-700 bg-black/50">
                    <Globe className="size-3 text-zinc-500" />
                  </div>
                </div>
              )}

              {/* SHARED AVATAR */}
              <div className={isMini ? 'size-14' : 'size-32'}>
                <AgentAvatar id={agent.id} name={agent.name} color={agent.color} isMini={isMini} instanceId={instanceId} isSwitcher={isSwitcher} />
              </div>
            </div>

            {/* COLUMN 2: DATA & ACTION */}
            <div className={`flex flex-col flex-1 ${isMini ? 'justify-center h-full' : ''}`}>
               {/* ZONE 1: NAME & IDENTITY */}
               <motion.div 
                 layoutId={isSwitcher ? `info-${agent.id}-${instanceId}-switcher` : `info-${agent.id}-${instanceId}`}
                 className="text-left"
               >
                 <h3 className={`font-headline font-black leading-tight ${isSelected ? 'text-orange-500' : 'text-white'} ${isMini ? 'text-sm tracking-tight' : 'text-2xl'}`}>{agent.name}</h3>
                 {!isMini && <p className="font-bold uppercase tracking-widest text-zinc-500 text-[10px] mt-1">{agent.role}</p>}
               </motion.div>

               {/* STANDARD ACTION (FULL CARD) */}
               {!isMini && (
                 <div className="space-y-4 mt-auto">
                   <p className="text-center text-[11px] font-medium leading-relaxed text-zinc-400">
                     {agent.benefit}
                   </p>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       onTryDemo?.(instanceId);
                     }}
                     className="w-full rounded-2xl bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-orange-500 active:scale-95"
                   >
                     Start Live Demo
                   </button>
                 </div>
               )}
            </div>

            {/* DNA INSIGHTS (ONLY FULL) */}
            {!isMini && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(true);
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
              >
                DNA Insights <ArrowRight className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* BACK SIDE (ONLY FULL) */}
        {!isMini && (
          <div 
            className="absolute inset-0 backface-hidden transform-[rotateY(180deg)] rounded-[32px] border border-orange-500/30 bg-black p-6 shadow-2xl shadow-orange-500/10"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Capabilities</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className="rounded-full bg-zinc-900 p-2 text-zinc-500 hover:text-white"
                  >
                    <ArrowRight className="size-3 -rotate-180" />
                  </button>
                </div>

                <div className="space-y-3">
                  {agent.details.map((detail, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="mt-1 size-1 bg-orange-500 rounded-full" />
                      <p className="text-[11px] font-medium leading-relaxed text-zinc-300">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl bg-zinc-900/50 p-4">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-500">Language Mesh</span>
                  <p className="mt-1 text-[10px] font-black text-white">{agent.languages}</p>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onTryDemo?.(instanceId);
                }}
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-white active:scale-95 shadow-xl shadow-orange-500/20"
              >
                Initialize Link
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
