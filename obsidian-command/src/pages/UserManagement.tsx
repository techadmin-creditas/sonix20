import React from 'react';
import { Header } from '../components/Header';
import { api, AuthUser } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AVAILABLE_MODULES } from '../constants/modules';
import {
  User, Shield, Key, Verified, Users, Loader2, ChevronDown, Trash2,
  Plus, X, Check, Settings, Layers, Lock, AlertCircle, RefreshCw, Layout,
  Zap, Eraser
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PermissionSelector, PRESETS } from '../components/PermissionSelector';

export default function UserManagement() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [users, setUsers] = React.useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(true);
  const [roles, setRoles] = React.useState<{ id: string; permissions: string[] }[]>([]);
  const [rolesLoading, setRolesLoading] = React.useState(true);
  
  const [isRolePopupOpen, setIsRolePopupOpen] = React.useState(false);
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [newRoleName, setNewRoleName] = React.useState('');
  
  const [newUsername, setNewUsername] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newRole, setNewRole] = React.useState<'admin' | 'user'>('user');
  const [newPermissions, setNewPermissions] = React.useState<string[]>([]);
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = React.useState<string[]>([]);
  const [isPermModalOpen, setIsPermModalOpen] = React.useState(false);
  const [userError, setUserError] = React.useState('');
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = React.useState<string | null>(null);
  
  const [activeTab, setActiveTab] = React.useState<'users' | 'roles'>('users');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = React.useState(false);
  async function loadRoles() {
    setRolesLoading(true);
    try {
      const data = await api.listRoles();
      setRoles(data.roles);
    } catch (e) {
      console.error('Failed to load roles', e);
    } finally {
      setRolesLoading(false);
    }
  }

  async function handleSaveRole(roleId: string, perms: string[]) {
    try {
      await api.updateRole(roleId, perms);
      await loadRoles();
    } catch (e) {
      alert('Failed to save role permissions');
    }
  }
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
    if (isAdmin) {
      void loadUsers();
      void loadRoles();
    }
  }, [isAdmin]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError('');
    if (!newUsername.trim() || !newPassword) {
      setUserError('Username and password are required');
      return;
    }
    try {
      await api.createUser({ 
        username: newUsername.trim(), 
        password: newPassword, 
        role: newRole,
        permissions: newPermissions.length > 0 ? newPermissions : undefined
      });
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setNewPermissions([]);
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

  const handleToggleNewPermission = (perm: string) => {
    if (newPermissions.includes(perm)) {
      setNewPermissions(prev => prev.filter(p => p !== perm));
    } else {
      setNewPermissions(prev => [...prev, perm]);
    }
  };

  const handleOpenPermissions = (user: AuthUser) => {
    setEditingUserId(user.id);
    // Use effective_permissions (merged role + overrides) as the starting point for the editor
    setEditingPermissions(user.effective_permissions || user.overrides || []);
    setIsPermModalOpen(true);
  };

  const handleToggleEditingPermission = (perm: string) => {
    if (editingPermissions.includes(perm)) {
      setEditingPermissions(prev => prev.filter(p => p !== perm));
    } else {
      setEditingPermissions(prev => [...prev, perm]);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingUserId) return;
    try {
      await api.updateUser(editingUserId, { permissions: editingPermissions });
      await loadUsers();
      setIsPermModalOpen(false);
    } catch (e: any) {
      alert('Failed to update permissions: ' + (e.message || 'Unknown error'));
    }
  };

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

  async function handleResetPermissions(userId: string) {
    if (!window.confirm('Clear all individual overrides and restore role defaults?')) return;
    try {
      await api.resetUserPermissions(userId);
      await loadUsers();
    } catch (e: any) {
      setUserError(e?.message || 'Failed to sync permissions');
    }
  }

  async function handleAddRole() {
    if (!newRoleName.trim()) return;
    const roleId = newRoleName.toLowerCase().replace(/\s+/g, '_');
    
    // Inherit from 'user' role defaults if available
    const userRole = roles.find(r => r.id === 'user');
    const initialPerms = userRole ? [...userRole.permissions] : ["read:sessions", "read:studio"];
    
    try {
      await api.updateRole(roleId, initialPerms);
      setNewRoleName('');
      await loadRoles();
      setSelectedRoleId(roleId);
    } catch (e) {
      alert('Failed to create role');
    }
  }

  const handleToggleRolePermission = (roleId: string, module: string, action: 'read' | 'update') => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    let nextPerms = [...role.permissions];
    const permString = `${action}:${module}`;
    
    if (nextPerms.includes(permString)) {
      nextPerms = nextPerms.filter(p => p !== permString);
    } else {
      nextPerms.push(permString);
    }
    
    void handleSaveRole(roleId, nextPerms);
  };

  async function applyPreset(roleId: string, perms: string[]) {
    await handleSaveRole(roleId, perms);
  }

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    overrides: users.filter(u => u.overrides && u.overrides.length > 0).length,
    active: users.filter(u => u.is_active !== 0).length
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title="Admin Command Center"
        subtitle="Identity & Access Governance"
      />

      <main className="flex-1 overflow-y-auto px-6 py-8 lg:p-12 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[
              { label: 'Identities', value: stats.total, icon: Users, color: 'text-primary' },
              { label: 'Administrators', value: stats.admins, icon: Shield, color: 'text-amber-500' },
              { label: 'Custom Overrides', value: stats.overrides, icon: Zap, color: 'text-primary' },
              { label: 'Active Sessions', value: stats.active, icon: Verified, color: 'text-emerald-500' }
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }} 
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-3xl bg-surface-highest/20 border border-white/5 flex flex-col gap-2 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <stat.icon className="size-16" />
                </div>
                <span className="text-2xl font-black font-headline tracking-tighter">{stat.value}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-outline flex items-center gap-2">
                  <stat.icon className={cn("size-3", stat.color)} />
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>

          <section className="glass-panel rounded-4xl border border-white/5 overflow-hidden flex flex-col shadow-2xl">
            {/* Nav & Search Header */}
            <div className="p-8 border-b border-white/5 bg-surface-highest/10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex items-center gap-1 bg-background/50 p-1.5 rounded-2xl border border-white/5 w-fit">
                <button 
                  onClick={() => setActiveTab('users')}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === 'users' ? "ember-gradient shadow-lg" : "text-outline hover:text-on-surface"
                  )}
                >
                  Indentity Registry
                </button>
                <button 
                  onClick={() => setActiveTab('roles')}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === 'roles' ? "ember-gradient shadow-lg" : "text-outline hover:text-on-surface"
                  )}
                >
                  Protocol Matrix
                </button>
              </div>

              <div className="flex items-center gap-4 flex-1 lg:max-w-md">
                <div className="relative flex-1 group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline group-focus-within:text-primary transition-colors" />
                  <input 
                    placeholder="Search by Identity or Protocol..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-background/40 border border-white/5 rounded-2xl outline-none focus:border-primary/30 transition-all font-bold text-xs"
                  />
                </div>
                <button 
                  onClick={() => setIsCreateDrawerOpen(true)}
                  className="size-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all shadow-lg"
                  title="Provision New Identity"
                >
                  <Plus className="size-6" />
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-0 flex-1 overflow-hidden">
              {activeTab === 'users' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-surface-highest/5">
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-outline">Neural Identity</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-outline">Access Tier</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-outline text-right">Admin Commands</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="group hover:bg-white/5 transition-colors">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "size-12 rounded-2xl flex items-center justify-center border transition-all",
                                u.role === 'admin' ? "bg-primary/20 border-primary/20 text-primary" : "bg-surface-highest border-white/10 text-outline"
                              )}>
                                {u.role === 'admin' ? <Shield className="size-6" /> : <User className="size-6" />}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-on-surface flex items-center gap-2">
                                  {u.username}
                                  {u.overrides && u.overrides.length > 0 && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-[8px] font-black uppercase text-primary tracking-tighter">
                                      <Zap className="size-2.5" /> Override
                                    </span>
                                  )}
                                </p>
                                <p className="text-[9px] font-black uppercase text-outline mt-1 tracking-tighter">ID: {u.id.substring(0, 8)} • protocol: active</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="relative w-fit group/tier">
                              <select 
                                value={u.role}
                                onChange={(e) => handleUpdateRole(u.id, e.target.value as 'admin' | 'user')}
                                className="pl-3 pr-8 py-2 rounded-xl bg-surface-highest/50 border border-white/5 text-[9px] font-black uppercase tracking-widest text-outline hover:text-primary transition-all appearance-none cursor-pointer outline-none"
                              >
                                {roles.map(r => (
                                  <option key={r.id} value={r.id}>{r.id.replace(/_/g, ' ')}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-outline pointer-events-none opacity-40 group-hover/tier:opacity-100 transition-opacity" />
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center justify-end gap-2">
                              {deletingId === u.id ? (
                                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl">
                                  <span className="text-[9px] font-black uppercase text-red-400">Confirm?</span>
                                  <button onClick={() => setDeletingId(null)} className="text-[9px] font-black uppercase text-outline px-1.5 py-0.5 hover:text-white transition-colors">Abort</button>
                                  <button onClick={() => handleDeleteUser(u.id)} className="text-[9px] font-black uppercase text-red-500 px-1.5 py-0.5 hover:bg-red-500/10 rounded">Wipe</button>
                                </div>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleOpenPermissions(u)}
                                    className="size-10 rounded-xl bg-primary/5 text-primary border border-primary/10 hover:bg-primary/10 transition-all flex items-center justify-center"
                                    title="Edit Permission Protocol"
                                  >
                                    <Lock className="size-4" />
                                  </button>
                                  {u.overrides && u.overrides.length > 0 && (
                                    <button 
                                      onClick={() => handleResetPermissions(u.id)}
                                      className="size-10 rounded-xl bg-orange-500/5 text-orange-400 border border-orange-500/10 hover:bg-orange-500/10 transition-all flex items-center justify-center animate-pulse"
                                      title="Reset to Role Defaults"
                                    >
                                      <RefreshCw className="size-4" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleChangePassword(u.id)}
                                    className="size-10 rounded-xl bg-surface-highest/50 text-outline border border-white/5 hover:border-white/10 transition-all flex items-center justify-center"
                                    title="Update Password"
                                  >
                                    <Key className="size-4" />
                                  </button>
                                  <button 
                                    onClick={() => setDeletingId(u.id)}
                                    className="size-10 rounded-xl bg-red-500/5 text-red-500/40 border border-red-500/10 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center"
                                    title="Delete Identity"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row h-full">
                  <div className="w-full lg:w-72 border-r border-white/5 p-8 space-y-6 flex flex-col bg-surface-highest/5 backdrop-blur-sm">
                    <div className="space-y-3">
                      {roles.map(role => (
                        <button
                          key={role.id}
                          onClick={() => setSelectedRoleId(role.id)}
                          className={cn(
                            "w-full px-5 py-3.5 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all border group relative overflow-hidden",
                            selectedRoleId === role.id 
                              ? "ember-gradient shadow-indigo  shadow-lg" 
                              : "bg-background border-white/5 text-outline hover:border-primary/30"
                          )}
                        >
                          <span className="relative z-10">{role.id.replace(/_/g, ' ')}</span>
                          {selectedRoleId === role.id && (
                            <motion.div layoutId="roleGlow" className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent pointer-events-none" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-outline ml-1">Universal Tiers</p>
                      <div className="flex flex-col gap-3">
                        <input 
                          value={newRoleName} 
                          onChange={e => setNewRoleName(e.target.value)} 
                          placeholder="New Access Tier..." 
                          className="bg-background border border-white/5 rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none focus:border-primary/50 transition-all" 
                        />
                        <button 
                          onClick={handleAddRole} 
                          className="w-full py-4 rounded-xl ember-gradient flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all"
                        >
                          <Plus className="size-4" /> Initialize
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-12 bg-surface-highest/5 custom-scrollbar">
                    {selectedRoleId ? (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Layout className="size-5" /></div>
                            <h4 className="text-xl font-headline font-black tracking-tight">{selectedRoleId.replace(/_/g, ' ')} Protocols</h4>
                          </div>
                          {selectedRoleId === 'admin' && <span className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase text-amber-500 flex items-center gap-2"><Lock className="size-3" /> Core System Protected</span>}
                        </div>
                        
                        <PermissionSelector 
                          permissions={roles.find(r => r.id === selectedRoleId)?.permissions || []}
                          onToggle={(perm) => handleToggleRolePermission(selectedRoleId, perm.split(':')[1], perm.split(':')[0] as any)}
                          onApplyPreset={(perms) => applyPreset(selectedRoleId, perms)}
                          isAdminRole={selectedRoleId === 'admin'}
                          selectedId={selectedRoleId}
                        />
                      </div>
                    ) : (
                      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center opacity-30">
                        <div className="size-24 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/10 shadow-inner">
                          <Layers className="size-10" />
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-[0.3em] mb-2 font-headline">Select Authority Level</h4>
                        <p className="text-[10px] font-bold text-outline uppercase tracking-widest max-w-[200px] mx-auto">Choose a tier to manage its global neural protocols</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Provision New Identity Drawer */}
      <AnimatePresence>
        {isCreateDrawerOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-end p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateDrawerOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-full studio-mesh-gradient border-l border-white/5 shadow-2xl flex flex-col"
            >
              <div className="p-10 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Plus className="size-8" /></div>
                  <div>
                    <h3 className="text-2xl font-headline font-black tracking-tight">Provision Identity</h3>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] mt-1 text-primary animate-pulse">Neural Enrollment Active</p>
                  </div>
                </div>
                <button onClick={() => setIsCreateDrawerOpen(false)} className="size-12 rounded-2xl border border-white/5 hover:bg-white/5 flex items-center justify-center text-outline"><X className="size-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                <form onSubmit={handleCreateUser} id="provision-form" className="space-y-10">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Username</label>
                      <input 
                        placeholder="Neural Handler..." 
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full px-5 py-4 bg-background border border-white/5 rounded-2xl outline-none focus:border-primary/50 transition-all font-bold text-sm" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Password</label>
                      <input 
                        type="password"
                        placeholder="••••••••" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-background border border-white/5 rounded-2xl outline-none focus:border-primary/50 transition-all font-bold text-sm" 
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Access Protocol</label>
                    <div className="relative">
                      <select 
                        value={newRole}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setNewRole(val);
                          const r = roles.find(role => role.id === val);
                          if (r) setNewPermissions(r.permissions);
                        }}
                        className="w-full px-5 py-4 bg-background border border-white/5 rounded-2xl outline-none focus:border-primary/50 transition-all font-bold text-sm appearance-none cursor-pointer"
                      >
                        <option value="user">User Tier</option>
                        <option value="admin">Admin Tier</option>
                        {roles.filter(r => r.id !== 'admin' && r.id !== 'user').map(r => (
                          <option key={r.id} value={r.id}>{r.id.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 size-5 text-outline pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-outline">Custom Permission Protocol</label>
                      <span className="text-[8px] font-black uppercase px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">Optional Override</span>
                    </div>
                    <PermissionSelector 
                      permissions={newPermissions}
                      onToggle={handleToggleNewPermission}
                      onApplyPreset={setNewPermissions}
                      isAdminRole={newRole === 'admin'}
                    />
                  </div>
                </form>
              </div>

              <div className="p-10 bg-background/30 border-t border-white/5 flex gap-4">
                <button 
                  onClick={() => setIsCreateDrawerOpen(false)}
                  className="flex-1 py-4 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-outline hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button 
                  form="provision-form"
                  type="submit"
                  className="flex-2 py-4 rounded-2xl ember-gradient shadow-lg shadow-indigo-500/20 text-[10px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all"
                >
                  Initialize Identity
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Permission Editor Drawer */}
      <AnimatePresence>
        {isPermModalOpen && (
          <div className="fixed inset-0 z-110 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPermModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-3xl h-full bg-surface-highest border-l border-white/5 shadow-2xl flex flex-col"
            >
              <div className="p-10 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="size-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner">
                    <Lock className="size-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-headline font-black tracking-tight">Identity Override</h3>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] mt-1 text-amber-500">Custom Protocol Editor</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPermModalOpen(false)} 
                  className="size-12 rounded-2xl border border-white/5 hover:bg-white/5 flex items-center justify-center text-outline"
                >
                  <X className="size-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <PermissionSelector 
                  permissions={editingPermissions}
                  onToggle={handleToggleEditingPermission}
                  onApplyPreset={setEditingPermissions}
                />
              </div>

              <div className="p-10 bg-background/30 border-t border-white/5 flex gap-4">
                <button 
                  onClick={() => setIsPermModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-outline hover:bg-white/5 transition-all"
                >
                  Discard Overrides
                </button>
                <button 
                  onClick={handleSavePermissions}
                  className="flex-2 py-4 rounded-2xl ember-gradient shadow-lg shadow-indigo-500/20 text-[10px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all"
                >
                  Commit Protocols
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
