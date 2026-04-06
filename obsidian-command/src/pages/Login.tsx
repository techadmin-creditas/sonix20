import React from 'react';
import { api, AuthUser } from '../lib/api';

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
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
  );
}

