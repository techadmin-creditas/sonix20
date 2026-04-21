import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../lib/theme';

export function NeuralBackground2DV1() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // --- LOGIC GRAPH CONFIG ---
  const CONFIG = {
    HUB_COUNT: 12,
    NODE_COUNT: 140,
    HUB_DIST: 350,
    NODE_DIST: 120,
    VISIBILITY: isDark ? 0.9 : 0.4,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const COLORS = {
      PRIMARY: styles.getPropertyValue('--primary').trim() || (isDark ? '#ffb77b' : '#fb8c00'),
      SECONDARY: styles.getPropertyValue('--secondary').trim() || (isDark ? '#6366f1' : '#4f46e5'),
      PULSE: styles.getPropertyValue('--primary').trim() || (isDark ? '#ffffff' : '#fb8c00'),
    };

    let animationFrameId: number;
    let w: number, h: number;
    const nodes: any[] = [];
    const hubs: any[] = [];
    const pulses: any[] = [];

    const init = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      nodes.length = 0;
      hubs.length = 0;

      // 1. Generate Hubs (Structural Anchors)
      for (let i = 0; i < CONFIG.HUB_COUNT; i++) {
        hubs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          size: 4,
          type: 'HUB'
        });
      }

      // 2. Generate Standard Nodes
      for (let i = 0; i < CONFIG.NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: 1.5,
          type: 'NODE'
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      
      const allNodes = [...hubs, ...nodes];

      // A. Draw Indigo Super-Grid (Hub-to-Hub)
      ctx.lineWidth = 1;
      for (let i = 0; i < hubs.length; i++) {
        for (let j = i + 1; j < hubs.length; j++) {
          const dx = hubs[i].x - hubs[j].x;
          const dy = hubs[i].y - hubs[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < CONFIG.HUB_DIST) {
            const alpha = (1 - dist / CONFIG.HUB_DIST) * 0.2 * CONFIG.VISIBILITY;
            ctx.strokeStyle = COLORS.SECONDARY;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(hubs[i].x, hubs[i].y);
            ctx.lineTo(hubs[j].x, hubs[j].y);
            ctx.stroke();

            // Randomly create a pulse along this line
            if (Math.random() < 0.001) {
              pulses.push({
                startNode: hubs[i],
                endNode: hubs[j],
                progress: 0,
                speed: 0.005 + Math.random() * 0.01
              });
            }
          }
        }
      }

      // B. Draw Orange Logic Mesh (Node Connections)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          const dx = allNodes[i].x - allNodes[j].x;
          const dy = allNodes[i].y - allNodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < CONFIG.NODE_DIST) {
            const alpha = (1 - dist / CONFIG.NODE_DIST) * 0.15 * CONFIG.VISIBILITY;
            ctx.strokeStyle = COLORS.PRIMARY;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(allNodes[i].x, allNodes[i].y);
            ctx.lineTo(allNodes[j].x, allNodes[j].y);
            ctx.stroke();
          }
        }
      }

      // C. Draw Kinetic Pulses (Data Flow)
      ctx.fillStyle = COLORS.PULSE;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.progress += p.speed;
        
        if (p.progress >= 1) {
          pulses.splice(i, 1);
          continue;
        }

        const px = p.startNode.x + (p.endNode.x - p.startNode.x) * p.progress;
        const py = p.startNode.y + (p.endNode.y - p.startNode.y) * p.progress;
        
        ctx.globalAlpha = 0.8 * CONFIG.VISIBILITY;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
        // Glow effect for pulse
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.PULSE;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // D. Draw Particles
      for (let n of allNodes) {
        ctx.fillStyle = n.type === 'HUB' ? COLORS.SECONDARY : COLORS.PRIMARY;
        ctx.globalAlpha = n.type === 'HUB' ? 0.6 : 0.3;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();
        
        if (n.type === 'HUB') {
          ctx.shadowBlur = 15;
          ctx.shadowColor = COLORS.SECONDARY;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      
      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => init();
    window.addEventListener('resize', handleResize);
    init();
    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, isDark]);


  return (
    <div className="fixed inset-0 z-0 h-screen w-full bg-neural-bg overflow-hidden transition-colors duration-500">
      {/* High-Visibility Logic Graph Layer */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0" 
        style={{ opacity: 0.8 }}
      />

      {/* Atmospheric Overlays */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      {/* Voice Frequency Layer (Bottom) */}
      <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none opacity-30">
        <svg className="w-full h-full filter blur-[4px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <motion.path
            animate={{
              d: [
                "M0,160 C320,260 420,10 720,160 C1020,310 1120,60 1440,160 V320 H0 Z",
                "M0,160 C320,60 420,310 720,160 C1020,10 1120,260 1440,160 V320 H0 Z",
                "M0,160 C320,260 420,10 720,160 C1020,310 1120,60 1440,160 V320 H0 Z"
              ]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            fill="url(#graphGrad)"
          />
          <defs>
            <linearGradient id="graphGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
