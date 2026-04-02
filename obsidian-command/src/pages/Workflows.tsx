import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { api, Workflow } from '../lib/api';
import {
  PlusCircle,
  GitBranch,
  Zap,
  Settings2,
  Search,
  LayoutGrid,
  List,
  Clock,
  Play,
  Loader2,
  AlertCircle,
  MessageSquare,
  RotateCcw,
  Globe,
  Smile,
  BookOpen,
  Smartphone,
  Bot,
  Trash2,
} from 'lucide-react';
import { cn } from '../lib/utils';

// Map node types from backend to icon components
function NodeTypeIcon({ type, className }: { type: string; className?: string }) {
  const iconMap: Record<string, React.ElementType> = {
    speech: MessageSquare,
    'bot-says': MessageSquare,
    userInput: Search,
    'user-input': Search,
    logic: GitBranch,
    'smart-branch': GitBranch,
    sentiment: Smile,
    language: Globe,
    backtrack: RotateCcw,
    action: Smartphone,
    knowledge: BookOpen,
  };
  const Icon = iconMap[type] || Zap;
  return <Icon className={className} />;
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleteLoadingId(id);
    try {
      await api.deleteWorkflow(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
    } catch {
      // keep item in list on error
    } finally {
      setDeleteLoadingId(null);
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getWorkflows();
      setWorkflows(data);
    } catch (err) {
      setError('Failed to load workflows. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  const filtered = workflows.filter(wf =>
    wf.name.toLowerCase().includes(search.toLowerCase()) ||
    wf.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col ">
      <Header
        title="Workflows"
        subtitle="Conversational Logic"
      // actions={

      // }
      />

      <div className="p-10 flex flex-col gap-10">
        {/* Toolbar */}
        <div className="flex justify-between items-center">
          {/* <div className="flex items-center gap-4 bg-surface-low p-1 rounded-xl ghost-border">
            <button
              onClick={() => setView('grid')}
              className={cn("p-2 rounded-lg transition-all", view === 'grid' ? "bg-surface-highest text-primary" : "text-outline hover:text-on-surface")}
            >
              <LayoutGrid className="size-5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn("p-2 rounded-lg transition-all", view === 'list' ? "bg-surface-highest text-primary" : "text-outline hover:text-on-surface")}
            >
              <List className="size-5" />
            </button>
          </div> */}

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-outline" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-surface-low border-none rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          {filtered?.length > 0 && (
            <Link
              to="/workflows/create"
              className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <PlusCircle className="size-5" />
              Create Workflow
            </Link>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-10 text-primary animate-spin" />
              <p className="text-on-surface-variant font-medium animate-pulse">Loading Workflows...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <AlertCircle className="size-12 text-red-500 opacity-60" />
            <p className="text-red-400 font-medium">{error}</p>
            <button onClick={loadWorkflows} className="px-4 py-2 rounded-xl bg-surface-high text-sm font-bold hover:bg-surface-highest transition-all">
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="size-20 rounded-3xl bg-surface-high flex items-center justify-center text-outline">
              <GitBranch className="size-10" />
            </div>
            <div className="text-center">
              <p className="font-bold text-on-surface text-lg">No workflows yet</p>
              <p className="text-sm text-outline mt-1">
                {search ? 'No workflows match your search.' : 'Create your first conversational logic flow.'}
              </p>
            </div>
            {!search && (
              <Link to="/workflows/create" className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold text-sm shadow-lg">
                Create Your First Flow
              </Link>
            )}
          </div>
        )}

        {/* Workflow Cards */}
        {!loading && !error && filtered.length > 0 && (
          <div className={cn(
            view === 'grid'
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              : "flex flex-col gap-4"
          )}>
            {filtered.map((flow) => (
              <WorkflowCard
                key={flow.id}
                flow={flow}
                view={view}
                isConfirming={deletingId === flow.id}
                isDeleting={deleteLoadingId === flow.id}
                onDeleteRequest={() => setDeletingId(flow.id)}
                onDeleteCancel={() => setDeletingId(null)}
                onDeleteConfirm={() => handleDelete(flow.id)}
              />
            ))}

            {/* Create New Card — only show in grid view */}
            {filtered?.length === 0 && view === 'grid' && (
              <Link
                to="/workflows/create"
                className="rounded-3xl border-2 border-dashed border-outline-variant/20 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-4 p-12 group"
              >
                <div className="size-16 rounded-full bg-surface-high flex items-center justify-center text-outline group-hover:text-primary group-hover:scale-110 transition-all">
                  <PlusCircle className="size-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-on-surface">Add New Workflow</p>
                  <p className="text-xs text-outline mt-1">Design conversational paths</p>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface WorkflowCardProps {
  flow: Workflow;
  view: 'grid' | 'list';
  isConfirming: boolean;
  isDeleting: boolean;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}

function WorkflowCard({ flow, view, isConfirming, isDeleting, onDeleteRequest, onDeleteCancel, onDeleteConfirm }: WorkflowCardProps) {
  const nodeCount = flow.nodes?.length ?? 0;
  const edgeCount = flow.edges?.length ?? 0;
  const visibleNodes = (flow.nodes ?? []).slice(0, 5);
  const extra = nodeCount - 5;

  // Derive a status label from the workflow data
  const isActive = flow.is_active;
  const updatedAt = flow.updated_at
    ? new Date(flow.updated_at * 1000).toLocaleDateString()
    : flow.created_at
      ? new Date(flow.created_at * 1000).toLocaleDateString()
      : '—';

  if (view === 'list') {
    return (
      <div className="glass-panel rounded-2xl p-6 flex items-center justify-between gap-6 group hover:border-primary/30 transition-all">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-outline-variant/20 shrink-0">
            <GitBranch className="size-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-on-surface truncate">{flow.name}</h3>
            <p className="text-xs text-outline mt-0.5 truncate">{flow.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-center">
            <div className="text-sm font-bold text-on-surface">{nodeCount}</div>
            <div className="text-[10px] text-outline uppercase tracking-wider">Nodes</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-on-surface">{edgeCount}</div>
            <div className="text-[10px] text-outline uppercase tracking-wider">Edges</div>
          </div>
          <span className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
            isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-highest text-outline"
          )}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
          {isConfirming ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <span className="text-xs font-bold text-red-400">Delete?</span>
              <button onClick={onDeleteCancel} className="px-2 py-1 rounded text-xs font-bold text-on-surface-variant hover:bg-surface-highest transition-all">Cancel</button>
              <button onClick={onDeleteConfirm} disabled={isDeleting} className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1 disabled:opacity-50">
                {isDeleting ? <Loader2 className="size-3 animate-spin" /> : null}Delete
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                to={`/workflows/${flow.id}/edit`}
                className="px-4 py-2 rounded-xl bg-surface-high text-on-surface font-bold text-sm hover:bg-surface-highest transition-all border border-outline-variant/10"
              >
                Edit
              </Link>
              <TestButton flow={flow} />
              <button onClick={onDeleteRequest} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all" title="Delete workflow">
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl p-8 flex flex-col gap-6 group hover:border-primary/30 transition-all">
      <div className="flex justify-between items-start">
        <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-outline-variant/20 shadow-lg group-hover:scale-110 transition-transform">
          <GitBranch className="size-8" />
        </div>
        <div className="flex flex-col items-end">
          <span className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
            isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-highest text-outline"
          )}>
            {isActive ? 'Active' : 'Draft'}
          </span>
          <div className="flex items-center gap-1 mt-2 text-outline">
            <Clock className="size-3" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{updatedAt}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-headline font-extrabold text-on-surface">{flow.name}</h3>
        <p className="text-sm text-outline mt-2 leading-relaxed line-clamp-2">
          {flow.description || 'No description provided.'}
        </p>
      </div>

      {/* Node type pills */}
      <div className="flex flex-col gap-3 py-6 border-y border-outline-variant/10">
        <div className="flex items-center justify-between text-xs font-bold text-outline uppercase tracking-widest">
          <span>Logic Steps</span>
          <span className="text-on-surface">{nodeCount} Nodes · {edgeCount} Edges</span>
        </div>
        <div className="flex -space-x-2">
          {visibleNodes.map((node: any) => (
            <div
              key={node.id}
              className="size-8 rounded-full bg-surface-highest border-2 border-surface-low flex items-center justify-center text-primary shadow-sm"
              title={node.data?.label || node.type}
            >
              <NodeTypeIcon type={node.type} className="size-4" />
            </div>
          ))}
          {extra > 0 && (
            <div className="size-8 rounded-full bg-surface-highest border-2 border-surface-low flex items-center justify-center text-xs font-bold text-outline">
              +{extra}
            </div>
          )}
          {nodeCount === 0 && (
            <span className="text-xs text-outline italic">No nodes yet</span>
          )}
        </div>
      </div>

      <div className="mt-auto flex gap-3 pt-4">
        {isConfirming ? (
          <div className="flex-1 flex items-center justify-between gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-xs font-bold text-red-400">Delete {flow.name}?</span>
            <div className="flex gap-2">
              <button onClick={onDeleteCancel} className="px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-highest transition-all">Cancel</button>
              <button onClick={onDeleteConfirm} disabled={isDeleting} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1 disabled:opacity-50">
                {isDeleting ? <Loader2 className="size-3 animate-spin" /> : null}Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <Link
              to={`/workflows/${flow.id}/edit`}
              className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface font-bold text-sm hover:bg-surface-highest transition-all border border-outline-variant/10 text-center"
            >
              Edit Flow
            </Link>
            <TestButton flow={flow} />
            <button onClick={onDeleteRequest} className="px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all" title="Delete workflow">
              <Trash2 className="size-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Play / Test button — fires /workflows/test with the live graph
function TestButton({ flow }: { flow: Workflow }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runTest = async (e: React.MouseEvent) => {
    e.preventDefault();
    setTesting(true);
    setResult(null);
    try {
      const res = await api.testWorkflow(
        { nodes: flow.nodes, edges: flow.edges },
        'Hello, what can you do?',
        flow.nodes?.[0]?.id
      );
      const responses = res.speak_responses?.join(' | ') || 'No bot response';
      setResult(`✓ ${responses}`);
    } catch {
      setResult('✗ Test failed — backend error');
    } finally {
      setTesting(false);
      setTimeout(() => setResult(null), 4000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={runTest}
        disabled={testing || (flow.nodes?.length === 0)}
        title={flow.nodes?.length === 0 ? 'No nodes to test' : 'Run test simulation'}
        className={cn(
          "px-4 py-3 rounded-xl bg-surface-high text-on-surface hover:bg-surface-highest transition-all border border-outline-variant/10 flex items-center gap-2",
          testing && "opacity-60 cursor-not-allowed"
        )}
      >
        {testing
          ? <Loader2 className="size-5 animate-spin text-primary" />
          : <Play className="size-5" />
        }
      </button>
      {result && (
        <div className={cn(
          "absolute bottom-full right-0 mb-2 px-3 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap shadow-xl z-50 border",
          result.startsWith('✓')
            ? "bg-emerald-950 text-emerald-300 border-emerald-800/50"
            : "bg-red-950 text-red-300 border-red-800/50"
        )}>
          {result}
        </div>
      )}
    </div>
  );
}
