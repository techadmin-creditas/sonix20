import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Bot, CheckCircle2, Code2, Flame, Play, Sparkles, Wand2 } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { cn } from '../lib/utils';

const CARDS = [
  { icon: Wand2, title: 'Autonomous Reasoning', body: 'System-level planning, tools orchestration, and adaptive turn control.' },
  { icon: Flame, title: 'Instant Deployment', body: 'Go from flow design to live calls in minutes with preset-safe defaults.' },
  { icon: Sparkles, title: 'Multilingual Logic', body: 'Built-in support for code-switching and locale-aware voice behavior.' },
  { icon: Bot, title: 'Enterprise Trained', body: 'Grounded answers from your policies, SOPs, scripts, and documents.' },
  { icon: Code2, title: 'Inline SDKs', body: 'Embed voice agents into your stack with event hooks and APIs.' },
] as const;

function Block({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
}

export default function HomeNew() {
  const reduce = useReducedMotion();
  return (
    <div className="min-h-screen  bg-[#08090c] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-amber-700/25 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-zinc-700/30 bg-[#090b10]/80 backdrop-blur-xl">
        <div className="mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="font-headline text-lg font-extrabold tracking-wider text-zinc-100">Sonix 2.0</Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-bold text-black">
              Start for free
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-[96%] max-w-[1600px] px-4 sm:px-6">
        <section className="pt-10 sm:pt-14">
          <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
              <Block>
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  <Sparkles className="size-3.5 text-orange-400" />
                  Voice agents / prod
                </span>
                <h1 className="mt-5 font-headline text-4xl font-extrabold leading-[1.04] sm:text-6xl">
                  Voice agents
                  <br />
                  that think,
                  <br />
                  speak, and ship.
                </h1>
                <p className="mt-4 max-w-md text-sm text-zinc-400">
                  Next-gen voice core with autonomous reasoning for enterprise calls, support, and secure workflows.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-black">
                    Try the voice core
                    <ArrowRight className="size-4" />
                  </Link>
                  <a href="#build" className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                    View all features
                  </a>
                </div>
              </Block>

              <motion.div
                className="rounded-2xl border border-zinc-700/60 bg-zinc-900 p-4"
                initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                animate={reduce ? undefined : { opacity: 1, scale: 1 }}
                transition={{ duration: 0.55 }}
              >
                <div className="rounded-xl border border-zinc-700/50 bg-gradient-to-b from-zinc-800 to-zinc-900 px-5 py-8">
                  <p className="text-right text-[10px] uppercase tracking-[0.2em] text-zinc-500">voice session preview</p>
                  <p className="mt-8 text-center text-xl text-zinc-200">“How can I help you today?”</p>
                  <div className="mt-8 rounded-lg border border-zinc-700 bg-zinc-900 p-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
                        <motion.div
                          className="h-full rounded-full bg-orange-500"
                          animate={reduce ? undefined : { width: ['22%', '64%', '40%', '79%', '58%'] }}
                          transition={reduce ? undefined : { duration: 4.5, repeat: Infinity }}
                        />
                      </div>
                      <Play className="size-3.5 text-orange-400" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Sonix capabilities</p>
            <h2 className="mt-3 max-w-xl font-headline text-3xl font-extrabold leading-tight">
              The intersection of intelligence and execution.
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CARDS.map((f) => (
                <React.Fragment key={f.title}>
                  <Block className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10">
                      <f.icon className="size-4 text-orange-400" />
                    </div>
                    <h3 className="mt-3 font-headline text-sm font-bold">{f.title}</h3>
                    <p className="mt-2 text-xs text-zinc-400">{f.body}</p>
                  </Block>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="grid gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:grid-cols-[0.95fr_1.05fr] sm:p-8">
            <Block className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex items-center justify-center">
              <div className="relative aspect-square w-full max-w-[260px] rounded-2xl border border-zinc-700 bg-black/60">
                <div className="absolute inset-8 rounded-xl border border-orange-500/30 bg-orange-500/10" />
                <div className="absolute inset-[34%] grid place-items-center rounded-lg bg-orange-500/20">
                  <span className="text-2xl font-black text-orange-400">∞</span>
                </div>
              </div>
            </Block>
            <Block className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Execution engine</p>
              <h3 className="mt-3 font-headline text-4xl font-extrabold leading-[1.05]">
                One step.
                <br />
                Any <span className="text-orange-400">scenario.</span>
              </h3>
              <p className="mt-3 max-w-md text-sm text-zinc-400">
                Configure prompts, memory, and tools once. The voice agent handles branching paths and returns structured outcomes.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {['Instant presets', 'Universal style'].map((kpi) => (
                  <div key={kpi} className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-300">
                    {kpi}
                  </div>
                ))}
              </div>
              <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-black">
                Launch instant agent
                <ArrowRight className="size-3.5" />
              </Link>
            </Block>
          </div>
        </section>

        <section id="build" className="mt-10">
          <div className="grid gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 sm:grid-cols-[1fr_1fr] sm:p-8">
            <Block className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">The workflow</p>
              <h3 className="mt-3 font-headline text-4xl font-extrabold leading-[1.05]">How to build the future.</h3>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  'Define personas and constraints.',
                  'Connect systems and business tools.',
                  'Deploy, monitor, and iterate.',
                ].map((step, idx) => (
                  <li key={step} className="flex items-start gap-3 text-zinc-300">
                    <span className="mt-0.5 text-xs font-bold text-orange-400">{String(idx + 1).padStart(2, '0')}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </Block>
            <Block className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 font-mono text-xs text-zinc-400">
                <p><span className="text-zinc-500">01</span> const agent = createVoiceAgent()</p>
                <p className="mt-1"><span className="text-zinc-500">02</span> .withTools(['crm', 'billing'])</p>
                <p className="mt-1"><span className="text-zinc-500">03</span> .deploy()</p>
                <p className="mt-2 text-emerald-400">✓ Session connected and response streaming...</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Success Rate</p>
                  <p className="mt-1 font-headline text-2xl font-extrabold">99.8%</p>
                </div>
                <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-500">Avg Latency</p>
                  <p className="mt-1 font-headline text-2xl font-extrabold">&lt; 40ms</p>
                </div>
              </div>
            </Block>
          </div>
        </section>

        <section className="mt-10">
          <Block className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-8 py-12 text-center">
            <h2 className="font-headline text-4xl font-extrabold leading-tight sm:text-5xl">
              Ready to ship <span className="text-orange-400">voice?</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
              Join teams designing the next generation of voice-first interfaces.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-xs font-bold uppercase tracking-wide text-black"
              >
                Launch your first agent
                <ArrowRight className="size-4" />
              </Link>
              <button className="rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                Talk to sales
              </button>
            </div>
          </Block>
        </section>

        <footer className="mt-10 border-t border-zinc-800 py-6 text-xs text-zinc-500">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Sonix 2.0</p>
            <div className="flex items-center gap-4">
              <a href="#build">Features</a>
              <a href="#build">Workflow</a>
              <a href="#build">Metrics</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
