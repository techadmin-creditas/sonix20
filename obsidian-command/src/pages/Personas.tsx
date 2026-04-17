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
} from 'lucide-react';

export default function Personas() {
  const [personas, setPersonas] = React.useState<Bot[]>([]);
  const [botStats, setBotStats] = React.useState<Record<string, { sessions: number; completion: number; dropoff: number; avgDuration: number }>>({});
  const [botStatsLoading, setBotStatsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = React.useState<string | null>(null);
  const [copyLoadingId, setCopyLoadingId] = React.useState<string | null>(null);
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

  const handleCopy = async (persona: Bot) => {
    setCopyLoadingId(persona.id);
    try {
      const copied = await api.createBot({
        name: `${persona.name} (Copy)`,
        description: persona.description,
        persona: persona.persona,
        role: persona.role,
        default_language: persona.default_language,
        is_active: false,
        tools_enabled: persona.tools_enabled,
        system_prompt: persona.system_prompt,
        llm_model: persona.llm_model,
        llm_provider: persona.llm_provider,
        voice_id: persona.voice_id,
      });
      setPersonas(prev => [copied, ...prev]);
    } catch {
      // silently fail
    } finally {
      setCopyLoadingId(null);
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
          <>
            <div className=" grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {/* {filteredPersonas.length === 0 && !loading && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-outline">
                  <Search className="size-10 mb-3 opacity-30" />
                  <p className="font-bold text-sm">No agents match &ldquo;{searchQuery}&rdquo;</p>
                </div>
              )} */}
              {filteredPersonas.map((persona) => (
                <div key={persona.id} className="glass-panel rounded-2xl p-5 flex flex-col gap-4 group hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start">
                    <PersonaTileAvatar bot={persona} />
                    <div className="flex flex-col items-end">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                        persona.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-highest text-outline"
                      )}>
                        {persona.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {/* <div className="flex items-center gap-1 mt-2 text-primary">
                        <Star className="size-3 fill-current" />
                        <span className="text-xs font-bold">4.8</span>
                      </div> */}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-headline font-extrabold text-on-surface">{persona.name}</h3>
                    <p className="text-primary text-xs font-bold uppercase tracking-widest mt-1">{persona.role}</p>
                    <p className="text-xs text-outline mt-2 leading-relaxed line-clamp-2">{persona.description}</p>
                    <div className="flex items-center gap-1.5 mt-3 opacity-60">
                      <Calendar className="size-3 text-outline" />
                      <span className="text-[10px] font-bold text-outline uppercase tracking-tight">
                        {new Date(persona.created_at * 1000).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-4 border-y border-outline-variant/10">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Sessions</span>
                      <span className="text-base font-bold">{botStats[persona.id]?.sessions ?? 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Completion</span>
                      <span className="text-base font-bold text-emerald-500">{`${Math.round(botStats[persona.id]?.completion ?? 0)}%`}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Drop-off Rate</span>
                      <span className="text-base font-bold text-red-400">{`${Math.round(botStats[persona.id]?.dropoff ?? 0)}%`}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Avg Duration</span>
                      <span className="text-base font-bold">{Math.round(botStats[persona.id]?.avgDuration ?? 0)}s</span>
                    </div>
                  </div>

                  {/* <div className="flex flex-wrap gap-2">
                    {(persona.tools_enabled || []).map(tool => (
                      <span key={tool} className="px-2 py-1 rounded bg-surface-highest text-[10px] font-bold text-outline uppercase tracking-tighter">
                        {tool}
                      </span>
                    ))}
                  </div> */}

                  <div className="mt-auto flex gap-3">
                    {deletingId === persona.id ? (
                      <div className="flex-1 flex items-center justify-between gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                        <span className="text-xs font-bold text-red-400">Delete {persona.name}?</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-highest transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(persona.id)}
                            disabled={deleteLoadingId === persona.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1 disabled:opacity-50"
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
                        <button
                          onClick={() => handleCopy(persona)}
                          disabled={copyLoadingId === persona.id}
                          className="px-3 py-2.5 rounded-xl bg-surface-high text-on-surface hover:bg-primary/10 hover:text-primary transition-all border border-outline-variant/10 disabled:opacity-50"
                          title="Duplicate bot"
                        >
                          {copyLoadingId === persona.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeletingId(persona.id)}
                          className="px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                          title="Delete bot"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
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
        "size-12 rounded-xl flex items-center justify-center border border-outline-variant/20 shadow-lg group-hover:scale-110 transition-transform",
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
