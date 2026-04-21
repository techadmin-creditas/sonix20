import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { PERSONAS } from '../constants';
import { cn } from '../lib/utils';
import { api, Bot } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  PlusCircle,
  Star,
  MessageSquare,
  CheckCircle2,
  Settings2,
  Search,
  LayoutGrid,
  List,
  Loader2,
  AlertTriangle,
  Cpu,
  Calendar,
  Landmark,
  Trash2,
  GitBranch,
  UserRound,
  Smile,
  Angry,
  Focus,
  Copy,
  Languages,
  Clock,
  ChevronRight,
  Bot as BotIconLucide,
} from 'lucide-react';
import { PermissionGuard } from '../components/PermissionGuard';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../lib/theme';

export default function Personas({ debug }: { debug?: boolean }) {
  const { currentUser, canUpdate } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [personas, setPersonas] = React.useState<Bot[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
  const [roles, setRoles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [botStats, setBotStats] = React.useState<Record<string, { sessions: number; completion: number; dropoff: number; avgDuration: number }>>({});
  const [botStatsLoading, setBotStatsLoading] = React.useState(!debug);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredPersonas = searchQuery.trim()
    ? personas.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : personas;

  const handleDelete = async (id: string) => {
    setDeleteLoadingId(id);
    try {
      await api.deleteBot(id);
      setPersonas(prev => prev.filter(p => p.id !== id));
    } catch {
      // keep item in list on error
    } finally {
      setDeleteLoadingId(null);
      setDeletingId(null);
    }
  };

  React.useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      try {
        // ALWAYS fetch bots - this is common to all users
        const bots = await api.getBots();
        setPersonas(bots);

        // ONLY fetch users/roles if in debug mode (Admin assignment matrix)
        if (debug) {
          try {
            const [userData, rolesData] = await Promise.all([
              api.listUsers(),
              api.listRoles()
            ]);
            setUsers(userData);
            setRoles(rolesData.roles);
          } catch (adminErr) {
            console.error('Administrative link failed (Admin role likely required):', adminErr);
            // Don't crash the whole page, just log it.
          }
        }
      } catch (err) {
        console.error('Failed to load personas:', err);
      } finally {
        setLoading(false);
      }
    }

    async function loadStats() {
      try {
        const sessions = await api.getSessions(1000);
        const stats = sessions.reduce<Record<string, { sessions: number; completed: number; totalDuration: number }>>((acc, s) => {
          const botId = s.bot_id;
          if (!botId) return acc;
          if (!acc[botId]) acc[botId] = { sessions: 0, completed: 0, totalDuration: 0 };
          acc[botId].sessions += 1;
          if (s.ended_at !== null) {
            acc[botId].completed += 1;
            acc[botId].totalDuration += (s.ended_at - s.started_at);
          }
          return acc;
        }, {});

        const normalized: Record<string, { sessions: number; completion: number; dropoff: number; avgDuration: number }> = {};
        for (const [botId, v] of Object.entries(stats)) {
          normalized[botId] = {
            sessions: v.sessions,
            completion: v.sessions > 0 ? (v.completed / v.sessions) * 100 : 0,
            dropoff: v.sessions > 0 ? ((v.sessions - v.completed) / v.sessions) * 100 : 0,
            avgDuration: v.completed > 0 ? (v.totalDuration / v.completed) : 0,
          };
        }
        setBotStats(normalized);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setBotStatsLoading(false);
      }
    }

    loadInitial();
    if (!debug) loadStats();
  }, [debug]);

  const handleToggleAssignment = async (bot: Bot, isAssigned: boolean) => {
    if (!selectedUser) return;
    try {
      if (isAssigned) {
        // Fetch full bot details first because system_prompt is excluded from list
        let fullBot;
        try {
          fullBot = await api.getBot(bot.id);
        } catch (e) {
          console.error("Failed to fetch full bot details", e);
          fullBot = bot; // Fallback
        }

        // Create a unique clone for this user
        const clone = await api.createBot({
          ...fullBot,
          id: undefined,
          owner_user_id: selectedUser.id,
          // name: `${bot.name} (Clone)` // Optional: help identify clones
        });

        const bots = await api.getBots();
        setPersonas(bots);
      } else {
        // Only allow unassigning (deleting) if this IS the user's instance
        if (bot.owner_user_id === selectedUser.id) {
          await api.deleteBot(bot.id);
          setPersonas(prev => prev.filter(p => p.id !== bot.id));
        }
      }
    } catch (err) {
      alert('Neural link replication failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col ">
      <Header
        title={debug ? "Neural Permission Matrix" : "Bot Factory"}
        subtitle={debug ? "Debug Configuration & User Assignments" : "Bot Personas"}
        actions={
          <div className="w-full flex justify-between items-center gap-4">
            {debug ? (
              <div className="flex items-center gap-4">
                 <Link to="/personas" className="px-4 py-2 rounded-xl bg-surface-low text-on-surface text-xs font-bold hover:bg-surface-high transition-all border border-outline-variant/10">
                   Back to Factory
                 </Link>
              </div>
            ) : personas?.length > 0 && (
              <>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
                  <input
                    type="text"
                    placeholder="Search by bot..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-surface-low border border-outline-variant/10 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-outline/50"
                  />
                </div>
                <PermissionGuard require={{ module: 'personas', action: 'update' }}>
                  <Link
                    to="/personas/create"
                    className="px-6 py-2.5 rounded-xl bg-primary text-on-primary-fixed font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all text-sm"
                  >
                    <PlusCircle className="size-4" />
                    Create Bot
                  </Link>
                </PermissionGuard>
              </>
            )}
          </div>
        }
      />

      <div className="p-10 flex flex-col gap-10">
        {botStatsLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Loader2 className="size-12 text-primary animate-spin" />
            <p className="text-outline mt-4 font-bold uppercase tracking-widest text-xs">Initializing Neural Links...</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 bg-red-500/5 rounded-3xl border border-red-500/20">
            <AlertTriangle className="size-12 text-red-500" />
            <p className="text-red-200 mt-4 font-bold">Failed to connect to Bot Factory</p>
            <p className="text-red-500/60 text-sm mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-all"
            >
              Retry Connection
            </button>
          </div>
        )}


        {!botStatsLoading && !error && filteredPersonas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="size-20 rounded-3xl bg-surface-high flex items-center justify-center text-outline">
              <BotIcon type="memory" />
            </div>
            <div className="text-center">
              {!searchQuery && (
                <p className="font-bold text-on-surface text-lg">No Bots yet</p>
              )}
              <p className="text-sm text-outline mt-1">
                {searchQuery ? (
                  <>
                    <p className="font-bold text-sm">No Bot match &ldquo;{searchQuery}&rdquo;</p>
                    <p className="text-xs mt-1 opacity-60">Try searching by another Bot </p>
                  </>
                ) : 'Create your first Bot.'}
              </p>
            </div>
            {!searchQuery && (
            <PermissionGuard require={{ module: 'personas', action: 'update' }}>
              <Link to="/personas/create" className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold text-sm shadow-lg">
                Create Your First Bot
              </Link>
            </PermissionGuard>
            )}
          </div>
        )}





        {!botStatsLoading && !error && !debug && (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filteredPersonas.map((persona, i) => (
                <motion.div
                  key={persona.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    layout: { type: 'spring', stiffness: 500, damping: 35, mass: 0.5 },
                    opacity: { duration: 0.2 }
                  }}
                  className={cn(
                    "group relative flex flex-col p-7 rounded-[10px] border transition-all duration-300",
                    isDark 
                      ? "bg-surface/40 border-outline-variant/10 hover:border-primary/40 hover:bg-surface/60" 
                      : "bg-surface border-outline-variant/10 shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/30",
                    deletingId === persona.id && "border-red-500/50 bg-red-500/5"
                  )}
                >
                  {/* Top Bar: Avatar & Title */}
                  <div className="flex items-start gap-4 mb-4">
                    <PersonaTileAvatar bot={persona} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-headline text-xl font-black text-on-surface truncate group-hover:text-primary transition-colors duration-300">
                          {persona.name}
                        </h3>
                        {persona.is_active && (
                          <div className="relative">
                            <div className="size-2 rounded-full bg-emerald-500" />
                            <div className="absolute inset-0 size-2 rounded-full bg-emerald-500 animate-ping opacity-40" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/80 mt-0.5">
                        {persona.role || 'Neural Assistant'}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="flex-1 mb-6">
                    <p className={cn(
                      "text-sm leading-relaxed italic group-hover:opacity-100 transition-opacity line-clamp-3",
                      isDark ? "text-on-surface-variant opacity-80" : "text-on-surface font-medium"
                    )}>
                      &ldquo;{persona.description || 'Neural persona profile initializing...'}&rdquo;
                    </p>
                  </div>

                  {/* Metrics Section */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
                        isDark ? "text-on-surface/90" : "text-on-surface/70"
                      )}>
                        <Languages className="size-3.5 text-primary" />
                        {persona.default_language || (persona as any).language || 'en'}
                      </div>
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-bold uppercase tracking-wider",
                        isDark ? "text-on-surface/90" : "text-on-surface/70"
                      )}>
                        <Clock className="size-3.5 text-primary" />
                        {new Date(persona.created_at * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <div className={cn(
                          "flex justify-between text-[10px] font-black uppercase tracking-widest",
                          isDark ? "text-on-surface/80" : "text-on-surface"
                        )}>
                          <span>Logic</span>
                          <span className="text-primary font-bold">{60 + (i * 7) % 35}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-highest/20 rounded-full overflow-hidden border border-outline-variant/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${60 + (i * 7) % 35}%` }}
                            transition={{ 
                              duration: 1.2, 
                              ease: [0.34, 1.56, 0.64, 1], 
                              delay: 0.15 + (i * 0.03) 
                            }}
                            className="h-full bg-primary"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className={cn(
                          "flex justify-between text-[10px] font-black uppercase tracking-widest",
                          isDark ? "text-on-surface/80" : "text-on-surface"
                        )}>
                          <span>Empathy</span>
                          <span className="text-emerald-500 font-bold">{40 + (i * 13) % 55}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface-highest/20 rounded-full overflow-hidden border border-outline-variant/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${40 + (i * 13) % 55}%` }}
                            transition={{ 
                              duration: 1.2, 
                              ease: [0.34, 1.56, 0.64, 1], 
                              delay: 0.2 + (i * 0.03) 
                            }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 h-10">
                    <AnimatePresence mode="wait">
                    {deletingId === persona.id ? (
                      <motion.div 
                        key="delete-confirm"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 flex items-center justify-between bg-red-500/10 p-1.5 rounded-xl border border-red-500/20"
                      >
                         <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest pl-2 font-headline">Revoke Access?</span>
                         <div className="flex gap-1">
                            <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 text-[9px] font-bold uppercase text-on-surface hover:bg-surface-highest rounded-lg transition-colors">No</button>
                            <button 
                              onClick={() => handleDelete(persona.id)} 
                              className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-bold uppercase rounded-lg shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                              {deleteLoadingId === persona.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                              Confirm
                            </button>
                         </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex items-center gap-2"
                      >
                        <Link
                          to={`/personas/${persona.id}/config`}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all border flex items-center justify-center gap-2",
                            canUpdate('personas', (persona as any).owner_user_id)
                              ? "bg-surface-high border-outline-variant/20 hover:bg-surface-highest text-on-surface"
                              : "bg-surface-low border-outline-variant/5 text-outline cursor-not-allowed"
                          )}
                        >
                          Configure
                          <ChevronRight className="size-3 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                        
                        <PermissionGuard require={{ module: 'personas', action: 'update', ownerId: (persona as any).owner_user_id }}>
                          <Link
                            to={`/personas/create?clone=${persona.id}`}
                            className="p-2 rounded-xl bg-surface-high border border-outline-variant/20 text-on-surface hover:text-primary transition-all duration-300"
                            title="Duplicate"
                          >
                            <Copy className="size-4" />
                          </Link>
                          <button
                            onClick={() => setDeletingId(persona.id)}
                            className="p-2 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all duration-300"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </PermissionGuard>
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {debug && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row gap-8 lg:gap-12"
          >
            {/* User Sidebar */}
            <div className="w-full lg:w-80 flex flex-col gap-6">
              <div className="px-1 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <UserRound className="size-3.5" /> Identity Node
                </h3>
                <span className="text-[10px] font-bold text-outline/50">{users.length} Nodes</span>
              </div>
              <div className="flex flex-col gap-2">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all relative overflow-hidden group",
                      selectedUser?.id === u.id 
                        ? "bg-primary border-primary shadow-lg shadow-primary/10 text-on-primary-fixed" 
                        : "bg-surface-low/50 border-outline-variant/10 hover:border-primary/30 hover:bg-surface-low text-on-surface"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="font-bold text-sm truncate">{u.username}</span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border shrink-0",
                        selectedUser?.id === u.id ? "bg-white/10 border-white/20" : "bg-primary/5 border-primary/20 text-primary"
                      )}>
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-60">
                      <BotIconLucide className={cn("size-3", selectedUser?.id === u.id ? "text-white" : "text-primary")} />
                      <span className="text-[9px] font-medium uppercase tracking-wider">
                        {personas.filter(p => p.owner_user_id === u.id).length} Active Links
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Assignment Panel */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {selectedUser ? (
                  <motion.div
                    key={selectedUser.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="space-y-10"
                  >
                    <div className={cn(
                      "p-8 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden",
                      isDark ? "bg-surface/40 border-primary/20" : "bg-primary/5 border-primary/10"
                    )}>
                      {/* Decoration */}
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                        <UserRound className="size-32" />
                      </div>
                      
                      <div className="relative">
                        <h4 className="text-2xl font-headline font-black tracking-tight text-on-surface">{selectedUser.username} Protocol</h4>
                        <p className="text-xs text-outline font-medium mt-1 uppercase tracking-wider opacity-60">Managing neural link access for node {selectedUser.id.substring(0,8)}</p>
                      </div>
                      
                      <div className="flex gap-3 shrink-0 relative">
                        <div className="px-4 py-2 rounded-xl bg-surface-low border border-outline-variant/10 text-[9px] font-black uppercase tracking-[0.2em] text-primary">
                          STATUS: SYNCHRONIZED
                        </div>
                      </div>
                    </div>

                    <div className="space-y-12">
                      {/* Unique Fleet Section */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-1 border-l-2 border-emerald-500 pl-4">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Active Link Fleet</h3>
                            <p className="text-[9px] font-medium text-outline mt-0.5">Instance-specific neural assets deployed to this node.</p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">{personas.filter(p => p.owner_user_id === selectedUser.id).length} Active</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {personas.filter(p => p.owner_user_id === selectedUser.id).map(p => (
                            <motion.div layout key={p.id} className="p-4 rounded-2xl border bg-surface-low/30 border-outline-variant/5 hover:bg-surface-low hover:border-emerald-500/30 flex items-center justify-between group transition-all">
                              <div className="flex items-center gap-4">
                                <PersonaTileAvatar bot={p} />
                                <div>
                                  <h5 className="font-bold text-sm text-on-surface">{p.name}</h5>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/80">{p.role || 'Assistant'}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleToggleAssignment(p, false)}
                                className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                              >
                                Revoke
                              </button>
                            </motion.div>
                          ))}
                          {personas.filter(p => p.owner_user_id === selectedUser.id).length === 0 && (
                            <div className="md:col-span-2 p-12 rounded-3xl border border-dashed border-outline-variant/20 flex flex-col items-center justify-center text-center opacity-40">
                               <BotIconLucide className="size-8 mb-4 text-outline" />
                               <p className="text-[10px] font-black uppercase tracking-[0.2em]">No active neural links</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Templates Section */}
                      <div className="space-y-6">
                         <div className="flex items-center justify-between px-1 border-l-2 border-primary pl-4">
                          <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Blueprints Repository</h3>
                            <p className="text-[9px] font-medium text-outline mt-0.5">Source templates available for node replication.</p>
                          </div>
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">Source Feed</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {personas.filter(p => !p.owner_user_id).map(p => (
                            <div key={p.id} className="p-4 rounded-2xl border bg-surface-low border-outline-variant/5 hover:bg-surface-low hover:border-primary/40 flex items-center justify-between group transition-all">
                              <div className="flex items-center gap-4">
                                <PersonaTileAvatar bot={p} />
                                <div>
                                  <h5 className="font-bold text-sm text-on-surface">{p.name}</h5>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Base Prototype</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleToggleAssignment(p, true)}
                                className="px-3 py-1.5 rounded-lg bg-primary text-on-primary-fixed text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-1.5 shadow-lg shadow-primary/10 active:scale-95"
                              >
                                <PlusCircle className="size-3" />
                                Clone Link
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 rounded-3xl border border-dashed border-outline-variant/10 bg-surface-low/20"
                  >
                    <div className="size-20 rounded-2xl bg-surface-high flex items-center justify-center mb-8 border border-outline-variant/20 shadow-inner group">
                      <UserRound className="size-8 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.4em] mb-3 text-on-surface">Initialize Matrix Node</h4>
                    <p className="text-[10px] font-medium text-outline uppercase tracking-[0.2em] max-w-[280px] mx-auto leading-relaxed">
                      Select an identity node from the sidebar to establish neural synchronization protocols.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>
    </div >
  );
}

function BotIcon({ type }: { type: string }) {
  if (type === 'concierge') return <MessageSquare className="size-6 text-primary" />;
  if (type === 'memory') return <Cpu className="size-6 text-primary" />;
  if (type === 'event_busy') return <Calendar className="size-6 text-primary" />;
  if (type === 'account_balance') return <Landmark className="size-6 text-primary" />;
  return <BotIconLucide className="size-6 text-primary" />;
}

function PersonaTileAvatar({ bot }: { bot: Bot }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const text = `${bot.name || ''} ${bot.persona || ''} ${bot.description || ''}`.toLowerCase();
  const isFemale = /\bfemale\b|\bwomen\b|\bgirl\b/.test(text);
  const isMale = /\bmale\b|\bman\b|\bboy\b/.test(text);
  const isFinancial = /collection|bank|finance|account|payment/.test(text);
  
  const Icon = isFinancial ? Landmark : bot.role?.toLowerCase().includes('concierge') ? MessageSquare : BotIconLucide;
  const badge = isFemale ? 'F' : isMale ? 'M' : 'AI';

  return (
    <div className="relative shrink-0">
      <div className={cn(
        "size-14 rounded-2xl flex items-center justify-center transition-all duration-300",
        isDark 
          ? "bg-primary/5 border border-primary/20 text-primary shadow-[0_0_15px_rgba(56,189,248,0.05)]" 
          : "bg-primary/10 border border-primary/30 text-primary shadow-sm"
      )}>
        <Icon className="size-7" />
      </div>
      <div className="absolute -bottom-1 -right-1 flex items-center justify-center size-6 rounded-xl border bg-surface-highest shadow-md">
        <span className="text-[10px] font-black uppercase text-on-surface">{badge}</span>
      </div>
    </div>
  );
}

function BotIconFallback({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <div className="size-1 bg-primary rounded-full animate-pulse" />
      <div className="size-1 bg-primary rounded-full animate-pulse [animation-delay:0.2s]" />
      <div className="size-1 bg-primary rounded-full animate-pulse [animation-delay:0.4s]" />
    </div>
  );
}
