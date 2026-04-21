import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Activity, Cpu, Shield, Globe, Zap, Maximize2, Volume2 } from 'lucide-react';

export const HomeVideoShowcase = forwardRef<HTMLElement, {}>(({}, ref) => {
  return (
    <section 
      ref={ref}
      className="absolute inset-0 h-screen flex flex-col justify-center px-6 md:px-20 overflow-hidden bg-background"
    >
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* SECTION HEADER */}
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-primary"
          >
            <Zap className="size-3.5" />
            Neural Intelligence Demo
          </motion.div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black leading-tight text-on-surface uppercase tracking-tighter">
            Witness the <span className="text-primary">Intelligence Standard</span> in Action.
          </h2>
        </div>

        {/* VIDEO BLOCK / CARD */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "circOut" }}
          className="relative max-w-4xl mx-auto"
        >
          {/* CARD CONTAINER */}
          <div className="relative rounded-[2.5rem] border border-outline-variant/30 bg-black overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
            
            {/* CARD HEADER / TOP BAR */}
            <div className="absolute top-0 inset-x-0 h-10 bg-linear-to-b from-black/80 to-transparent z-30 px-6 flex items-center justify-between border-b border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                   <div className="flex gap-1">
                      <div className="size-2 rounded-full bg-red-500/80" />
                      <div className="size-2 rounded-full bg-amber-500/80" />
                      <div className="size-2 rounded-full bg-emerald-500/80" />
                   </div>
                   <div className="h-3 w-px bg-white/10 mx-1" />
                   <span className="text-[8px] font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
                     <Activity className="size-2.5 text-primary" />
                     Live_Synthesis_Session.mp4
                   </span>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                      <div className="size-1 rounded-full bg-primary animate-pulse" />
                      <span className="text-[8px] font-bold text-primary uppercase tracking-tighter">Streaming</span>
                   </div>
                   <Maximize2 className="size-3 text-white/40 hover:text-white cursor-pointer transition-colors" />
                </div>
            </div>

            {/* VIDEO PLAYER AREA */}
            <div className="relative aspect-video flex items-center justify-center overflow-hidden">
               {/* Loop Video Background */}
               <video 
                 autoPlay 
                 loop 
                 muted 
                 playsInline
                 className="absolute inset-0 w-full h-h-full object-cover opacity-50"
               >
                 <source src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-circuit-board-14115-large.mp4" type="video/mp4" />
               </video>

               {/* UI Overlays */}
               <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent opacity-60 z-10" />
               
               {/* Waveform Visualization (Bottom Center) */}
               <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-end gap-1 z-20">
                  {[...Array(40)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-primary/60 rounded-full"
                      animate={{ 
                        height: [8, Math.random() * 40 + 10, 8]
                      }}
                      transition={{ 
                        duration: 1 + Math.random(), 
                        repeat: Infinity, 
                        ease: "easeInOut"
                      }}
                    />
                  ))}
               </div>

               {/* Center Play Indicator */}
               <div className="relative z-20 group">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="size-24 rounded-full bg-primary flex items-center justify-center shadow-[0_0_60px_rgba(var(--primary-rgb),0.6)] backdrop-blur-md border border-white/20"
                  >
                    <Play className="size-10 text-on-primary-fixed fill-current ml-1" />
                  </motion.button>
                  <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.4em] text-white opacity-40 group-hover:opacity-100 transition-opacity">
                    Initialize Demo
                  </div>
               </div>

               {/* HUD Metrics (Floating) */}
               <div className="absolute top-14 left-8 z-20 space-y-4">
                  <div className="glass-hud p-3 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl">
                     <span className="text-[7px] font-black text-white/40 uppercase block mb-1">Latency</span>
                     <span className="text-base font-mono font-bold text-emerald-400">12ms</span>
                  </div>
                  <div className="glass-hud p-3 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl">
                     <span className="text-[7px] font-black text-white/40 uppercase block mb-1">Sentiment</span>
                     <span className="text-base font-mono font-bold text-primary">Positive_98%</span>
                  </div>
               </div>

               <div className="absolute top-14 right-8 z-20">
                  <div className="glass-hud p-4 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl space-y-3">
                     <div className="flex items-center gap-3">
                        <Cpu className="size-4 text-primary" />
                        <span className="text-[9px] font-bold text-white uppercase tracking-widest">Reasoning_Core</span>
                     </div>
                     <div className="flex items-center gap-3 text-white/60">
                        <Globe className="size-3" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Global_Edge</span>
                     </div>
                     <div className="flex items-center gap-3 text-white/60">
                        <Shield className="size-3" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Encrypted</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* LOWER CONTROLS BAR */}
            <div className="absolute bottom-0 inset-x-0 h-12 bg-linear-to-t from-black/90 to-transparent z-30 px-8 flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <Play className="size-4 text-white fill-current" />
                   <div className="w-64 h-1 bg-white/10 rounded-full relative overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "65%" }}
                        transition={{ duration: 5, repeat: Infinity }}
                        className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_10px_var(--primary)]"
                      />
                   </div>
                   <span className="text-[9px] font-bold text-white/60 font-mono tracking-widest">02:14 / 03:45</span>
                </div>
                <div className="flex items-center gap-4">
                   <Volume2 className="size-4 text-white/60" />
                   <div className="h-8 w-px bg-white/10" />
                   <div className="studio-glow rounded-full bg-primary/20 border border-primary/40 px-3 py-1 text-[9px] font-black uppercase text-primary">
                      Download Report
                   </div>
                </div>
            </div>
          </div>

          {/* Decorative Background Glows */}
          <div className="absolute -z-10 -top-20 -left-20 size-80 bg-primary/20 blur-[120px] rounded-full" />
          <div className="absolute -z-10 -bottom-20 -right-20 size-80 bg-tertiary/20 blur-[120px] rounded-full" />
        </motion.div>
      </div>

      <style>{`
        .glass-hud {
          box-shadow: inset 0 0 20px rgba(255,255,255,0.02);
        }
      `}</style>
    </section>
  );
});

HomeVideoShowcase.displayName = 'HomeVideoShowcase';
