import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, AuthUser } from '../lib/api';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Login({ onLoggedIn }: { onLoggedIn: (user: AuthUser) => void }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="min-h-screen flex flex-col text-on-surface selection:bg-primary/30 selection:text-primary">

      <header className={`fixed top-0 z-50 w-full border-b border-outline/30 bg-background/40 backdrop-blur-xl transition-transform duration-500 ${isDemoMode ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
            SONIX <span className="text-primary">2.0</span>
          </Link>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {/* <ThemeToggle /> */}
              <Link to="/" className="studio-glow rounded-full bg-on-surface px-5 py-2 text-xs font-bold uppercase tracking-wider hover:scale-105 active:scale-95 text-background transition-all hover:bg-primary hover:text-on-primary-fixed">
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>


      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <form onSubmit={submit} className="w-full max-w-sm p-6 rounded-2xl bg-surface-high border border-outline-variant/50 shadow-sm space-y-4">
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="text-xs text-on-surface-variant">Use your dashboard username and password.</p>
          <div className="space-y-2">
            <label className="text-xs font-semibold">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg  border border-outline-variant/20"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg  border border-outline-variant/20"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            disabled={loading}
            className="w-full py-2 rounded-lg ember-gradient text-on-primary-fixed font-semibold disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

