import React, { forwardRef } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '../../lib/utils';
import LiveTalk from '../LiveTalk';

const FloatingNeuralNodes = () => {
  const nodes = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
      {nodes.map(node => (
        <motion.div
          key={node.id}
          className="absolute rounded-full bg-primary/40 blur-[1px]"
          style={{
            width: node.size,
            height: node.size,
            left: `${node.x}%`,
            top: `${node.y}%`,
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 50 - 25, 0],
            opacity: [0.1, 0.6, 0.1],
          }}
          transition={{
            duration: node.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: node.delay
          }}
        />
      ))}
    </div>
  );
};

interface PerspectiveCardProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

const PerspectiveCard = ({ children, className, ...props }: PerspectiveCardProps) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);
  
  const spotlightX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const spotlightY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={cn("group relative transition-transform duration-200 ease-out", className)}
      {...props}
    >
      <motion.div 
        className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-inherit pointer-events-none"
        style={{
          background: useTransform(
            [spotlightX, spotlightY],
            ([sx, sy]) => `radial-gradient(600px circle at ${sx} ${sy}, rgba(var(--primary-rgb), 0.1), transparent 85%)`
          )
        }}
      />
      <div style={{ transform: "translateZ(50px)", transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </motion.div>
  );
};

const BackgroundWaves = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
    <FloatingNeuralNodes />
    <motion.div 
      className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px]"
      animate={{ 
        x: [0, 80, 0],
        y: [0, -60, 0],
        scale: [1, 1.3, 1],
        opacity: [0.3, 0.5, 0.3]
      }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div 
      className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] bg-primary/15 rounded-full blur-[100px]"
      animate={{ 
        x: [0, -100, 0],
        y: [0, 80, 0],
        scale: [0.8, 1.2, 0.8],
        opacity: [0.2, 0.4, 0.2]
      }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);


export const HomeHero = forwardRef<HTMLElement, { landingBotId?: string | null }>(({ landingBotId }, ref) => {
  const reduce = useReducedMotion();

  return (
    <section 
      ref={ref}
      className="absolute inset-0 h-screen flex flex-col justify-center px-6 md:px-20 overflow-hidden"
    >
      <div className="mx-auto w-full flex flex-cols  gap-12 items-center">
        <div className="space-y-8 w-[50%] ">
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -20 }}
            animate={reduce ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-low px-3 py-1 text-xs font-medium text-on-surface-variant w-fit"
          >
            <Sparkles className="size-3.5 text-primary" />
            Agentic voice + realtime stack
          </motion.div>

          <h1 className="hero-reveal font-headline text-6xl font-black leading-[1.1] tracking-tight md:text-8xl lg:text-7xl text-on-surface">
            Build voice agents that <br />
            <span className="bg-linear-to-r from-primary via-tertiary to-primary bg-clip-text text-transparent">
              think and speak.
            </span>
          </h1>
          <p className="hero-reveal max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
            Deploy low-latency voice bots with expressive TTS and reliable workflows. One platform, every provider, zero configuration.
          </p>
          <div className="hero-reveal flex flex-wrap gap-4 pt-4">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-on-surface px-10 py-5 text-sm font-black uppercase tracking-widest text-background transition-all hover:bg-primary hover:text-on-primary-fixed shadow-2xl shadow-primary/20">
              Launch Console
              <ArrowRight className="size-5" />
            </Link>
          </div>
        </div>

        <motion.div
          className="relative hidden lg:block flex-1"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.12 }}
        >
          <PerspectiveCard className="z-10">
            <div className="glass-panel relative overflow-hidden rounded-[3rem] p-4 sm:p-6 shadow-2xl shadow-primary/10 border-primary/20 bg-surface-low/40 backdrop-blur-md">
              <BackgroundWaves />
              <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
              <LiveTalk botId={landingBotId || undefined} />
            </div>
          </PerspectiveCard>
          
          {/* Decorative 3D elements */}
          <motion.div 
            className="absolute -top-12 -right-12 size-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"
            animate={{ scale: [1, 1.2, 1] }} 
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div 
            className="absolute -bottom-12 -left-12 size-40 bg-secondary-container/20 rounded-full blur-3xl pointer-events-none"
            animate={{ scale: [1.2, 1, 1.2] }} 
            transition={{ duration: 5, repeat: Infinity }}
          />
        </motion.div>
      </div>
    </section>
  );
});

HomeHero.displayName = 'HomeHero';
