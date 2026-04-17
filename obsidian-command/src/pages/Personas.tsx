import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { PERSONAS } from '../constants';
import { cn } from '../lib/utils';
import { api, Bot } from '../lib/api';
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
} from 'lucide-react';

export default function Personas() {
  const [personas, setPersonas] = React.useState<Bot[]>([]);
  const [botStats, setBotStats] = React.useState<Record<string, { sessions: number; completion: number; dropoff: number; avgDuration: number }>>({});
  const [botStatsLoading, setBotStatsLoading] = React.useState(true);
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
    async function loadBots() {
      try {
        const [data, sessions] = await Promise.all([
          api.getBots(),
          // Higher limit so per-bot stats are meaningful on the listing page.
          api.getSessions(1000),
        ]);
        setPersonas(data);

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
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setBotStatsLoading(false);
      }
    }
    loadBots();
  }, []);

  return (
    <div className="flex-1 flex flex-col ">
      <Header
        title="Bot Factory"
        subtitle="Bot Personas"
        actions={

          <div className="w-full flex justify-between items-center">
            {personas?.length > 0 && (
              <>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
                  <input
                    type="text"
                    placeholder="Search by bot..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-low ghost-border text-sm focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <Link
                  to="/personas/create"
                  className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <PlusCircle className="size-5" />
                  Create Bot
                </Link>
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
              <Link to="/personas/create" className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold text-sm shadow-lg">
                Create Your First Bot
              </Link>
            )}
          </div>
        )}





        {!botStatsLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPersonas.map((persona, i) => (
              <div
                key={persona.id}
                className="bg-surface-lowest rounded-4xl p-6 group relative overflow-hidden transition-all border border-outline-variant/10 hover:border-primary/30 shadow-sm hover:shadow-2xl flex flex-col gap-6"
              >
                {/* Header Section */}
                <div className="flex justify-between items-start border-b border-outline-variant/5 pb-5">
                  <div className="flex items-center gap-4">
                    <PersonaTileAvatar bot={persona} />
                    <div className="min-w-0">
                      <h3 className="text-lg font-headline font-extrabold text-on-surface wrap-break-word line-clamp-2 group-hover:text-primary transition-colors">
                        {persona.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* Language moved to metrics grid */}
                        {persona.is_active && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest">Active</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-low border border-outline-variant/10">
                          <Clock className="size-2.5 text-outline" />
                          <span className="text-[7px] font-bold text-outline uppercase tracking-widest">
                            {new Date(persona.created_at * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {new Date(persona.created_at * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* <div className="flex gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/personas/create?clone=${persona.id}`}
                      className="p-2 rounded-lg bg-surface-low hover:bg-primary/10 text-outline hover:text-primary transition-all border border-outline-variant/10"
                      title="Duplicate Bot"
                    >
                      <Copy className="size-3.5" />
                    </Link>
                    <button
                      onClick={() => setDeletingId(persona.id)}
                      className="p-2 rounded-lg bg-surface-low hover:bg-rose-500/10 text-outline hover:text-rose-500 transition-all border border-outline-variant/10"
                      title="Purge Bot"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div> */}
                </div>

                {/* Body Content */}
                <div className="space-y-4">
                  <div>
                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">
                      {persona.role || 'Neural Assistant'}
                    </p>
                    {/* <p className="text-[11px] text-outline mt-2 leading-relaxed line-clamp-2 font-medium">
                      {persona.description || 'No system descriptor provided for this neural identity.'}
                    </p> */}
                  </div>

                  <div className="p-4 rounded-2xl bg-surface-low/50 border border-outline-variant/5 group-hover:bg-surface-low transition-colors italic">
                    <p className="text-[10px] leading-relaxed text-on-surface-variant line-clamp-2">
                      “{persona.description || 'Neural persona profile initializing...'}”
                    </p>
                  </div>

                  {/* Neural Metrics */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="p-2.5 rounded-xl bg-surface-low/30 border border-outline-variant/5">
                      <p className="text-[7px] font-bold text-outline uppercase mb-1 flex items-center gap-1">
                        <Languages className="size-2.5 text-primary/60" /> Language
                      </p>
                      <p className="text-[10px] font-black text-on-surface uppercase tracking-tighter truncate">
                        {(persona.default_language || (persona as any).language || 'en')}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface-low/30 border border-outline-variant/5">
                      <p className="text-[7px] font-bold text-outline uppercase mb-1.5 flex items-center gap-1">
                        <Cpu className="size-2.5 text-primary/60" /> Logic
                      </p>
                      <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-1000"
                          style={{ width: `${60 + (i * 7) % 35}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-surface-low/30 border border-outline-variant/5">
                      <p className="text-[7px] font-bold text-outline uppercase mb-1.5 flex items-center gap-1">
                        <Smile className="size-2.5 text-emerald-500/60" /> Empathy
                      </p>
                      <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-1000"
                          style={{ width: `${40 + (i * 13) % 55}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-auto pt-4 flex items-center gap-3">
                  {deletingId === persona.id ? (
                    <div className="flex-1 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Confirm Purge?</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-on-surface hover:bg-surface-highest transition-all uppercase"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(persona.id)}
                          disabled={deleteLoadingId === persona.id}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[9px] font-bold uppercase flex items-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                        >
                          {deleteLoadingId === persona.id ? <Loader2 className="size-3 animate-spin" /> : null}
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        to={`/personas/${persona.id}/config`}
                        className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface font-bold text-xs hover:bg-surface-highest transition-all border border-outline-variant/10 text-center"
                      >
                        Configure
                      </Link>
                      <Link
                        to={`/personas/create?clone=${persona.id}`}
                        className="px-3 py-2.5 rounded-xl bg-surface-high text-on-surface hover:bg-primary/10 hover:text-primary transition-all border border-outline-variant/10"
                        title="Duplicate Bot"
                      >
                        <Copy className="size-4" />
                      </Link>
                      <button
                        onClick={() => setDeletingId(persona.id)}
                        className="px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                        title="Delete Bot"
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
    </div >
  );
}

function BotIcon({ type }: { type: string }) {
  if (type === 'concierge') return <MessageSquare className="size-8" />;
  if (type === 'memory') return <Cpu className="size-8" />;
  if (type === 'event_busy') return <Calendar className="size-8" />;
  if (type === 'account_balance') return <Landmark className="size-8" />;
  return <BotIconFallback className="size-8" />;
}

function PersonaTileAvatar({ bot }: { bot: Bot }) {
  const text = `${bot.name || ''} ${bot.persona || ''} ${bot.description || ''}`.toLowerCase();
  const isFemale = /\bfemale\b|\bwomen\b|\bgirl\b/.test(text);
  const isMale = /\bmale\b|\bman\b|\bboy\b/.test(text);
  const style: 'soft' | 'firm' | 'focus' =
    /focus|focused/.test(text) ? 'focus' : /firm|direct|hard|collections/.test(text) ? 'firm' : 'soft';

  const AccentIcon = style === 'firm' ? Angry : style === 'focus' ? Focus : Smile;
  const accent = style === 'firm' ? 'from-red-500/20 to-amber-500/10' : style === 'focus' ? 'from-sky-500/20 to-indigo-500/10' : 'from-emerald-500/20 to-primary/10';
  const badge = isFemale ? 'F' : isMale ? 'M' : 'AI';

  return (
    <div className="relative">
      <div className={cn(
        "size-12 shrink-0 rounded-xl flex items-center justify-center border border-outline-variant/20 shadow-lg group-hover:scale-110 transition-transform",
        "bg-gradient-to-br",
        accent,
        bot.color === 'secondary' ? "text-secondary" : "text-primary"
      )}>
        <UserRound className="size-6" />
      </div>
      <div className="absolute -bottom-1 -right-1 flex items-center gap-1 rounded-full border border-outline-variant/20 bg-surface-highest px-1.5 py-0.5 shadow-lg">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface">{badge}</span>
        <AccentIcon className="size-3 text-primary" />
      </div>
    </div>
  );
}

function BotIconFallback({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="size-2 bg-current rounded-full animate-pulse mr-0.5" />
      <div className="size-2 bg-current rounded-full animate-pulse delay-75 mr-0.5" />
      <div className="size-2 bg-current rounded-full animate-pulse delay-150" />
    </div>
  );
}
