import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Mic, Zap, Cpu } from 'lucide-react';

interface HomeCreationLabProps {
  activeStep: number;
  setActiveStep: (step: number) => void;
}

export const HomeCreationLab = forwardRef<HTMLElement, HomeCreationLabProps>(({ activeStep, setActiveStep }, ref) => {
  return (
    <section 
      ref={ref}
      className="absolute inset-0 h-screen flex flex-col justify-center px-6 md:px-20"
    >
      <div className="grid lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <p className="studio-metadata reveal-item">Build Protocol</p>
          <h2 className="reveal-item text-5xl font-black leading-tight text-on-surface">Your Voice Empire, <br/><span className="text-primary">Built in Seconds.</span></h2>
          <div className="space-y-4">
            {[
              { 
                title: "1. Describe It", 
                body: "Just type what you want your agent to do. Use one of our templates or write your own mission in plain English.", 
                icon: Settings 
              },
              { 
                title: "2. Pick a Voice", 
                body: "Select a voice that matches your brand. Upload a 10-second clip to clone yourself or choose from our ultra-realistic library.", 
                icon: Mic 
              },
              { 
                title: "3. Go Live", 
                body: "Switch it on. Give it a phone number or embed the chat on your site with a single click. No coding required.", 
                icon: Zap 
              }
            ].map((s, i) => (
              <div 
                key={i} 
                onClick={() => setActiveStep(i)}
                className={`cursor-pointer overflow-hidden rounded-3xl border transition-all duration-500 hover:scale-[1.02] active:scale-95 ${
                  activeStep === i 
                    ? 'border-primary/50 bg-primary/5 p-6 shadow-2xl shadow-primary/10' 
                    : 'border-outline bg-surface-low/10 p-5 opacity-40 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-6">
                  <div className={`size-10 shrink-0 rounded-2xl flex items-center justify-center transition-all ${
                    activeStep === i ? 'bg-primary text-on-primary-fixed' : 'bg-surface-high text-on-surface-variant'
                  }`}>
                    <s.icon className="size-5" />
                  </div>
                  <h4 className={`font-black text-xl tracking-tight transition-all ${
                    activeStep === i ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}>{s.title}</h4>
                </div>
                
                <AnimatePresence>
                  {activeStep === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: "circOut" }}
                    >
                      <p className="pt-4 text-on-surface-variant leading-relaxed text-sm">
                        {s.body}
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/60">
                        Build Process Alpha <div className="size-1 rounded-full bg-primary/40" /> Step 0{i+1}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
        
        <div className="reveal-item relative hidden lg:block aspect-square rounded-[60px] border border-primary/20 bg-linear-to-br from-primary/5 to-transparent p-12 overflow-hidden">
           <div className="absolute inset-0 bg-radial-at-tr from-primary/20 to-transparent blur-3xl opacity-50" />
           <div className="relative h-full flex flex-col justify-center items-center">
              {/* DYNAMIC REALITY VIEWER */}
              <svg viewBox="0 0 400 300" className="w-full h-full">
                <AnimatePresence mode="wait">
                  {activeStep === 0 && (
                    <motion.g
                      key="step0"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      transition={{ duration: 0.5 }}
                    >
                      <motion.circle 
                        cx="200" cy="150" r="40" 
                        fill="var(--primary-container)" fillOpacity="0.05" stroke="var(--primary)" strokeWidth="1" strokeDasharray="4 4"
                        animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      />
                      <motion.circle cx="200" cy="150" r="20" fill="var(--background)" stroke="var(--primary)" strokeWidth="2" />
                      <Settings className="size-8 text-primary" x="184" y="134" />
                      {[...Array(6)].map((_, i) => (
                        <motion.path
                          key={i}
                          d={`M${200 + Math.cos(i * 60 * Math.PI/180) * 100},${150 + Math.sin(i * 60 * Math.PI/180) * 100} L200,150`}
                          stroke="white" strokeWidth="0.5" opacity="0.2"
                          animate={{ strokeDashoffset: [20, 0], opacity: [0.1, 0.4, 0.1] }}
                          transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                          strokeDasharray="4 4"
                        />
                      ))}
                      <text x="200" y="220" textAnchor="middle" className="text-[10px] fill-primary font-black uppercase tracking-widest">Awaiting Prompt</text>
                    </motion.g>
                  )}

                  {activeStep === 1 && (
                    <motion.g
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.5 }}
                    >
                      <motion.path
                        d="M50,150 Q100,50 150,150 T250,150 T350,150"
                        fill="none" stroke="var(--primary)" strokeWidth="3"
                        animate={{ d: [
                          "M50,150 Q100,50 150,150 T250,150 T350,150",
                          "M50,150 Q100,250 150,150 T250,150 T350,150",
                          "M50,150 Q100,50 150,150 T250,150 T350,150"
                        ]}}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <Mic className="size-10 text-on-surface" x="180" y="130" />
                      <text x="200" y="220" textAnchor="middle" className="text-[10px] fill-on-surface font-black uppercase tracking-widest">DNA Synthesis</text>
                    </motion.g>
                  )}

                  {activeStep === 2 && (
                    <motion.g
                      key="step2"
                      initial={{ opacity: 0, scale: 1.2 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.5 }}
                    >
                      <motion.path
                        d="M100,150 L200,100 L300,150 L200,200 Z"
                        fill="var(--primary)" fillOpacity="0.05" stroke="var(--primary)" strokeWidth="0.5"
                      />
                      <motion.path
                        d="M100,150 L200,100 L300,150 L200,200 Z"
                        fill="none" stroke="var(--on-surface)" strokeWidth="2" strokeDasharray="10 10"
                        animate={{ strokeDashoffset: [0, -100] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                      />
                      <Zap className="size-12 text-primary" x="174" y="124" />
                      <text x="200" y="240" textAnchor="middle" className="text-[10px] fill-primary font-black uppercase tracking-widest">Network Live</text>
                    </motion.g>
                  )}
                </AnimatePresence>
              </svg>
           </div>
        </div>
      </div>
    </section>
  );
});

HomeCreationLab.displayName = 'HomeCreationLab';
