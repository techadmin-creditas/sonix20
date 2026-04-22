import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Mic, Zap, Cpu, Network, Radio } from 'lucide-react';

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
      <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        {/* LEFT COLUMN: STEPS */}
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="studio-metadata reveal-item flex items-center gap-2">
              <Cpu className="size-4" /> Build Protocol
            </p>
            <h2 className="reveal-item text-4xl lg:text-5xl font-black leading-tight text-on-surface">
              Your Voice Empire, <br /><span className="bg-linear-to-r from-primary via-tertiary to-primary bg-clip-text text-transparent">Built in Seconds.</span>
            </h2>
          </div>

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
                className={`group cursor-pointer overflow-hidden rounded-3xl border transition-all duration-500 hover:scale-[1.02] active:scale-95 relative ${activeStep === i
                    ? 'border-primary/40 bg-surface-lowest/80 backdrop-blur-xl p-6 shadow-2xl shadow-primary/10'
                    : 'border-outline-variant/30 bg-surface-low/30 backdrop-blur-sm p-5 opacity-60 hover:opacity-100 hover:border-primary/20'
                  }`}
              >
                {/* Active glow indicator */}
                {activeStep === i && (
                  <motion.div
                    layoutId="activeStepGlow"
                    className="absolute inset-0 bg-linear-to-r from-primary/10 to-transparent pointer-events-none"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                <div className="flex items-center gap-5 relative z-10">
                  <div className={`size-12 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${activeStep === i
                      ? 'ember-gradient shadow-primary/40'
                      : 'bg-surface-high text-on-surface-variant group-hover:bg-surface-highest'
                    }`}>
                    <s.icon className={`size-5 ${activeStep === i ? 'animate-pulse' : ''}`} />
                  </div>
                  <h4 className={`font-black text-xl lg:text-2xl tracking-tight transition-all duration-500 ${activeStep === i ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'
                    }`}>{s.title}</h4>
                </div>

                <AnimatePresence>
                  {activeStep === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: -10 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -10 }}
                      transition={{
                        height: { type: "spring", stiffness: 400, damping: 40 },
                        opacity: { duration: 0.2, delay: 0.1 }
                      }}
                      className="relative z-10"
                    >
                      <p className="pt-4 pl-17 text-on-surface-variant leading-relaxed text-sm font-medium">
                        {s.body}
                      </p>
                      <div className="mt-5 pl-17 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-primary/80">
                        <span className="flex items-center gap-1.5"><Radio className="size-3 animate-pulse" /> Live Link</span>
                        <div className="flex-1 h-px bg-linear-to-r from-primary/20 to-transparent" />
                        <span className="text-on-surface-variant opacity-50">Step 0{i + 1}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: DYNAMIC REALITY VIEWER */}
        <div className="reveal-item relative hidden lg:block aspect-square w-full max-w-[600px] mx-auto rounded-[3rem] border border-outline-variant/30 bg-surface-lowest/50 backdrop-blur-3xl p-8 overflow-hidden shadow-2xl">

          {/* Cinematic Ambient Glows */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-[0.02] mix-blend-overlay pointer-events-none" />
          <motion.div
            className="absolute -top-[20%] -right-[20%] w-[140%] h-[140%] bg-radial-at-c from-primary/10 to-transparent blur-3xl opacity-60"
            animate={{
              scale: [1, 1.1, 1],
              opacity: activeStep === 2 ? 0.8 : 0.6
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative h-full w-full flex flex-col justify-center items-center overflow-hidden rounded-4xl bg-background/40 border border-outline-variant/20 shadow-inner">

            {/* Corner Accents */}
            <div className="absolute top-4 left-4 size-3 border-t-2 border-l-2 border-primary/40 rounded-tl-sm" />
            <div className="absolute top-4 right-4 size-3 border-t-2 border-r-2 border-primary/40 rounded-tr-sm" />
            <div className="absolute bottom-4 left-4 size-3 border-b-2 border-l-2 border-primary/40 rounded-bl-sm" />
            <div className="absolute bottom-4 right-4 size-3 border-b-2 border-r-2 border-primary/40 rounded-br-sm" />

            {/* DYNAMIC REALITY VIEWER - SVGs */}
            <svg viewBox="0 0 400 400" className="w-full h-full p-8 drop-shadow-2xl">
              <AnimatePresence mode="wait">

                {/* STEP 0: AWAITING PROMPT (Radar / Scanning) */}
                {activeStep === 0 && (
                  <motion.g
                    key="step0"
                    initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    {/* Outer Rings */}
                    {[120, 90, 60].map((r, i) => (
                      <motion.circle
                        key={`ring-${i}`}
                        cx="200" cy="200" r={r}
                        fill="none" stroke="var(--primary)" strokeWidth={i === 0 ? 0.5 : 1}
                        strokeDasharray={i === 1 ? "4 8" : "none"}
                        strokeOpacity={0.2 + (i * 0.1)}
                        animate={i === 1 ? { rotate: 360 } : {}}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                        style={{ transformOrigin: "200px 200px" }}
                      />
                    ))}

                    {/* Radar Sweep */}
                    <motion.path
                      d="M200,200 L320,200 A120,120 0 0,0 200,80 Z"
                      fill="url(#radarGradient)"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      style={{ transformOrigin: "200px 200px" }}
                    />

                    {/* Center Core */}
                    <circle cx="200" cy="200" r="30" fill="var(--surface-lowest)" stroke="var(--primary)" strokeWidth="2" />
                    <Settings className="size-8 text-primary" x="184" y="184" />

                    {/* Data Particles */}
                    {[...Array(8)].map((_, i) => {
                      const angle = (i * 45) * (Math.PI / 180);
                      return (
                        <motion.circle
                          key={`particle-${i}`}
                          cx={200 + Math.cos(angle) * 120}
                          cy={200 + Math.sin(angle) * 120}
                          r="3"
                          fill="var(--primary)"
                          animate={{
                            cx: [null, 200 + Math.cos(angle) * 30],
                            cy: [null, 200 + Math.sin(angle) * 30],
                            opacity: [0, 1, 0]
                          }}
                          transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                        />
                      );
                    })}

                    <text x="200" y="360" textAnchor="middle" className="text-[12px] fill-primary font-black uppercase tracking-[0.3em]">Synapse Mapping</text>
                  </motion.g>
                )}

                {/* STEP 1: DNA SYNTHESIS (Voice Waves) */}
                {activeStep === 1 && (
                  <motion.g
                    key="step1"
                    initial={{ opacity: 0, x: 40, filter: "blur(10px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, x: -40, filter: "blur(10px)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    {/* Background Frequency Lines */}
                    {[...Array(5)].map((_, i) => (
                      <motion.path
                        key={`bg-wave-${i}`}
                        d={`M50,${150 + i * 25} Q125,${100 + i * 10} 200,${150 + i * 25} T350,${150 + i * 25}`}
                        fill="none" stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.1"
                        animate={{
                          d: [
                            `M50,${150 + i * 25} Q125,${100 + i * 10} 200,${150 + i * 25} T350,${150 + i * 25}`,
                            `M50,${150 + i * 25} Q125,${200 + i * 10} 200,${150 + i * 25} T350,${150 + i * 25}`,
                            `M50,${150 + i * 25} Q125,${100 + i * 10} 200,${150 + i * 25} T350,${150 + i * 25}`
                          ]
                        }}
                        transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
                      />
                    ))}

                    {/* Main Audio Waves */}
                    <motion.path
                      d="M50,200 Q150,50 200,200 T350,200"
                      fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round"
                      style={{ filter: "drop-shadow(0px 0px 8px var(--primary))" }}
                      animate={{
                        d: [
                          "M50,200 Q150,50  200,200 T350,200",
                          "M50,200 Q150,350 200,200 T350,200",
                          "M50,200 Q150,50  200,200 T350,200"
                        ]
                      }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.path
                      d="M50,200 Q150,300 200,200 T350,200"
                      fill="none" stroke="var(--secondary)" strokeWidth="3" strokeLinecap="round" opacity="0.8"
                      style={{ filter: "drop-shadow(0px 0px 6px var(--secondary))" }}
                      animate={{
                        d: [
                          "M50,200 Q150,300 200,200 T350,200",
                          "M50,200 Q150,100 200,200 T350,200",
                          "M50,200 Q150,300 200,200 T350,200"
                        ]
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Center Mic Orb */}
                    <circle cx="200" cy="200" r="35" fill="var(--surface-lowest)" stroke="var(--primary)" strokeWidth="1.5" />
                    <Mic className="size-8 text-on-surface" x="184" y="184" />

                    <text x="200" y="360" textAnchor="middle" className="text-[12px] fill-on-surface font-black uppercase tracking-[0.3em]">Acoustic Cloning</text>
                  </motion.g>
                )}

                {/* STEP 2: NETWORK LIVE (Expanding Mesh) */}
                {activeStep === 2 && (
                  <motion.g
                    key="step2"
                    initial={{ opacity: 0, scale: 0.5, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  >
                    {/* Hexagon Grid */}
                    {[...Array(6)].map((_, i) => {
                      const angle = i * 60 * (Math.PI / 180);
                      const x = 200 + Math.cos(angle) * 100;
                      const y = 200 + Math.sin(angle) * 100;
                      return (
                        <g key={`hex-${i}`}>
                          <motion.line
                            x1="200" y1="200" x2={x} y2={y}
                            stroke="var(--primary)" strokeWidth="1" strokeOpacity="0.4"
                            strokeDasharray="4 4"
                          />
                          <motion.circle
                            cx={x} cy={y} r="15"
                            fill="var(--surface-high)" stroke="var(--primary)" strokeWidth="1"
                            animate={{ scale: [1, 1.2, 1], borderColor: ["var(--primary)", "var(--secondary)"] }}
                            transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                          />
                          {/* Data packet along line */}
                          <motion.circle
                            cx="200" cy="200" r="3" fill="var(--primary)"
                            style={{ filter: "drop-shadow(0 0 5px var(--primary))" }}
                            animate={{ cx: [200, x], cy: [200, y], opacity: [1, 0] }}
                            transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
                          />
                        </g>
                      );
                    })}

                    {/* Connect Outer Nodes */}
                    <motion.path
                      d="M300,200 L250,286 L150,286 L100,200 L150,113 L250,113 Z"
                      fill="var(--primary)" fillOpacity="0.05" stroke="var(--primary)" strokeWidth="0.5"
                    />

                    {/* Center Core */}
                    <motion.circle cx="200" cy="200" r="45" fill="var(--primary)" fillOpacity="0.1" />
                    <motion.circle
                      cx="200" cy="200" r="40"
                      fill="var(--surface-lowest)" stroke="var(--primary)" strokeWidth="3"
                      style={{ filter: "drop-shadow(0 0 15px rgba(var(--primary-rgb), 0.5))" }}
                    />
                    <Zap className="size-10 text-primary" x="180" y="180" />

                    <motion.text
                      x="200" y="360" textAnchor="middle"
                      className="text-[12px] fill-primary font-black uppercase tracking-[0.3em]"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      Global Uplink Active
                    </motion.text>
                  </motion.g>
                )}
              </AnimatePresence>

              {/* Defs for gradients */}
              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

          </div>
        </div>
      </div>
    </section>
  );
});

HomeCreationLab.displayName = 'HomeCreationLab';
