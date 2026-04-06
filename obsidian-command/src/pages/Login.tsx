import React from 'react';
import { Link } from 'react-router-dom';
import { api, AuthUser } from '../lib/api';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Login({ onLoggedIn }: { onLoggedIn: (user: AuthUser) => void }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

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
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-outline-variant/10 bg-background/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="font-headline text-sm font-bold text-on-surface hover:text-primary transition-colors">
            Sonix
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm p-6 rounded-2xl bg-surface-low border border-outline-variant/20 space-y-4">
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="text-xs text-on-surface-variant">Use your dashboard username and password.</p>
        <div className="space-y-2">
          <label className="text-xs font-semibold">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20"
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

