import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, Settings, Zap, BarChart2,
  Globe, Mic, CheckCircle2, Play, Layers,
} from 'lucide-react';
import { AgentAvatar } from '../components/AgentFlipCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { NeuralBackground2D } from '../components/NeuralBackground2D';
import { GradientOrb } from '../components/LiveAgentStudio';
import { CallDemoPanel } from '../components/home/CallDemoPanel';
import { AgentCommandRail } from '../components/AgentCommandRail';
import { AgentHoverPanel } from '../components/home/AgentHoverPanel';
import { AgentExplorerOverlay } from '../components/home/AgentExplorerOverlay';
import { StepAnimations } from '../components/home/StepAnimations';
import { AGENTS } from '../data/agents';
import { useTheme } from '../lib/theme';
import { defaultConfig } from '../config/home.default';
import type { HomePageConfig } from '../config/home.types';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, Observer);

const MemoBackground = React.memo(() => <NeuralBackground2D />);

// ─── Static data ──────────────────────────────────────────────────────────────

const AGENT_METRICS = [
  { stat: '35% DSO ↓', tag: 'Recovery',   useCases: ['Debt Collection', 'Payment Plans'] },
  { stat: '99.9% Uptime', tag: 'Fraud Shield', useCases: ['Fraud Detection', 'Risk Scoring'] },
  { stat: '60% Faster',   tag: 'Lending',      useCases: ['Loan Advisory', 'EMI Mgmt'] },
  { stat: 'Zero Friction', tag: 'KYC',          useCases: ['KYC / AML', 'Onboarding'] },
  { stat: '94% CSAT',     tag: 'Support',       useCases: ['Wealth Mgmt', 'Portfolio'] },
];

const AGENT_SNIPPETS = [
  { bot: '"Rohan ji, aapka payment..."',          user: '"Haan, kal tak kar deta hoon."' },
  { bot: '"Unusual activity detected..."',         user: '"I didn\'t make that transaction."' },
  { bot: '"Your EMI is ₹12,400 this month."',     user: '"Can I restructure the plan?"' },
  { bot: '"Please confirm your PAN number."',      user: '"I\'ll complete it via the link."' },
  { bot: '"Your portfolio dipped 2.1% today."',   user: '"Should I rebalance now?"' },
];

const LIVE_CALL_SNIPPETS = [
  { label: 'Astra → Debt Recovery',   bot: 'Rohan ji, ₹12,400 ka payment pending hai', user: 'Kal tak kar deta hoon', badge: 'PTP Recorded' },
  { label: 'Nova → KYC Onboarding',   bot: 'Please upload your Aadhaar via secure link', user: 'Done, just uploaded it', badge: 'KYC Complete' },
  { label: 'Midas → Fraud Shield',    bot: 'Unusual transaction detected on your card', user: "That wasn't me", badge: 'Card Blocked' },
];

