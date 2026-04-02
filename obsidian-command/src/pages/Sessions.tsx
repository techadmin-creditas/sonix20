import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SESSIONS } from '../constants';
import { cn } from '../lib/utils';
import { 
  Search, Filter, Download, MoreVertical, 
  Play, MessageSquare, Clock, Calendar,
  ChevronRight, Smile, BarChart2, Trash2,
  Loader2, Zap, Terminal,
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
    async function loadSessions() {
      try {
        const data = await api.getSessions(100);
        setSessions(data);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    const id = (s?.id || '').toLowerCase();
    const botName = (s?.bot_name || '').toLowerCase();
    return id.includes(q) || botName.includes(q);
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
    <div className="flex-1 flex flex-col min-h-screen">
      <Header 
        title="Sessions" 
        subtitle="Conversation History & Analytics"
        actions={
          <div className="flex gap-3">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-low ghost-border text-xs font-bold hover:bg-surface-high transition-all"
            >
              <Download className="size-4" />
              Export All
            </button>
            <button 
              onClick={() => navigate('/sessions/live')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl ember-gradient text-on-primary-fixed text-xs font-bold shadow-lg active:scale-95 transition-all"
            >
              <Play className="size-4" />
              Live Session
            </button>
          </div>
        }
      />

      <div className="p-8 flex flex-col gap-6">
        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
            <input 
              type="text"
              placeholder="Search by ID, Bot, or Intent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-low ghost-border text-sm focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-surface-low ghost-border text-xs font-bold hover:bg-surface-high transition-all">
              <Filter className="size-4" />
              Filters
            </button>
            <select className="flex-1 md:flex-none px-4 py-3 rounded-2xl bg-surface-low ghost-border text-xs font-bold focus:outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>All Time</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="size-8 text-primary animate-spin" />
            <p className="text-outline text-xs font-bold uppercase tracking-widest">Accessing Neural Logs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
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
                        User: {session.user_id}
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
          </div>
        )}
      </div>
    </div>
  );
}
