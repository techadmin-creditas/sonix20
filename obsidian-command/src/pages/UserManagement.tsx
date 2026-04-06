import React from 'react';
import { Header } from '../components/Header';
import { api, AuthUser } from '../lib/api';

export default function UserManagement() {
  const [users, setUsers] = React.useState<AuthUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'user'>('user');
  const [error, setError] = React.useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const items = await api.listUsers();
      setUsers(items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }
    try {
      await api.createUser({ username: username.trim(), password, role });
      setUsername('');
      setPassword('');
      setRole('user');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create user');
    }
  }

  async function changePassword(userId: string) {
    const next = window.prompt('Set new password');
    if (!next) return;
    try {
      await api.changeUserPassword(userId, next);
      alert('Password updated');
    } catch (e: any) {
      setError(e?.message || 'Failed to change password');
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Users" subtitle="Admin user management" />
      <div className="p-8 grid gap-6 lg:grid-cols-3">
        <form onSubmit={createUser} className="lg:col-span-1 p-5 rounded-2xl bg-surface-low border border-outline-variant/20 space-y-3">
          <h3 className="font-semibold">Create User</h3>
          <input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20"
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button className="w-full py-2 rounded-lg ember-gradient text-on-primary-fixed font-semibold">Create</button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>

        <div className="lg:col-span-2 p-5 rounded-2xl bg-surface-low border border-outline-variant/20">
          <h3 className="font-semibold mb-3">Existing Users</h3>
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading...</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/10">
                  <div>
                    <p className="font-medium">{u.username}</p>
                    <p className="text-xs text-on-surface-variant">{u.role}</p>
                  </div>
                  <button onClick={() => changePassword(u.id)} className="text-xs px-3 py-1 rounded bg-surface-highest border border-outline-variant/20">
                    Change Password
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

