import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * NeuralBackground Component
 * Centralized background with mesh gradients, floating glows, and drifting particles.
 * High-performance, premium aesthetic foundation for Studio pages.
 */
export const NeuralBackground: React.FC = () => {
  // Generate random particles only once
  const particles = useMemo(() => {
    return Array.from({ length: 28 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 5,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Floating Ambient Glows */}
      <motion.div
        animate={{
          x: [0, 80, -40, 0],
          y: [0, 40, 80, 0],
          scale: [1, 1.2, 0.85, 1],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] bg-primary/2 dark:bg-primary/5 blur-[130px] rounded-full"
      />
      <motion.div
        animate={{
          x: [0, -80, 40, 0],
          y: [0, -40, -80, 0],
          scale: [1, 1.15, 1.3, 1],
        }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-primary/1 dark:bg-primary/4 blur-[110px] rounded-full"
      />
      <motion.div
        animate={{
          opacity: [0.15, 0.35, 0.15],
          scale: [0.85, 1.05, 0.85],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[30%] right-[20%] w-[38%] h-[38%] bg-amber-500/2 dark:bg-amber-500/8 blur-[125px] rounded-full"
      />

      {/* Neural Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary/20 dark:bg-primary/40 blur-[1px]"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            x: [0, Math.random() * 60 - 30, 0],
            y: [0, Math.random() * 60 - 30, 0],
            opacity: [0, 0.6, 0.2, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};
