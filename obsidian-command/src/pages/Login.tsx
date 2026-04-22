import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, AuthUser } from '../lib/api';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, ArrowRight, Lock, User, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import LiveTalk from '../components/LiveTalk';

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

export default function Login({ onLoggedIn }: { onLoggedIn: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [landingBotId, setLandingBotId] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    api.getLandingPageBot()
      .then(res => setLandingBotId(res.bot_id))
      .catch(err => console.error('Failed to fetch landing bot:', err));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await api.login(username.trim(), password);
      onLoggedIn(out.user);
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col text-on-surface selection:bg-primary/30 selection:text-primary bg-background overflow-hidden">
      <header className="fixed top-0 z-50 w-full border-b border-outline/30 bg-background/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
            SONIX <span className="text-primary">2.0</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="studio-glow rounded-full bg-on-surface px-5 py-2 text-xs font-bold uppercase tracking-wider hover:scale-105 active:scale-95 text-background transition-all hover:bg-primary hover:text-on-primary-fixed">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex flex-col justify-center px-6 md:px-20 overflow-hidden">
        <BackgroundWaves />

        <div className="mx-auto w-full max-w-7xl flex flex-col lg:flex-row gap-12 lg:gap-24 items-center z-10">


          {/* RIGHT: LOGIN FORM BOX INSIDE GLASS PANEL */}
          <motion.div
            className="relative hidden lg:block flex-1 w-full"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.12 }}
          >
            <div className="glass-panel relative overflow-hidden rounded-[3rem] p-8 sm:p-12 shadow-2xl shadow-primary/10 border-primary/20 bg-surface-low/40 backdrop-blur-md">
              <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

              <div className="relative z-10 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black uppercase tracking-tight text-on-surface">Sign In</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">Secure Gateway Active</p>
                </div>

                <form onSubmit={submit} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5 relative group">
                      <div className="absolute left-4 top-[38px] transition-colors group-focus-within:text-primary text-outline">
                        <User className="size-4" />
                      </div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-outline ml-1">Username</label>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="USERNAME"
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-background/50 border border-outline-variant/20 focus:border-primary/50 focus:bg-background transition-all outline-none text-sm font-semibold placeholder:text-outline/30 placeholder:font-normal"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5 relative group">
                      <div className="absolute left-4 top-[38px] transition-colors group-focus-within:text-primary text-outline">
                        <Lock className="size-4" />
                      </div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-outline ml-1">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="PASSWORD"
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-background/50 border border-outline-variant/20 focus:border-primary/50 focus:bg-background transition-all outline-none text-sm font-semibold placeholder:text-outline/30 placeholder:font-normal"
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-wider text-center"
                    >
                      {error}
                    </motion.div>
                  )}

                  <button
                    disabled={loading}
                    className="w-full py-4 rounded-full bg-on-surface text-background text-xs font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-on-primary-fixed transition-all active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-primary/10 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Initialize Session
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

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

          {/* LEFT: HERO TEXT */}
          <div className="w-full lg:w-[50%] space-y-8">
            <motion.div
              initial={reduce ? false : { opacity: 0, x: -20 }}
              animate={reduce ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-low px-3 py-1 text-xs font-medium text-on-surface-variant w-fit"
            >
              {/* <Sparkles className="size-3.5 text-primary" /> */}
              {/* Agentic voice + realtime stack */}
            </motion.div>

            <h1 className="hero-reveal font-headline text-5xl lg:text-7xl font-black leading-[1.1] tracking-tight text-on-surface uppercase">
              Welcome back to <br />
              <span className="bg-linear-to-r from-primary via-tertiary to-primary bg-clip-text text-transparent">
                the console.
              </span>
            </h1>
            <p className="hero-reveal max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
              Authenticate your identity to resume mission control and manage your autonomous voice fleet.
            </p>
            {/* <div className="hero-reveal flex flex-wrap gap-4 pt-4">
              <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-on-surface px-10 py-5 text-sm font-black uppercase tracking-widest text-background transition-all hover:bg-primary hover:text-on-primary-fixed shadow-2xl shadow-primary/20">
                Launch Console
                <ArrowRight className="size-5" />
              </Link>
            </div> */}
          </div>
        </div>
      </main>
    </div>
  );
}

