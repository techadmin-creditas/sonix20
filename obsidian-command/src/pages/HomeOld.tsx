import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Mic2,
  Play,
  Radio,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { cn } from '../lib/utils';

const CAPABILITIES = [
  {
    icon: Radio,
    title: 'Live voice experience',
    body: 'Low-latency streaming speech with natural turn-taking-built for real conversations, not brittle IVR trees.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge base',
    body: 'Ground answers in your docs and policies so every call stays accurate, auditable, and on-brand.',
  },
  {
    icon: Brain,
    title: 'Agentic voice',
    body: 'LLM-driven reasoning, memory, and tools-your bot can plan, act, and recover when callers go off-script.',
  },
  {
    icon: Workflow,
    title: 'Workflows',
    body: 'Compose branching flows and handoffs from a visual editor-connect CRM, tickets, and internal APIs.',
  },
] as const;

const PROVIDERS = [
  'Deepgram',
  'ElevenLabs',
  'Groq',
  'OpenAI',
  'Gemini',
  'Anthropic',
  'STS / TTS',
] as const;

const STEPS = [
  { step: '1', title: 'Design', desc: 'Define persona, voice, and tools in the Bot Factory.' },
  { step: '2', title: 'Connect', desc: 'Attach knowledge, workflows, and LLM providers you already use.' },
  { step: '3', title: 'Launch', desc: 'Run live sessions, review transcripts, latency, and insights.' },
] as const;

function MotionSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

