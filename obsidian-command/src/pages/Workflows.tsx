import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Sparkles,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { LogoLoader } from '../components/LogoLoader';

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

  // AI Magic states
  const [showMagicModal, setShowMagicModal] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicStage, setMagicStage] = useState<'idle' | 'strategizing' | 'architecting' | 'redirecting'>('idle');

  const navigate = useNavigate();

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

  const handleMagicGenerate = async () => {
    if (!magicPrompt.trim()) return;
    setMagicLoading(true);
    setMagicStage('strategizing');

    try {
      // Simulate strategic thinking (Pass 1)
      await new Promise(r => setTimeout(r, 1500));
      setMagicStage('architecting');

      const generated = await api.generateWorkflowFromPrompt(magicPrompt);

      // Auto-save the generated workflow
      setMagicStage('redirecting');
      const res = await api.saveWorkflow(generated);

      // Short delay for the 'success' feel
      await new Promise(r => setTimeout(r, 800));

      // Navigate to editor
      navigate(`/workflows/${res.id}/edit`);
    } catch (err) {
      alert("Magic generation failed. Please try a different prompt.");
      setMagicStage('idle');
    } finally {
      setMagicLoading(false);
      setShowMagicModal(false);
    }
  };

  const filtered = workflows.filter(wf =>
    wf.name.toLowerCase().includes(search.toLowerCase()) ||
    wf.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col ">
      <Header
        title="Workflows"
        subtitle="Conversational Logic"
        actions={
          <div className="w-full flex justify-between items-center">
            {workflows && workflows?.length > 0 && (
              <>
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-outline" />
                  <input
                    type="text"
                    placeholder="Search workflows..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-low ghost-border text-sm focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMagicModal(true)}
                    className="px-6 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:bg-primary/20 active:scale-95 transition-all"
                  >
                    <Sparkles className="size-5" />
                    AI Magic
                  </button>
                  <Link
                    to="/workflows/create"
                    className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                  >
                    <PlusCircle className="size-5" />
                    Create Workflow
                  </Link>
                </div>
              </>

            )}
          </div>
        }
      />

      <div className="p-10 flex flex-col gap-10">
        {/* Loading State */}
        {loading && (
          <LogoLoader text="Architecting Neural Workflows..." />
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

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            {search ? (
              <Search className="size-10 opacity-30" />
            ) : (
              <div className="size-20 rounded-3xl bg-surface-high flex items-center justify-center text-outline">
                <GitBranch className="size-10" />
              </div>
            )}
            <div className="text-center">
              {!search && (
                <p className="font-bold text-on-surface text-lg">No Workflows yet</p>
              )}
              <p className="text-sm text-outline mt-1 max-w-xs mx-auto">
                {search ? (
                  <>
                    <p className="font-bold text-sm">No Workflows match &ldquo;{search}&rdquo;</p>
                    <p className="text-xs mt-1 opacity-60">Try searching by another Workflow </p>
                  </>
                ) : 'Create your first Workflow.'}
              </p>
            </div>
            {!search && (
              <Link to="/workflows/create" className="px-6 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold text-sm shadow-lg active:scale-95 transition-all">
                Create Your First Workflow
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
              <React.Fragment key={flow.id}>
                <WorkflowCard
                  flow={flow}
                  view={view}
                  isConfirming={deletingId === flow.id}
                  isDeleting={deleteLoadingId === flow.id}
                  onDeleteRequest={() => setDeletingId(flow.id)}
                  onDeleteCancel={() => setDeletingId(null)}
                  onDeleteConfirm={() => handleDelete(flow.id)}
                />
              </React.Fragment>
            ))}

            {/* Workflow cards mapped here */}
          </div>
        )}
      </div>

      {/* AI Magic Modal */}
      {showMagicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" onClick={() => !magicLoading && setShowMagicModal(false)} />
          <div className="relative z-20 w-full max-w-xl glass-panel rounded-4xl p-8 border-primary/30 shadow-[0_0_50px_rgba(251,140,0,0.2)] overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 size-64 bg-primary/20 blur-[100px] rounded-full" />

            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                  <Sparkles className="size-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">AI Workflow Architect</h2>
                  <p className="text-xs text-outline font-medium tracking-wide uppercase">Prompt to Graph</p>
                </div>
              </div>
              <button
                onClick={() => setShowMagicModal(false)}
                className="relative z-50 p-2 hover:bg-white/5 rounded-full transition-all cursor-pointer"
                disabled={magicLoading}
                aria-label="Close modal"
              >
                <X className="size-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">What should this workflow do?</label>
                <textarea
                  className="w-full h-40 bg-surface-low border border-outline-variant/10 rounded-2xl p-4 text-sm font-medium focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                  placeholder="e.g. Create a healthcare appointment reminder flow that handles rescheduling if the user is busy, and sends a confirmation link if they agree..."
                  value={magicPrompt}
                  onChange={(e) => setMagicPrompt(e.target.value)}
                  disabled={magicLoading}
                />
              </div>

              <button
                onClick={handleMagicGenerate}
                disabled={magicLoading || !magicPrompt.trim()}
                className="w-full py-4 rounded-2xl ember-gradient text-on-primary-fixed font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                {magicLoading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="animate-pulse">
                      {magicStage === 'strategizing' && 'Analyzing Blueprint...'}
                      {magicStage === 'architecting' && 'Building Advanced Graph...'}
                      {magicStage === 'redirecting' && 'Magic Ready! Redirecting...'}
                    </span>
                  </div>
                ) : (
                  <>
                    <Sparkles className="size-5" />
                    <span>Generate Magic Workflow</span>
                  </>
                )}
              </button>

              {!magicLoading && (
                <p className="text-[10px] text-center text-outline font-medium uppercase tracking-tighter">
                  Pro tip: Be specific about edge cases like "if user says no"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface WorkflowCardProps {
  key?: React.Key;
  flow: any;
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

  const isActive = flow.is_active;
  const isPersistent = (flow.nodes ?? []).some((n: any) => (n.data?.retry_limit ?? 0) > 0);

  const updatedAt = flow.updated_at
    ? new Date(flow.updated_at * 1000).toLocaleDateString('en-IN', { dateStyle: 'medium' })
    : 'New Blueprint';

  if (view === 'list') {
    return (
      <div className="bg-surface-lowest rounded-2xl p-6 flex items-center justify-between gap-6 group hover:border-primary/30 transition-all border border-outline-variant/10 shadow-sm">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-outline-variant/20 shrink-0 shadow-inner group-hover:scale-110 transition-transform">
            <GitBranch className="size-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">{flow.name}</h3>
            <p className="text-[10px] text-outline mt-0.5 truncate uppercase tracking-widest font-bold">
              {nodeCount} Nodes · {edgeCount} Edges
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex flex-wrap gap-2 justify-end">
            {isActive && (
              <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Active
              </span>
            )}
            {isPersistent && (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                <RotateCcw className="size-2.5" /> Persistent
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              to={`/workflows/${flow.id}/edit`}
              className="px-4 py-2.5 rounded-xl bg-surface-high text-on-surface font-bold text-xs hover:bg-surface-highest transition-all border border-outline-variant/10"
            >
              Edit
            </Link>
            <TestButton flow={flow} />
            <button onClick={onDeleteRequest} className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-outline-variant/10">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-lowest rounded-4xl p-6 group relative overflow-hidden transition-all border border-outline-variant/10 hover:border-primary/30 shadow-sm hover:shadow-2xl flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex justify-between items-start border-b border-outline-variant/5 pb-5">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-linear-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center text-primary shadow-lg border border-outline-variant/10 group-hover:scale-110 transition-transform">
            <GitBranch className="size-8" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-headline font-extrabold text-on-surface wrap-break-word line-clamp-2 group-hover:text-primary transition-colors">
              {flow.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-outline flex items-center gap-1.5">
                <Clock className="size-3" /> {updatedAt}
              </span>
              {isActive && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest">Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {isPersistent && (
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm" title="Goal Persistence Enabled">
            <RotateCcw className="size-4" />
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="space-y-4">
        <div>
          <p className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">
            Logic Architecture
          </p>
          <p className="text-[11px] text-outline mt-2 leading-relaxed line-clamp-2 font-medium">
            {flow.description || 'No blueprint description provided for this logic sequence.'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-surface-low/50 border border-outline-variant/5 group-hover:bg-surface-low transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[8px] font-bold text-outline uppercase tracking-widest">Execution Path</span>
            <span className="text-[8px] font-bold text-primary uppercase">{nodeCount} Nodes</span>
          </div>
          <div className="flex -space-x-2">
            {visibleNodes.map((node: any) => (
              <div
                key={node.id}
                className="size-8 rounded-full bg-surface-highest border-2 border-surface-lowest flex items-center justify-center text-primary shadow-sm hover:-translate-y-1 transition-transform"
                title={node.data?.label || node.type}
              >
                <NodeTypeIcon type={node.type} className="size-3.5" />
              </div>
            ))}
            {extra > 0 && (
              <div className="size-8 rounded-full bg-surface-highest border-2 border-surface-lowest flex items-center justify-center text-[9px] font-black text-outline">
                +{extra}
              </div>
            )}
            {nodeCount === 0 && (
              <span className="text-[10px] text-outline/40 italic font-medium">Neural graph empty</span>
            )}
          </div>
        </div>

        {/* Graph Metrics */}
        {/* <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-surface-low/30 border border-outline-variant/5">
            <p className="text-[7px] font-bold text-outline uppercase mb-2 flex items-center gap-1.5">
              <Zap className="size-3 text-primary/60" /> Logic Depth
            </p>
            <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${Math.min(100, (nodeCount / 12) * 100)}%` }}
              />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-surface-low/30 border border-outline-variant/5">
            <p className="text-[7px] font-bold text-outline uppercase mb-2 flex items-center gap-1.5">
              <GitBranch className="size-3 text-indigo-500/60" /> Complexity
            </p>
            <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-1000"
                style={{ width: `${Math.min(100, (edgeCount / 15) * 100)}%` }}
              />
            </div>
          </div>
        </div> */}
      </div>

      {/* Footer Actions */}
      <div className="mt-auto flex items-center gap-3 border-t border-outline-variant/5">
        {isConfirming ? (
          <div className="flex-1 flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in zoom-in-95 duration-200">
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Delete Logic?</span>
            <div className="flex gap-2">
              <button
                onClick={onDeleteCancel}
                className="px-3 py-1.5 rounded-lg text-[9px] font-bold text-on-surface hover:bg-surface-highest transition-all uppercase"
              >
                No
              </button>
              <button
                onClick={onDeleteConfirm}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-[9px] font-bold uppercase flex items-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
              >
                {isDeleting ? <Loader2 className="size-3 animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        ) : (
          <>
            <Link
              to={`/workflows/${flow.id}/edit`}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface font-bold text-xs hover:bg-surface-highest transition-all border border-outline-variant/10 text-center"
            >
              Edit Flow
            </Link>
            <TestButton flow={flow} />
            <button
              onClick={onDeleteRequest}
              className="px-3 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-outline-variant/10"
              title="Delete Blueprint"
            >
              <Trash2 className="size-4" />
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
          "px-2 py-2 rounded-xl bg-surface-high text-on-surface hover:bg-surface-highest transition-all border border-outline-variant/10 flex items-center gap-2",
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
