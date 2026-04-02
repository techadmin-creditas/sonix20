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
} from 'lucide-react';

export default function Personas() {
  const [personas, setPersonas] = React.useState<Bot[]>([]);
  const [botStats, setBotStats] = React.useState<Record<string, { sessions: number; completion: number }>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = React.useState<string | null>(null);

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

        const stats = sessions.reduce<Record<string, { sessions: number; completed: number }>>((acc, s) => {
          const botId = s.bot_id;
          if (!botId) return acc;
          if (!acc[botId]) acc[botId] = { sessions: 0, completed: 0 };
          acc[botId].sessions += 1;
          if (s.ended_at !== null) acc[botId].completed += 1;
          return acc;
        }, {});

        const normalized: Record<string, { sessions: number; completion: number }> = {};
        for (const [botId, v] of Object.entries(stats)) {
          normalized[botId] = {
            sessions: v.sessions,
            completion: v.sessions > 0 ? (v.completed / v.sessions) * 100 : 0,
          };
        }
        setBotStats(normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadBots();
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header 
        title="Bot Factory" 
        subtitle="Agent Personas"
        actions={
          <Link 
            to="/personas/create"
            className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <PlusCircle className="size-5" />
            Create Agent
          </Link>
        }
      />

      <div className="p-10 flex flex-col gap-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 bg-surface-low p-1 rounded-xl ghost-border">
            <button className="p-2 rounded-lg bg-surface-highest text-primary"><LayoutGrid className="size-5" /></button>
            <button className="p-2 rounded-lg text-outline hover:text-on-surface"><List className="size-5" /></button>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-outline" />
              <input 
                type="text" 
                placeholder="Search agents..." 
                className="bg-surface-low border-none rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {loading && (
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

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {personas.map((persona) => (
              <div key={persona.id} className="glass-panel rounded-3xl p-8 flex flex-col gap-6 group hover:border-primary/30 transition-all">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "size-16 rounded-2xl flex items-center justify-center border border-outline-variant/20 shadow-lg group-hover:scale-110 transition-transform",
                    persona.color === 'secondary' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                  )}>
                    <BotIcon type={persona.icon} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                      persona.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-highest text-outline"
                    )}>
                      {persona.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex items-center gap-1 mt-2 text-primary">
                      <Star className="size-3 fill-current" />
                      <span className="text-xs font-bold">4.8</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-headline font-extrabold text-on-surface">{persona.name}</h3>
                  <p className="text-primary text-xs font-bold uppercase tracking-widest mt-1">{persona.role}</p>
                  <p className="text-sm text-outline mt-4 leading-relaxed line-clamp-2">{persona.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 py-6 border-y border-outline-variant/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Sessions</span>
                    <span className="text-lg font-bold">{botStats[persona.id]?.sessions ?? 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Completion</span>
                    <span className="text-lg font-bold">{`${Math.round(botStats[persona.id]?.completion ?? 0)}%`}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(persona.tools_enabled || []).map(tool => (
                    <span key={tool} className="px-2 py-1 rounded bg-surface-highest text-[10px] font-bold text-outline uppercase tracking-tighter">
                      {tool}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex gap-3 pt-4">
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
                        className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface font-bold text-sm hover:bg-surface-highest transition-all border border-outline-variant/10 text-center"
                      >
                        Configure
                      </Link>
                      <button className="px-4 py-3 rounded-xl bg-surface-high text-on-surface hover:bg-surface-highest transition-all border border-outline-variant/10">
                        <Settings2 className="size-5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(persona.id)}
                        className="px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                        title="Delete bot"
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            <Link 
              to="/personas/create"
              className="rounded-3xl border-2 border-dashed border-outline-variant/20 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-4 p-12 group"
            >
              <div className="size-16 rounded-full bg-surface-high flex items-center justify-center text-outline group-hover:text-primary group-hover:scale-110 transition-all">
                <PlusCircle className="size-8" />
              </div>
              <div className="text-center">
                <p className="font-bold text-on-surface">Add New Persona</p>
                <p className="text-xs text-outline mt-1">Define capabilities and tone</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function BotIcon({ type }: { type: string }) {
  if (type === 'concierge') return <MessageSquare className="size-8" />;
  if (type === 'memory') return <Cpu className="size-8" />;
  if (type === 'event_busy') return <Calendar className="size-8" />;
  if (type === 'account_balance') return <Landmark className="size-8" />;
  return <BotIconFallback className="size-8" />;
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