const FLOAT_STATS = [
  { text: '<800ms', icon: '⚡', delay: 0.4, pos: 'top-6 left-6' },
  { text: '10+ Languages', icon: '🌐', delay: 0.55, pos: 'top-1/3 right-0' },
  { text: '35% DSO ↓', icon: '📉', delay: 0.65, pos: 'bottom-1/3 left-0' },
  { text: '99.9% Uptime', icon: '✓', delay: 0.75, pos: 'bottom-10 right-8' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface HomeNewProps {
  config?: HomePageConfig;
}

export default function HomeNew({ config = defaultConfig }: HomeNewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Refs
  const contentRef      = useRef<HTMLDivElement>(null);
  const sectionsRef     = useRef<(HTMLElement | null)[]>([]);
  const currentIndexRef = useRef(0);
  const animatingRef    = useRef(false);

  // UI state
  const [isDemoMode,       setIsDemoMode]       = useState(false);
  const [selectedAgent,    setSelectedAgent]    = useState(AGENTS[0]);
  const [hoveredAgentIdx,  setHoveredAgentIdx]  = useState<number | null>(null);
  const [showExplorer,     setShowExplorer]     = useState(false);
  const [currentSection,   setCurrentSection]   = useState(0);

  // Hero state
  const [industryTab,    setIndustryTab]    = useState(config.sections.hero.defaultIndustryTab);
  const [callSnippetIdx, setCallSnippetIdx] = useState(0);
  const [callCharIdx,    setCallCharIdx]    = useState(0);

  // Agent filter state
  const [agentFilter, setAgentFilter] = useState<'all' | 'fintech' | 'banking'>('all');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleTryDemo = (agent: any) => {
    setSelectedAgent(agent);
    setIsDemoMode(true);
  };

  // ── Determine featured agents ───────────────────────────────────────────────
  const featuredAgents = AGENTS.filter(a => config.agents.featuredIds.includes(a.id));
  const displayedAgents = agentFilter === 'all'
    ? featuredAgents
    : featuredAgents.filter(a => a.category === agentFilter);

  // ── GSAP snap-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    // ── Smooth Scroll setup with Lenis ───────────────────────────────────────
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    // Connect Lenis to ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // Use GSAP ticker to drive Lenis (recommended for sync)
    gsap.ticker.lagSmoothing(0);
    const tickerUpdate = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerUpdate);

    // ── Entrance Animations for Sections ─────────────────────────────────────
    const ctx = gsap.context(() => {
      sectionsRef.current.forEach((section, index) => {
        if (!section) return;

        // Target the main wrapper (z-10) inside each section
        const content = section.querySelector('.relative.z-10');
        if (content) {
          // Set initial state via GSAP to avoid flickering
          gsap.set(content, { opacity: 0, y: 40, scale: 0.98 });

          gsap.to(content, {
            opacity: 1, y: 0, scale: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section,
              start: "top 85%",
              toggleActions: "play none none reverse",
            }
          });
        }

        // Sync active section with nav dots
        ScrollTrigger.create({
          trigger: section,
          start: "top center",
          end: "bottom center",
          onToggle: (self) => {
            if (self.isActive) {
              // Critical Sync: Ensures the 'one-swipe' logic always knows where you are
              currentIndexRef.current = index;
              // Only update state if the section has actually changed
              setCurrentSection(prev => prev === index ? prev : index);
            }
          }
        });
      });

      // ── One-Swipe Navigation ──────────────────────────────────────────────
      const gotoSection = (index: number) => {
        if (animatingRef.current || index < 0 || index >= sectionsRef.current.length) return;
        
        animatingRef.current = true;
        currentIndexRef.current = index;
        setCurrentSection(index);

        const target = sectionsRef.current[index];
        if (target) {
          lenis.scrollTo(target, {
            duration: 1.2,
            lock: true, // Use internal locking for the duration of the animation
            onComplete: () => {
              animatingRef.current = false;
            }
          });
        }
      };

      const obs = Observer.create({
        type: "wheel,touch,pointer",
        wheelSpeed: -1,
        onDown: () => !animatingRef.current && gotoSection(currentIndexRef.current - 1),
        onUp:   () => !animatingRef.current && gotoSection(currentIndexRef.current + 1),
        tolerance: 10, // Refined tolerance for intentional swipes
        preventDefault: false // Keep the browser 'alive' while auto-snapping
      });

      return () => {
        obs.kill();
      };
    }, contentRef);

    return () => {
      lenis.destroy();
      ctx.revert();
      gsap.ticker.remove(tickerUpdate);
    };
  }, []);

  // ── Live call snippet typewriter ─────────────────────────────────────────────
  useEffect(() => {
    if (currentSection !== 0) return;
    setCallCharIdx(0);
    const snippet = LIVE_CALL_SNIPPETS[callSnippetIdx];
    const fullText = snippet.bot;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setCallCharIdx(i);
      if (i >= fullText.length) clearInterval(iv);
    }, 35);
    return () => clearInterval(iv);
  }, [callSnippetIdx, currentSection]);

  useEffect(() => {
    if (currentSection !== 0) return;
    const iv = setInterval(() => {
      setCallSnippetIdx(prev => (prev + 1) % LIVE_CALL_SNIPPETS.length);
    }, 4000);
    return () => clearInterval(iv);
  }, [currentSection]);

  const currentTabData = config.sections.hero.industryTabs.find(t => t.key === industryTab)
    ?? config.sections.hero.industryTabs[0];

  const sectionBase = 'relative w-full min-h-screen flex flex-col items-center justify-center p-6 lg:p-12 overflow-hidden [will-change:transform]';

  return (
    <div className="relative w-full min-h-screen bg-background text-on-surface selection:bg-primary/30 scroll-smooth">

      {/* Unified Neural Atmosphere (Merged Mesh + Nodes) */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <MemoBackground />
      </div>

      {/* Header */}
      <header className={`fixed top-0 z-50 w-full border-b border-outline-variant/40 bg-background/60 backdrop-blur-xl transition-transform duration-500 ${isDemoMode ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-headline text-xl font-extrabold tracking-tight text-on-surface">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="size-4 text-white" />
            </div>
            {config.branding.logoText}{' '}
            <span className="text-primary font-black">{config.branding.logoVersion}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-on-surface-variant">
            {config.header.navLinks.map(nl => (
              <button 
                key={nl.label} 
                className="hover:text-primary transition-colors"
                onClick={() => {
                  if (nl.sectionIndex !== undefined) {
                    const el = sectionsRef.current[nl.sectionIndex];
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                      setCurrentSection(nl.sectionIndex);
                    }
                  } else if (nl.href) {
                    window.location.href = nl.href;
                  }
                }}
              >
                {nl.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to={config.header.ctaButton.href}
              className="rounded-lg bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-on-primary-fixed transition-all hover:brightness-110 active:scale-95 shadow-md shadow-primary/25">
              {config.header.ctaButton.text}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Nav dots ─────────────────────────────────────────────────────────── */}
      <div className={`fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 transition-opacity duration-300 ${isDemoMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            onClick={() => {
              const el = sectionsRef.current[i];
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                setCurrentSection(i);
              }
            }}
            className={`rounded-full transition-all duration-300 ${currentSection === i ? 'bg-primary w-2 h-5' : 'bg-outline-variant w-2 h-2 hover:bg-primary/40'}`}
          />
        ))}
      </div>

      {/* Scrollable content */}
      <div ref={contentRef} className="relative z-10 w-full h-full">

        {/* ─── SECTION 1: HERO ────────────────────────────────────────────── */}
        <section ref={el => { sectionsRef.current[0] = el; }} className={sectionBase}>
          {/* <BackgroundMesh /> */}
          <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pt-20">

            {/* Left: copy */}
            <div className="space-y-6">

              {/* Platform badge */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25">
                <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">{config.sections.hero.badge}</span>
              </motion.div>

              {/* Industry tabs */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                className="flex items-center gap-2 flex-wrap">
                {config.sections.hero.industryTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setIndustryTab(tab.key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      industryTab === tab.key
                        ? 'bg-primary text-on-primary-fixed shadow-md shadow-primary/25'
                        : 'bg-surface-low border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </motion.div>

              {/* Headline */}
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.7 }}>
                <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-on-surface leading-[1.1]">
                  Voice AI for{' '}
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={industryTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="bg-linear-to-r from-primary via-secondary to-tertiary bg-clip-text text-transparent"
                    >
                      {currentTabData.headlineAccent}
                    </motion.span>
                  </AnimatePresence>
                </h1>
              </motion.div>

              {/* Subheadline */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={industryTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="text-lg text-on-surface-variant leading-relaxed max-w-lg"
                >
                  {currentTabData.subheadline}
                </motion.p>
              </AnimatePresence>

              {/* CTAs */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => handleTryDemo(AGENTS[0])}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-on-primary-fixed font-semibold shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all">
                  <Play className="size-4" fill="currentColor" />
                  {config.sections.hero.primaryCta.text}
                </button>
                <Link to={config.sections.hero.secondaryCta.href}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-outline-variant text-on-surface font-semibold hover:border-primary/50 hover:text-primary transition-all">
                  {config.sections.hero.secondaryCta.text} <ArrowRight className="size-4" />
                </Link>
              </motion.div>

              {/* Metrics strip */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                className="flex items-center gap-6 text-sm text-on-surface-variant pt-1 flex-wrap">
                {[
                  { icon: <Zap className="size-3.5" />, text: '<800ms latency' },
                  { icon: <Globe className="size-3.5" />, text: '10+ languages' },
                  { icon: <CheckCircle2 className="size-3.5" />, text: '99.9% uptime' },
                ].map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-primary/80">
                    {m.icon}
                    <span className="text-xs font-medium text-on-surface-variant">{m.text}</span>
                  </div>
                ))}
              </motion.div>

              {/* Live chips */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                className="flex items-center gap-2 flex-wrap">
                {config.sections.hero.liveChips.map((chip, i) => (
                  <div key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-surface-low border border-outline-variant text-[10px] font-medium text-on-surface-variant">
                    <span className={`text-[8px] ${chip.icon === 'dot' ? 'text-emerald-400' : chip.icon === 'arrow' ? 'text-primary' : 'text-sky-400'}`}>
                      {chip.icon === 'dot' ? '●' : chip.icon === 'arrow' ? '↑' : '✓'}
                    </span>
                    {chip.text}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: orb + floating stats + live call preview */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
              className="flex flex-col items-center gap-6">

              {/* Orb with floating badges */}
              <div className="relative flex items-center justify-center w-full">
                <GradientOrb isActive={false} isConnecting={false} isDark={isDark} onClick={() => handleTryDemo(AGENTS[0])} size={260} />

                {FLOAT_STATS.map((fs, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8, y: 0 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                      y: [0, -10, 0],
                    }}
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(var(--primary-rgb), 0.1)' }}
                    transition={{ 
                      y: {
                        duration: 3 + i,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: fs.delay
                      },
                      default: {
                        delay: fs.delay, 
                        type: 'spring', 
                        stiffness: 200 
                      }
                    }}
                    className={`absolute ${fs.pos} flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/80 border border-outline-variant backdrop-blur-md text-[10px] font-bold text-on-surface shadow-lg shadow-black/5 select-none cursor-default z-10`}
                  >
                    <span className="text-primary">{fs.icon}</span>
                    {fs.text}
                  </motion.div>
                ))}
              </div>

              {/* Latency bar */}
              <div className="w-full max-w-sm space-y-2">
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                  {[
                    { label: 'STT', ms: 45,  pct: 10, cls: 'bg-sky-500' },
                    { label: 'LLM', ms: 280, pct: 63, cls: 'bg-primary' },
                    { label: 'TTS', ms: 120, pct: 27, cls: isDark ? 'bg-cyan-400' : 'bg-secondary' },
                  ].map((seg, i) => (
                    <motion.div
                      key={seg.label}
                      className={`h-full rounded-sm ${seg.cls}`}
                      style={{ width: `${seg.pct}%` }}
                      initial={{ scaleX: 0, transformOrigin: 'left' }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.6 + i * 0.15, duration: 0.5, ease: 'easeOut' }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[9px] font-medium text-on-surface-variant">
                  {[
                    { label: 'STT', ms: '45ms',  cls: 'text-sky-400' },
                    { label: 'LLM', ms: '280ms', cls: 'text-primary' },
                    { label: 'TTS', ms: '120ms', cls: isDark ? 'text-cyan-400' : 'text-secondary' },
                  ].map(seg => (
                    <div key={seg.label} className="flex items-center gap-1">
                      <span className={seg.cls + ' font-bold'}>{seg.label}</span>
                      <span>{seg.ms}</span>
                    </div>
                  ))}
                  <div className="text-emerald-400 font-semibold">Total: 445ms ✓</div>
                </div>
              </div>

              {/* Mini live call preview */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
                className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface/60 backdrop-blur-sm p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
                    <span className="text-[9px] text-on-surface-variant ml-1">{LIVE_CALL_SNIPPETS[callSnippetIdx].label}</span>
                  </div>
                </div>
                <div className="space-y-1 min-h-[40px]">
                  <p className="text-[10px] text-on-surface-variant">
                    <span className="text-primary mr-1">🤖</span>
                    {LIVE_CALL_SNIPPETS[callSnippetIdx].bot.slice(0, callCharIdx)}
                    {callCharIdx < LIVE_CALL_SNIPPETS[callSnippetIdx].bot.length && (
                      <span className="inline-block w-px h-3 bg-primary ml-0.5 animate-pulse" />
                    )}
                  </p>
                  {callCharIdx >= LIVE_CALL_SNIPPETS[callSnippetIdx].bot.length && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                      className="text-[10px] text-on-surface-variant">
                      <span className="text-secondary mr-1">👤</span>
                      {LIVE_CALL_SNIPPETS[callSnippetIdx].user}
                    </motion.p>
                  )}
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
                  <CheckCircle2 className="size-2.5 text-emerald-400" />
                  <span className="text-[8px] font-semibold text-emerald-400">{LIVE_CALL_SNIPPETS[callSnippetIdx].badge}</span>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Scroll hint */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Scroll to explore</span>
            <motion.div className="size-5 rounded-full border border-outline flex items-center justify-center"
              animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <div className="size-1.5 rounded-full bg-primary" />
            </motion.div>
          </motion.div>
        </section>

        {/* ─── SECTION 2: AGENT SHOWCASE ─────────────────────────────────── */}
        <section ref={el => { sectionsRef.current[1] = el; }} className={sectionBase}>
          {/* <BackgroundMesh /> */}
          <div className="relative z-10 w-full max-w-6xl mx-auto pt-20 space-y-8">

            {/* Header */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25">
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">Platform Agents</span>
              </div>
              <h2 className="text-4xl font-bold text-on-surface tracking-tight">{config.sections.agentShowcase.headline}</h2>
              <p className="text-on-surface-variant max-w-xl mx-auto">{config.sections.agentShowcase.subheadline}</p>
            </div>

            {/* Filter tabs */}
            {config.sections.agentShowcase.showFilterTabs && (
              <div className="flex items-center justify-center gap-2">
                {(['all', 'fintech', 'banking'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAgentFilter(cat)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      agentFilter === cat
                        ? 'bg-primary text-on-primary-fixed shadow-md shadow-primary/20'
                        : 'border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    {cat === 'all' ? 'All ▾' : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Agent grid */}
            <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <AnimatePresence mode="popLayout">
                {displayedAgents.map((agent, i) => {
                  const cust = config.agents.customizations[agent.id] ?? {};
                  const agentName = cust.displayName ?? agent.name;
                  const edge = i === 0 ? 'left' : i === displayedAgents.length - 1 ? 'right' : 'center';

                  return (
                    <motion.div key={agent.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
                      className={`group relative rounded-2xl border p-5 flex flex-col items-center gap-3 cursor-pointer transition-all duration-300 ${
                        isDark
                          ? 'bg-surface/60 border-outline-variant hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10'
                          : 'bg-surface/80 border-outline-variant hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10'
                      } hover:-translate-y-1`}
                      onClick={() => handleTryDemo(agent)}
                      onMouseEnter={() => setHoveredAgentIdx(i)}
                      onMouseLeave={() => setHoveredAgentIdx(null)}
                    >
                      {/* Compliance badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="size-2.5 text-emerald-400" />
                        <span className="text-[7px] font-bold text-emerald-400">Compliant</span>
                      </div>

                      {/* Avatar */}
                      <div className="size-16 rounded-xl overflow-hidden border border-outline-variant group-hover:border-primary/40 transition-colors mt-1 flex items-center justify-center">
                        <AgentAvatar id={agent.id} name={agentName} isMini={true} isSwitcher={false} instanceId={`home-${agent.id}`} />
                      </div>

                      <div className="text-center space-y-0.5">
                        <h3 className="text-sm font-semibold text-on-surface">{agentName}</h3>
                        <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">{cust.customRole ?? agent.role}</p>
                      </div>

                      {/* Metric badge */}
                      <div className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                        <span className="text-[10px] font-bold text-primary">{AGENT_METRICS[i % AGENT_METRICS.length]?.stat ?? '—'}</span>
                      </div>

                      {/* Use-case tags */}
                      <div className="flex flex-wrap gap-1 justify-center">
                        {(AGENT_METRICS[i % AGENT_METRICS.length]?.useCases ?? []).map(tag => (
                          <span key={tag} className="text-[8px] font-medium text-on-surface-variant bg-surface-high border border-outline-variant px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Try demo CTA */}
                      <div className="w-full py-1.5 rounded-lg border border-outline-variant text-[10px] font-medium text-on-surface-variant text-center group-hover:border-primary group-hover:text-primary group-hover:bg-primary/5 transition-all">
                        {hoveredAgentIdx === i ? `${agent.category} · ${AGENT_METRICS[i % AGENT_METRICS.length]?.tag}` : 'Try Demo'}
                      </div>

                      {/* Hover panel */}
                      <AnimatePresence>
                        {hoveredAgentIdx === i && (
                          <AgentHoverPanel
                            agent={agent}
                            metric={AGENT_METRICS[i % AGENT_METRICS.length] ?? { stat: '—', tag: '' }}
                            snippet={AGENT_SNIPPETS[i % AGENT_SNIPPETS.length] ?? { bot: '', user: '' }}
                            displayName={cust.displayName}
                            customBenefit={cust.customBenefit}
                            customDetails={cust.customDetails}
                            customRole={cust.customRole}
                            onTryDemo={() => handleTryDemo(agent)}
                            edge={edge}
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* Explore all */}
            {config.sections.agentShowcase.showExploreAll && (
              <div className="flex items-center justify-center gap-4">
                <div className="h-px flex-1 bg-outline-variant/40 max-w-32" />
                <span className="text-xs text-on-surface-variant/50">{displayedAgents.length} of {AGENTS.length} neural agents available</span>
                <button
                  onClick={() => setShowExplorer(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline transition-all"
                >
                  <Layers className="size-3.5" />
                  {config.sections.agentShowcase.exploreCtaText}
                </button>
                <div className="h-px flex-1 bg-outline-variant/40 max-w-32" />
              </div>
            )}
          </div>
        </section>

        {/* ─── SECTION 3: HOW IT WORKS ───────────────────────────────────── */}
        <section ref={el => { sectionsRef.current[2] = el; }} className={sectionBase}>
          {/* <BackgroundMesh /> */}
          <div className="relative z-10 w-full max-w-5xl mx-auto pt-20 space-y-10">

            {/* Header */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25">
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">Simple Process</span>
              </div>
              <h2 className="text-4xl font-bold text-on-surface tracking-tight">{config.sections.howItWorks.headline}</h2>
              <p className="text-on-surface-variant max-w-lg mx-auto">{config.sections.howItWorks.subheadline}</p>
            </div>

            {/* Steps */}
            <div className="relative grid grid-cols-3 gap-6 items-start">
              {/* Connecting line */}
              <motion.div
                className="absolute top-12 left-[16.66%] right-[16.66%] h-px bg-linear-to-r from-transparent via-primary/40 to-transparent pointer-events-none"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: currentSection === 2 ? 1 : 0 }}
                style={{ transformOrigin: 'left' }}
                transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
              />

              {config.sections.howItWorks.steps.map((step, i) => {
                const StepIcon = i === 0 ? Settings : i === 1 ? Zap : BarChart2;
                return (
                  <motion.div key={step.num}
                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.15, type: 'spring', stiffness: 150, damping: 20 }}
                    className={`relative rounded-2xl border p-5 space-y-4 ${
                      isDark ? 'bg-surface/60 border-outline-variant' : 'bg-surface/80 border-outline-variant'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="size-11 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                        <StepIcon className="size-6 text-primary" />
                      </div>
                      <span className="text-5xl font-black text-outline/40 select-none leading-none">{step.num}</span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold text-on-surface">{step.title}</h3>
                      <p className="text-xs text-on-surface-variant leading-relaxed">{step.desc}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {step.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-medium text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Live animation widget */}
                    <StepAnimations type={step.animationType} isActive={currentSection === 2} />
                  </motion.div>
                );
              })}
            </div>

            {/* By the numbers strip */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { val: '<800ms', label: 'Latency' },
                { val: '35% ↓',  label: 'DSO Avg' },
                { val: '10+',    label: 'Languages' },
                { val: '99.9%',  label: 'Uptime' },
              ].map((m, i) => (
                <motion.div key={m.val}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08, type: 'spring', stiffness: 200 }}
                  className="text-center px-4 py-3 rounded-xl border bg-surface-low border-outline-variant"
                >
                  <div className="text-xl font-bold text-primary">{m.val}</div>
                  <div className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wider mt-0.5">{m.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 4: CTA ─────────────────────────────────────────────── */}
        <section ref={el => { sectionsRef.current[3] = el; }} className={sectionBase}>
          {/* <BackgroundMesh /> */}
          <div className="relative z-10 w-full max-w-4xl mx-auto space-y-5">

            {/* Testimonials */}
            {config.sections.cta.testimonials && config.sections.cta.testimonials.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="grid grid-cols-2 gap-4">
                {config.sections.cta.testimonials.map((t, i) => (
                  <div key={i} className="rounded-2xl border border-outline-variant bg-surface/60 backdrop-blur-sm p-4 space-y-2">
                    <p className="text-xs text-on-surface-variant leading-relaxed italic">"{t.quote}"</p>
                    <div>
                      <p className="text-[10px] font-semibold text-on-surface">— {t.author}</p>
                      <p className="text-[9px] text-on-surface-variant/60">{t.role}, {t.company}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Trusted by */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-[10px] text-on-surface-variant opacity-50 font-medium">Trusted by teams at</span>
              {config.sections.cta.trustedBy.map(brand => (
                <span key={brand} className="text-[11px] font-bold text-on-surface-variant opacity-40 px-2 py-0.5 rounded border border-outline-variant">
                  {brand}
                </span>
              ))}
            </motion.div>

            {/* CTA card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 150 }}
              className={`rounded-3xl border p-10 text-center space-y-6 ${
                isDark
                  ? 'bg-surface/40 border-primary/20 backdrop-blur-xl'
                  : 'bg-white/70 border-primary/15 backdrop-blur-xl shadow-2xl shadow-primary/8'
              }`}
              style={{ background: isDark
                ? 'linear-gradient(135deg, rgba(var(--primary-rgb,99,102,241),0.08) 0%, var(--surface) 50%, rgba(var(--secondary-rgb,139,92,246),0.06) 100%)'
                : 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, #ffffff 50%, rgba(139,92,246,0.04) 100%)'
              }}
            >
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 mb-2">
                  <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-widest">Ready to Deploy</span>
                </div>
                <h2 className="text-4xl lg:text-5xl font-bold text-on-surface tracking-tight leading-tight">
                  {config.sections.cta.headline[0]}<br />
                  <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {config.sections.cta.headline[1]}
                  </span>
                </h2>
                <p className="text-on-surface-variant max-w-lg mx-auto leading-relaxed">
                  {config.sections.cta.subheadline}
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 flex-wrap">
                <button
                  onClick={() => handleTryDemo(AGENTS[0])}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-on-primary-fixed font-semibold text-base shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all">
                  {config.sections.cta.primaryCta.text} <ArrowRight className="size-4" />
                </button>
                <Link to={config.sections.cta.secondaryCta.href}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl border border-outline-variant text-on-surface font-semibold hover:border-primary/50 hover:text-primary transition-all">
                  {config.sections.cta.secondaryCta.text}
                </Link>
              </div>

              {/* Notes */}
              <div className="flex items-center justify-center gap-4 text-[10px] text-on-surface-variant flex-wrap">
                {['14-day free trial', 'No credit card', 'SOC 2 compliant'].map(note => (
                  <span key={note} className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-400" /> {note}
                  </span>
                ))}
              </div>

              {/* Metric pills */}
              <div className="flex items-center justify-center gap-4 flex-wrap pt-1">
                {config.sections.cta.metrics.map(m => (
                  <div key={m.val} className="text-center px-4 py-2 rounded-xl bg-primary/8 border border-primary/15">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="text-lg font-bold text-primary">{m.val}</span>
                      {/* Mini sparkline */}
                      <svg viewBox="0 0 20 12" width="20" height="12">
                        <polyline
                          points="0,10 6,7 12,4 20,1"
                          fill="none"
                          stroke="var(--primary,#6366f1)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">{m.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Footer */}
            <p className="text-center text-xs text-on-surface-variant">
              {config.footer.copyright} ·{' '}
              {config.footer.links.map((link, i) => (
                <span key={link.label}>
                  <Link to={link.href} className="hover:text-primary transition-colors">{link.label}</Link>
                  {i < config.footer.links.length - 1 && ' · '}
                </span>
              ))}
            </p>
          </div>
        </section>
      </div>

      {/* ─── AGENT EXPLORER OVERLAY ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showExplorer && (
          <AgentExplorerOverlay
            agents={AGENTS}
            metrics={AGENT_METRICS}
            customizations={config.agents.customizations}
            onClose={() => setShowExplorer(false)}
            onTryDemo={agent => { setShowExplorer(false); handleTryDemo(agent); }}
          />
        )}
      </AnimatePresence>

      {/* ─── DEMO OVERLAY ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 bg-background/95 backdrop-blur-3xl overflow-hidden"
          >
            {/* Demo header */}
            <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-6 border-b border-outline/30 bg-background/50 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-[10px] font-black text-primary tracking-tighter">S2</span>
                </div>
                <h3 className="text-[10px] font-black uppercase text-on-surface-variant tracking-[0.4em]">Sonar Studio</h3>
              </div>
              <button
                onClick={() => setIsDemoMode(false)}
                className="flex items-center gap-2 rounded-full border border-outline bg-surface/5 py-2 px-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant transition-all hover:bg-on-surface hover:text-background"
              >
                Exit Lab <X className="size-3.5" />
              </button>
            </div>

            <div className="flex h-full w-full pt-14">
              <aside className={`w-20 md:w-24 border-r border-outline/30 shrink-0 overflow-visible z-20 ${isDark ? 'bg-background/30' : 'bg-background/50'}`}>
                <AgentCommandRail agents={AGENTS} selectedId={selectedAgent?.id} onSelect={setSelectedAgent} instanceId="lab-rail" />
              </aside>
              <main className="flex-1 p-5 overflow-auto no-scrollbar">
                <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.5 }} className="h-full">
                  <CallDemoPanel className="h-full" selectedAgent={selectedAgent} />
                </motion.div>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Styles */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
