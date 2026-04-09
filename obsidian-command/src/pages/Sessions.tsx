import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { cn } from '../lib/utils';
import {
  Search, Filter, Download, MoreVertical,
  Play, MessageSquare, Clock, Calendar,
  ChevronRight, Smile, BarChart2, Trash2,
  Loader2, Zap, Terminal,
  PlusCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { api, SessionRecord } from '../lib/api';

export default function Sessions() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [hasPersonas, setHasPersonas] = useState<boolean>(false);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const handleDelete = async (id: string) => {
    setDeleteLoadingId(id);
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {
      // keep item in list on error
    } finally {
      setDeleteLoadingId(null);
      setDeletingId(null);
    }
  };

  React.useEffect(() => {
    async function loadData() {
      try {
        const [sessionsResults, botsResults, usersResults] = await Promise.allSettled([
          api.getSessions(100),
          api.getBots(),
          api.listUsers()
        ]);

        if (sessionsResults.status === 'fulfilled') {
          setSessions(sessionsResults.value);
        }

        if (botsResults.status === 'fulfilled') {
          setHasPersonas(botsResults.value && botsResults.value.length > 0);
        }

        if (usersResults.status === 'fulfilled') {
          const mapping: Record<string, string> = {};
          usersResults.value.forEach((u: any) => {
            mapping[u.id] = u.username;
          });
          setUserMap(mapping);
        }
      } catch (err) {
        // console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    const id = (s?.id || '').toLowerCase();
    const botName = (s?.bot_name || '').toLowerCase();
    const userId = (s?.user_id || '').toLowerCase();
    const userName = (userMap[s.user_id] || '').toLowerCase();
    return id.includes(q) || botName.includes(q) || userId.includes(q) || userName.includes(q);
  });

  const handleExport = () => {
    const data = JSON.stringify(filteredSessions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <div className="flex-1 flex flex-col ">
      <Header
        title="Sessions"
        subtitle="Conversation History & Analytics"
        actions={
          <div className="w-full flex flex-col md:flex-row gap-4 justify-between items-center">

            {sessions?.length > 0 && (
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
                <input
                  type="text"
                  placeholder="Search by ID, Bot, User"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-low ghost-border text-sm focus:outline-none focus:border-primary/50 transition-all"
                />
              </div>
            )}

            <div className="flex gap-3">
              {filteredSessions?.length > 0 && (
                <div className="flex gap-2 w-full md:w-auto">
                  {/* <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-surface-low ghost-border text-xs font-bold hover:bg-surface-high transition-all">
              <Filter className="size-4" />
              Filters
            </button> */}
                  <select className="flex-1 md:flex-none px-4 py-3 rounded-2xl bg-surface-low ghost-border text-xs font-bold focus:outline-none">
                    <option>Last 7 Days</option>
                    <option>Last 30 Days</option>
                    <option>All Time</option>
                  </select>
                </div>
              )}

              {filteredSessions?.length > 0 && (
                <>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-low ghost-border text-xs font-bold hover:bg-surface-high transition-all">
                    <Download className="size-4" />
                    Export All
                  </button>

                </>
              )}
              {sessions?.length > 0 && (
                <>
                  <button
                    onClick={() => navigate(hasPersonas ? '/sessions/live' : '/personas/create')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl ember-gradient text-on-primary-fixed text-xs font-bold shadow-lg active:scale-95 transition-all">
                    <Play className="size-4" />
                    {hasPersonas ? 'Create Session' : 'Create Bot First'}
                  </button>
                </>
              )}
            </div>

          </div>
        }
      />

      <div className="p-8 flex flex-col gap-6">
        {/* Filters & Search */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-outline text-xs font-bold uppercase tracking-widest">Accessing Neural Logs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4" style={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
            {filteredSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/sessions/${session.id}`)}
                className="group bg-surface-low p-5 rounded-2xl ghost-border flex flex-col md:flex-row items-center gap-6 cursor-pointer hover:border-primary/40 hover:bg-surface-high transition-all"
              >
                {/* ID & Bot */}
                <div className="flex items-center gap-4 w-full md:w-64">
                  <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-headline font-bold">
                    {(session.bot_name || 'S')[0]}
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-primary text-sm">{session.id.slice(0, 12)}</h4>
                    <p className="text-outline text-xs">{session.bot_name || 'External System'}</p>
                    {session.user_id && (
                      <p className="text-[9px] text-on-surface-variant/60 font-mono mt-0.5">
                        User: {userMap[session.user_id] || session.user_id}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status & Intent */}
                <div className="flex flex-col gap-1 w-full md:w-40">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full w-fit",
                    !session.ended_at ? "bg-emerald-500/10 text-emerald-500" : "bg-outline/10 text-outline"
                  )}>
                    {!session.ended_at ? 'Active' : 'Ended'}
                  </span>
                  <p className="text-sm font-medium">{session.metadata?.intent || 'Voice Session'}</p>
                  {(session.metadata?.recording_url || session.metadata?.recording_path) && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full w-fit bg-primary/10 text-primary">
                      Recording
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-8 flex-1">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-outline">
                      <Clock className="size-3" />
                      <span className="text-[10px] font-bold uppercase">Duration</span>
                    </div>
                    <p className="text-xs font-bold">{session.ended_at ? `${Math.round(session.ended_at - session.started_at)}s` : '--'}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-outline">
                      <MessageSquare className="size-3" />
                      <span className="text-[10px] font-bold uppercase">Turns</span>
                    </div>
                    <p className="text-xs font-bold">{session.turn_count}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-outline">
                      <Smile className="size-3" />
                      <span className="text-[10px] font-bold uppercase">Sentiment</span>
                    </div>
                    {session.metadata?.sentiment_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-highest rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${Math.round((session.metadata.sentiment_score as number) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold">{Math.round((session.metadata.sentiment_score as number) * 100)}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-outline">—</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-outline">
                      <Zap className="size-3" />
                      <span className="text-[10px] font-bold uppercase">Tokens</span>
                    </div>
                    <p className="text-xs font-bold">{session.metadata?.tokens?.total?.toLocaleString() || '—'}</p>
                  </div>
                  {session.metadata?.tool_performance?.success_rate != null && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-outline">
                        <Terminal className="size-3" />
                        <span className="text-[10px] font-bold uppercase">Precision</span>
                      </div>
                      <p className={cn(
                        "text-xs font-bold",
                        session.metadata.tool_performance.success_rate < 90 ? "text-amber-500" : "text-emerald-500"
                      )}>
                        {session.metadata.tool_performance.success_rate}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Time & Action */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <p className="text-xs font-bold">{new Date(session.started_at * 1000).toLocaleTimeString()}</p>
                    <p className="text-[10px] text-outline">{new Date(session.started_at * 1000).toLocaleDateString()}</p>
                  </div>
                  {deletingId === session.id ? (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-xs font-bold text-red-400">Delete?</span>
                      <button onClick={() => setDeletingId(null)} className="px-2 py-1 rounded text-xs font-bold text-on-surface-variant hover:bg-surface-highest transition-all">Cancel</button>
                      <button
                        onClick={() => handleDelete(session.id)}
                        disabled={deleteLoadingId === session.id}
                        className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        {deleteLoadingId === session.id ? <Loader2 className="size-3 animate-spin" /> : null}Delete
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingId(session.id); }}
                        className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete session"
                      >
                        <Trash2 className="size-4" />
                      </button>
                      <div className="p-2 rounded-xl bg-surface-highest text-outline group-hover:text-primary transition-colors">
                        <ChevronRight className="size-5" />
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
            {/* Truly empty — no sessions at all */}
            {/* {sessions.length === 0 && !loading && (
              <div className="flex justify-center">
                <Link
                  to="/sessions/live"
                  className="rounded-3xl border-2 border-dashed border-outline-variant/20 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-4 p-12 group"
                >
                  <div className="size-16 rounded-full bg-surface-high flex items-center justify-center text-outline group-hover:text-primary group-hover:scale-110 transition-all">
                    <PlusCircle className="size-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-on-surface">Create New Session</p>
                    <p className="text-xs text-outline mt-1">Start a new conversation</p>
                  </div>
                </Link>
              </div>
            )} */}

            {!loading && filteredSessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-6">
                {searchQuery ? (
                  <Search className="size-10 opacity-30" />
                ) : (
                  <div className="size-20 rounded-3xl bg-surface-high flex items-center justify-center text-outline">
                    <PlusCircle className="size-10" />
                  </div>
                )}
                <div className="text-center">
                  {!searchQuery && (
                    <p className="font-bold text-on-surface text-lg">
                      {hasPersonas ? 'No Sessions yet' : 'No Bots Found'}
                    </p>
                  )}
                  <p className="text-sm text-outline mt-1 max-w-xs mx-auto">
                    {searchQuery ? (
                      <>
                        <p className="font-bold text-sm">No sessions match &ldquo;{searchQuery}&rdquo;</p>
                        <p className="text-xs mt-1 opacity-60">Try searching by another ID, Bot </p>
                      </>
                    ) : (
                      hasPersonas
                        ? 'Create your first conversational logic flow.'
                        : 'Please create a bot persona first to begin a session.'
                    )}
                  </p>
                </div>

                {!searchQuery && (
                  <Link
                    to={hasPersonas ? "/sessions/live" : "/personas/create"}
                    className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold text-sm shadow-lg"
                  >
                    {hasPersonas ? 'Create Your First Session' : 'Create Your First Bot'}
                  </Link>
                )}
              </div>
            )}


          </div>
        )}
      </div>
    </div>
  );
}
