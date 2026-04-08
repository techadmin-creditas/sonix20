import React from 'react';
import { Header } from '../components/Header';
import { api, AuthUser } from '../lib/api';
import {
  User, Shield, Key, Verified, Users, Loader2, ChevronDown, Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function UserManagement() {
  const [users, setUsers] = React.useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [newUsername, setNewUsername] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newRole, setNewRole] = React.useState<'admin' | 'user'>('user');
  const [userError, setUserError] = React.useState('');
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = React.useState<string | null>(null);

  async function loadUsers() {
    setUsersLoading(true);
    setUserError('');
    try {
      const items = await api.listUsers();
      setUsers(items);
    } catch (e: any) {
      setUserError(e?.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  React.useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError('');
    if (!newUsername.trim() || !newPassword) {
      setUserError('Username and password are required');
      return;
    }
    try {
      await api.createUser({ username: newUsername.trim(), password: newPassword, role: newRole });
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      await loadUsers();
      alert('User created successfully');
    } catch (e: any) {
      setUserError(e?.message || 'Failed to create user');
    }
  }

  async function handleUpdateRole(userId: string, nextRole: 'admin' | 'user') {
    try {
      await api.updateUser(userId, { role: nextRole });
      await loadUsers();
    } catch (e: any) {
      setUserError(e?.message || 'Failed to update role');
    }
  }

  async function handleDeleteUser(userId: string) {
    setDeleteLoadingId(userId);
    try {
      await api.deleteUser(userId);
      await loadUsers();
    } catch (e: any) {
      setUserError(e?.message || 'Failed to delete user');
    } finally {
      setDeleteLoadingId(null);
      setDeletingId(null);
    }
  }

  async function handleChangePassword(userId: string) {
    const next = window.prompt('Set new password');
    if (!next) return;
    try {
      await api.changeUserPassword(userId, next);
      alert('Password updated');
    } catch (e: any) {
      setUserError(e?.message || 'Failed to change password');
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <Header
        title="User Management"
        subtitle="System Administration Hub"
      />

      <main className="lg:py-12 max-w-7xl mx-auto w-full">
        <section className="glass-panel rounded-3xl p-8 lg:p-12 space-y-10 border border-primary/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Shield className="size-6" />
              </div>
              <div>
                <h3 className="text-xl font-headline font-black tracking-tight">User Management</h3>
                <p className="text-xs text-outline font-bold uppercase tracking-widest mt-1">System Administration Hub</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-surface-highest rounded-2xl px-5 py-3 border border-white/5">
              <Users className="size-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest">{users.length} Active Accounts</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Create User Form */}
            <form onSubmit={handleCreateUser} className="space-y-6 p-8 rounded-3xl bg-surface-highest/40 border border-white/5 shadow-inner">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-outline mb-4">Provision New Identity</h4>
              <div className="grid gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
                    <input
                      placeholder="Enter username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-highest border border-white/10 outline-none focus:border-primary/50 transition-all font-bold text-sm shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Password</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-highest border border-white/10 outline-none focus:border-primary/50 transition-all font-bold text-sm shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Access Tier</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                      className="w-full pl-12 pr-10 py-3 rounded-xl bg-surface-highest border border-white/10 outline-none focus:border-primary/50 transition-all font-bold text-sm shadow-sm appearance-none cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-outline pointer-events-none transition-colors" />
                  </div>
                </div>
              </div>
              <button className="w-full py-4 rounded-xl ember-gradient text-on-primary-fixed font-black uppercase tracking-widest text-xs shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <Verified className="size-4" />
                Create User
              </button>
              {userError && <p className="text-xs text-red-400 font-bold text-center mt-2 animate-pulse">{userError}</p>}
            </form>

            {/* User List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-outline">Identity Registry</h4>
                <button onClick={loadUsers} className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity">
                  Force Sync
                </button>
              </div>
              {usersLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 border border-white/5 rounded-3xl bg-surface-highest/20">
                  <Loader2 className="size-8 animate-spin text-primary/50" />
                  <p className="text-[10px] text-outline font-black uppercase tracking-widest">Scanning Registry...</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {users.map((u) => (
                    <div key={u.id} className="group flex items-center justify-between p-5 rounded-2xl bg-surface-highest/30 border border-white/5 hover:border-primary/30 transition-all hover:shadow-lg">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "size-10 rounded-xl flex items-center justify-center border transition-all",
                          u.role === 'admin' ? "bg-primary/20 border-primary/20 text-primary shadow-sm" : "bg-white/5 border-white/10 text-outline"
                        )}>
                          {u.role === 'admin' ? <Shield className="size-5" /> : <User className="size-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface flex items-center gap-2">
                            {u.username}
                          </p>
                          <p className="text-[9px] text-outline font-black uppercase tracking-tighter mt-0.5 opacity-60">
                            ID: {u.id.substring(0, 8)} • role: {u.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {deletingId === u.id ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
                            <span className="text-[10px] font-black uppercase text-red-400">Confirm Delete?</span>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 rounded text-[9px] font-black uppercase text-outline hover:bg-white/5 transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              disabled={deleteLoadingId === u.id}
                              className="px-2 py-1 rounded text-[9px] font-black uppercase bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {deleteLoadingId === u.id ? <Loader2 className="size-2 animate-spin" /> : null}
                              Delete
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative group/role">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateRole(u.id, e.target.value as 'admin' | 'user')}
                                className="pl-3 pr-8 py-2 rounded-xl bg-surface-highest/50 border border-white/5 text-[9px] font-black uppercase tracking-widest text-outline hover:text-primary hover:border-primary/50 transition-all shadow-sm appearance-none cursor-pointer outline-none"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-outline pointer-events-none opacity-40 group-hover/role:opacity-100 transition-opacity" />
                            </div>
                            <button
                              onClick={() => handleChangePassword(u.id)}
                              className="px-4 py-2 rounded-xl bg-surface-highest border border-white/10 text-[9px] font-black uppercase tracking-widest text-outline hover:text-primary hover:border-primary/50 active:scale-95 transition-all shadow-sm"
                            >
                              Password
                            </button>
                            <button
                              onClick={() => setDeletingId(u.id)}
                              className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-500 transition-all border border-transparent hover:border-red-500/30 active:scale-90"
                              title="Delete Identity"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