export default function HomeOld() {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen bg-background text-on-surface overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-[-10%] top-[15%] h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute right-[-5%] top-[40%] h-96 w-96 rounded-full bg-secondary-container/40 dark:bg-primary/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-outline-variant/10 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="font-headline text-lg font-bold tracking-tight text-on-surface hover:text-primary transition-colors"
          >
            Sonix 2.0
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-xl ember-gradient px-4 py-2 text-sm font-semibold text-on-primary-fixed shadow-md shadow-primary/15 transition hover:opacity-95"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="relative pt-12 pb-20 sm:pt-16 sm:pb-28">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-low px-3 py-1 text-xs font-medium text-on-surface-variant"
              >
                <Sparkles className="size-3.5 text-primary" />
                Agentic voice + realtime stack
              </motion.div>
              <motion.h1
                className="mt-6 font-headline text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl lg:text-[3.25rem] leading-[1.1]"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05 }}
              >
                Build voice agents that think, speak, and ship in production.
              </motion.h1>
              <motion.p
                className="mt-5 max-w-xl text-base text-on-surface-variant sm:text-lg leading-relaxed"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                Sonix pairs streaming STT, expressive TTS, and the LLM you choose-so your team can deploy
                live experiences, rich knowledge, and workflows without stitching five vendors together.
              </motion.p>
              <motion.div
                className="mt-8 flex flex-wrap items-center gap-3"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.15 }}
              >
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl ember-gradient px-5 py-3 text-sm font-bold text-on-primary-fixed shadow-lg shadow-primary/20 transition hover:opacity-95"
                >
                  Try the live experience
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-low px-5 py-3 text-sm font-semibold text-on-surface hover:border-primary/40 transition-colors"
                >
                  How it works
                </a>
              </motion.div>
              <div className="mt-10 flex items-center gap-6">
                <div className={cn('flex items-end justify-center gap-1.5 h-16')} aria-hidden>
                  {['h-8', 'h-14', 'h-10', 'h-16', 'h-9', 'h-12'].map((h, i) => (
                    <div key={i} className={cn('w-2 rounded-full bg-primary/80 dark:bg-primary/90 marketing-eq-bar', h)} />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant uppercase tracking-wider">
                  <Mic2 className="size-4 text-primary" />
                  Realtime audio path
                </div>
              </div>
            </div>

            <motion.div
              className="relative"
              initial={reduce ? false : { opacity: 0, scale: 0.96 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.12 }}
            >
              <div className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-2xl shadow-primary/5">
                <img
                  src="/marketing/hero-waves.svg"
                  alt=""
                  className="absolute bottom-0 left-0 right-0 h-32 w-full object-cover opacity-90 dark:opacity-70"
                />
                <div className="relative flex flex-col items-center gap-6">
                  <img
                    src="/marketing/ai-mesh.svg"
                    alt=""
                    className="mx-auto w-48 max-w-[55%] drop-shadow-lg sm:w-56"
                  />
                  <img
                    src="/marketing/voice-bars.svg"
                    alt=""
                    className="h-12 w-auto opacity-90"
                  />
                  <p className="text-center text-sm text-on-surface-variant max-w-xs">
                    Voice-first UX with LLM reasoning-wired for latency budgets and operator visibility.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <MotionSection className="py-14 border-t border-outline-variant/10">
          <h2 className="font-headline text-2xl font-bold sm:text-3xl">What you can ship</h2>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            One control plane for the moving parts: speech, models, memory, and automation.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((item, i) => (
              <motion.div
                key={item.title}
                className="glass-panel rounded-2xl p-6 transition hover:border-primary/25"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-surface-high border border-outline-variant/15">
                  <item.icon className="size-5 text-primary" />
                </div>
                <h3 className="mt-4 font-headline text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </MotionSection>

        <MotionSection className="py-14">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-low/80 px-6 py-8 sm:px-10">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <Zap className="size-5 text-primary" />
              <h2 className="font-headline text-xl font-bold sm:text-2xl">Plays well with your stack</h2>
            </div>
            <p className="text-sm text-on-surface-variant max-w-2xl">
              Swap STT, TTS, and reasoning providers without rewriting your bots-Gemini, OpenAI, Anthropic,
              Groq, Deepgram, ElevenLabs, and more.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {PROVIDERS.map((name, i) => (
                <motion.span
                  key={name}
                  className="rounded-lg border border-outline-variant/20 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant"
                  initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                  whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.35 }}
                >
                  {name}
                </motion.span>
              ))}
            </div>
          </div>
        </MotionSection>

        <MotionSection id="how-it-works" className="py-14 border-t border-outline-variant/10">
          <h2 className="font-headline text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.step} className="relative rounded-2xl border border-outline-variant/15 bg-surface-low p-6">
                <span className="text-3xl font-headline font-extrabold text-primary/90">{s.step}</span>
                <h3 className="mt-3 font-headline font-bold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-1/2 -right-3 h-px w-6 -translate-y-1/2 bg-outline-variant/40"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </MotionSection>

        <MotionSection className="py-14">
          <h2 className="font-headline text-2xl font-bold sm:text-3xl">See it in action</h2>
          <p className="mt-2 text-on-surface-variant max-w-xl text-sm sm:text-base">
            Product walkthrough and live demo reel-video embed coming soon.
          </p>
          <div className="mt-8 aspect-video max-w-3xl overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-high/60 shadow-inner flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-primary/40 bg-surface text-primary">
              <Play className="size-7 translate-x-0.5" />
            </div>
            <p className="text-sm font-medium text-on-surface">Video placeholder</p>
            <p className="text-xs text-on-surface-variant">
              Replace this block with an embedded player or hosted asset when ready.
            </p>
          </div>
        </MotionSection>

        <MotionSection className="py-16">
          <div className="rounded-3xl ember-gradient px-8 py-12 text-center shadow-xl shadow-primary/20 sm:px-12">
            <h2 className="font-headline text-2xl font-extrabold text-on-primary-fixed sm:text-3xl">
              Ready to run a live session?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-on-primary-fixed/90">
              Sign in to open the dashboard, configure a bot, and start talking.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-surface px-6 py-3 text-sm font-bold text-primary shadow-lg"
            >
              Go to sign in
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </MotionSection>

        <footer className="border-t border-outline-variant/10 pt-10 text-center text-xs text-on-surface-variant">
          <p>Sonix 2.0 — Obsidian Command · Voice agents for teams that ship.</p>
        </footer>
      </main>
    </div>
  );
}
