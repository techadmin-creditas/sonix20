import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  addEdge, 
  applyEdgeChanges, 
  applyNodeChanges,
  Node,
  Edge,
  Connection,
  EdgeChange,
  NodeChange,
  Handle,
  Position,
  Panel
} from 'reactflow';
import { 
  ArrowLeft, 
  PlusCircle, 
  Zap, 
  Calendar, 
  GitBranch, 
  MessageSquare, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Bell,
  Trash2,
  Settings2,
  Sparkles,
  Save,
  Phone,
  UserPlus,
  Cpu,
  Link2,
  Search,
  X,
  Smile,
  Languages,
  RotateCcw,
  Globe,
  Frown,
  Meh,
  Activity,
  BookOpen,
  Send,
  Mail,
  Smartphone,
  Loader2,
  Play
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

// --- Custom Node Components ---

const SpeechNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-primary shadow-[0_0_25px_rgba(255,183,123,0.3)]" : "border-primary/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-primary border-2 border-background" />
    <div className="flex items-center gap-3 mb-3">
      <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <MessageSquare className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Bot Says</div>
        <div className="text-sm font-bold truncate max-w-[140px]">{data.label}</div>
      </div>
    </div>
    <div className="text-[10px] text-outline line-clamp-2 italic bg-white/5 p-2 rounded-lg">
      "{data.speech || 'Hello! How can I help you today?'}"
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-background" />
  </div>
);

const UserInputNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-secondary shadow-[0_0_25px_rgba(255,182,142,0.3)]" : "border-secondary/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-secondary border-2 border-background" />
    <div className="flex items-center gap-3 mb-3">
      <div className="size-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
        <Search className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-secondary/60">User Input</div>
        <div className="text-sm font-bold truncate max-w-[140px]">{data.label}</div>
      </div>
    </div>
    <div className="flex flex-wrap gap-1">
      {(data.intents || ['Greeting', 'Help']).map((intent: string) => (
        <span key={intent} className="text-[9px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full uppercase tracking-tighter">
          {intent}
        </span>
      ))}
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-secondary border-2 border-background" />
  </div>
);

const LogicNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-tertiary shadow-[0_0_25px_rgba(224,193,169,0.3)]" : "border-tertiary/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-tertiary border-2 border-background" />
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center">
        <GitBranch className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-tertiary/60">Smart Branch</div>
        <div className="text-sm font-bold">{data.label}</div>
      </div>
    </div>
    <div className="mt-3 flex justify-between text-[9px] font-bold text-outline uppercase tracking-widest">
      <span>Yes</span>
      <span>No</span>
    </div>
    <div className="flex justify-between mt-1">
      <Handle type="source" position={Position.Bottom} id="yes" className="w-3 h-3 bg-emerald-500 border-2 border-background !left-1/4" />
      <Handle type="source" position={Position.Bottom} id="no" className="w-3 h-3 bg-red-500 border-2 border-background !left-3/4" />
    </div>
  </div>
);

const SentimentNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.3)]" : "border-emerald-500/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 border-2 border-background" />
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
        <Smile className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">Sentiment Branch</div>
        <div className="text-sm font-bold">{data.label}</div>
      </div>
    </div>
    <div className="mt-3 flex justify-between text-[8px] font-bold text-outline uppercase tracking-widest">
      <span className="text-emerald-500">Pos</span>
      <span className="text-amber-500">Neu</span>
      <span className="text-red-500">Neg</span>
    </div>
    <div className="flex justify-between mt-1">
      <Handle type="source" position={Position.Bottom} id="positive" className="w-3 h-3 bg-emerald-500 border-2 border-background !left-[15%]" />
      <Handle type="source" position={Position.Bottom} id="neutral" className="w-3 h-3 bg-amber-500 border-2 border-background !left-1/2" />
      <Handle type="source" position={Position.Bottom} id="negative" className="w-3 h-3 bg-red-500 border-2 border-background !left-[85%]" />
    </div>
  </div>
);

const LanguageNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.3)]" : "border-blue-500/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-background" />
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
        <Globe className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-blue-500/60">Language Switch</div>
        <div className="text-sm font-bold">{data.label}</div>
      </div>
    </div>
    <div className="mt-3 flex justify-between text-[8px] font-bold text-outline uppercase tracking-widest">
      <span>EN</span>
      <span>ES</span>
      <span>FR</span>
      <span>...</span>
    </div>
    <div className="flex justify-between mt-1">
      <Handle type="source" position={Position.Bottom} id="en" className="w-3 h-3 bg-blue-500 border-2 border-background !left-[10%]" />
      <Handle type="source" position={Position.Bottom} id="es" className="w-3 h-3 bg-blue-500 border-2 border-background !left-[35%]" />
      <Handle type="source" position={Position.Bottom} id="fr" className="w-3 h-3 bg-blue-500 border-2 border-background !left-[65%]" />
      <Handle type="source" position={Position.Bottom} id="other" className="w-3 h-3 bg-blue-500 border-2 border-background !left-[90%]" />
    </div>
  </div>
);

const BacktrackNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.3)]" : "border-purple-500/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-background" />
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
        <RotateCcw className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-purple-500/60">Backtrack</div>
        <div className="text-sm font-bold">{data.label}</div>
      </div>
    </div>
    <div className="text-[10px] text-outline italic bg-white/5 p-2 rounded-lg mt-2 text-center">
      Returns to previous state
    </div>
  </div>
);

const ActionNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]" : "border-amber-500/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-background" />
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
        {data.actionType === 'sms' ? <Smartphone className="size-5" /> : <Mail className="size-5" />}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60">System Action</div>
        <div className="text-sm font-bold">{data.label}</div>
      </div>
    </div>
    <div className="mt-2 text-[10px] font-bold text-outline uppercase tracking-widest flex items-center gap-2">
      <Activity className="size-3" />
      {data.actionType === 'sms' ? 'Send SMS' : 'Send Email'}
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500 border-2 border-background" />
  </div>
);

const KnowledgeNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all",
    selected ? "border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.3)]" : "border-indigo-500/20"
  )}>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500 border-2 border-background" />
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
        <BookOpen className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500/60">Knowledge Base</div>
        <div className="text-sm font-bold">{data.label}</div>
      </div>
    </div>
    <div className="mt-2 text-[10px] text-outline line-clamp-2 italic bg-white/5 p-2 rounded-lg">
      "RAG: Searching internal docs for '{data.query || 'unrelated topics'}'"
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-background" />
  </div>
);

const nodeTypes = {
  speech: SpeechNode,
  userInput: UserInputNode,
  logic: LogicNode,
  sentiment: SentimentNode,
  language: LanguageNode,
  backtrack: BacktrackNode,
  action: ActionNode,
  knowledge: KnowledgeNode,
};

// --- Main Component ---

export default function WorkflowEditor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowId, setWorkflowId] = useState<string | undefined>(id);

  // Simulator state
  const [simOpen, setSimOpen] = useState(false);
  const [simInput, setSimInput] = useState('');
  const [simChat, setSimChat] = useState<{role: string, text: string}[]>([]);
  const [simNode, setSimNode] = useState<string | undefined>();
  const [simRunning, setSimRunning] = useState(false);

  const [nodes, setNodes] = useState<Node[]>([
    {
      id: '1',
      type: 'speech',
      position: { x: 250, y: 50 },
      data: { label: 'Greeting', speech: 'Hello! How can I help you today?' },
    }
  ]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Load existing workflow from API
  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const wf = await api.getWorkflow(id!);
        setWorkflowName(wf.name);
        setWorkflowDescription(wf.description || '');
        setWorkflowId(wf.id);
        if (wf.nodes?.length > 0) {
          // Sanitize nodes: ensure every node has a valid position
          // (nodes saved from test scripts or the backend may lack position)
          const sanitized = wf.nodes.map((n: any, i: number) => ({
            ...n,
            position: (n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number')
              ? n.position
              : { x: 100 + (i % 3) * 280, y: 80 + Math.floor(i / 3) * 200 },
            data: n.data ?? {},
          }));
          setNodes(sanitized);
        }
        if (wf.edges?.length > 0) setEdges(wf.edges);
      } catch {
        // If not found, keep defaults — user is creating fresh
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNode = (type: string) => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newNode: Node = {
      id: newId,
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { label: `New ${type}` },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const updateNodeLabel = (label: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return { ...node, data: { ...node.data, label } };
        }
        return node;
      })
    );
    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label } });
  };

  const removeNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
    setEdges((eds) => eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await api.saveWorkflow({
        id: workflowId,
        name: workflowName,
        description: workflowDescription,
        nodes,
        edges,
      });
      setWorkflowId(res.id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Update URL to edit route if it was a create
      if (!id) {
        navigate(`/workflows/${res.id}/edit`, { replace: true });
      }
    } catch {
      alert('Failed to save workflow. Is the backend running?');
    } finally {
      setSaving(false);
    }
  };

  const runSimulatorTurn = async (overrideText?: string, overrideNode?: string) => {
    const isInitial = overrideText === "";
    if (!isInitial && !simInput.trim()) return;
    
    const text = isInitial ? "" : simInput;
    const currentNode = overrideNode !== undefined ? overrideNode : simNode;

    if (!isInitial) {
      setSimInput('');
      setSimChat(prev => [...prev, { role: 'user', text }]);
    }
    setSimRunning(true);
    try {
      const res = await api.testWorkflow({ nodes, edges }, text, currentNode);
      (res.speak_responses || []).forEach((r: string) => {
        setSimChat(prev => [...prev, { role: 'bot', text: r }]);
      });
      if (res.is_disconnected) {
        setSimChat(prev => [...prev, { role: 'system', text: '— CALL DISCONNECTED —' }]);
        setSimNode(undefined);
      } else {
        setSimNode(res.next_node_id);
      }
      if (res.yield_to_llm) {
        setSimChat(prev => [...prev, { role: 'system', text: '— YIELDED TO FREEFORM LLM —' }]);
      }
    } catch {
      setSimChat(prev => [...prev, { role: 'system', text: 'Simulation error — check backend.' }]);
    } finally {
      setSimRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="size-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-background text-on-surface overflow-hidden">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-10 glass-panel shrink-0 z-50 border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/workflows')}
            className="size-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <input
              type="text"
              value={workflowName}
              onChange={e => setWorkflowName(e.target.value)}
              className="font-headline font-extrabold text-2xl tracking-tight text-on-surface bg-transparent border-b border-transparent focus:border-primary/50 focus:outline-none w-64 pb-0.5"
              placeholder="Workflow Name"
            />
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest mt-0.5">
              {id ? 'Editing existing flow' : 'New conversational flow'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { 
              setSimChat([]); 
              const firstNodeId = nodes[0]?.id;
              setSimNode(firstNodeId); 
              setSimOpen(true); 
              setTimeout(() => runSimulatorTurn("", firstNodeId), 100);
            }}
            className="px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/20 transition-all"
          >
            <Play className="size-4" />
            Test Flow
          </button>
          <button 
            onClick={() => navigate('/workflows')}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:text-on-surface ghost-border transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2",
              saveSuccess
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "ember-gradient text-on-primary-fixed shadow-primary/10 hover:shadow-primary/20",
              saving && "opacity-60 cursor-not-allowed"
            )}
          >
            {saving 
              ? <Loader2 className="size-4 animate-spin" />
              : <Save className="size-4" />
            }
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Flow'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Area */}
        <div className="flex-1 relative bg-surface-lowest/30">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#343538" gap={20} />
            <Controls />
            <MiniMap 
              nodeColor={(n) => {
                if (n.type === 'trigger') return '#ffb77b';
                if (n.type === 'condition') return '#e0c1a9';
                return '#343538';
              }}
              maskColor="rgba(5, 6, 8, 0.7)"
              className="!bg-surface-low rounded-xl border border-outline-variant/10"
            />
            
            <Panel position="top-right" className="flex flex-col gap-2">
              <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3 min-w-[180px]">
                <div className="text-[10px] font-bold text-outline uppercase tracking-widest">Conversation Blocks</div>
                <button onClick={() => addNode('speech')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-primary/10 text-primary transition-all">
                  <MessageSquare className="size-4" /> Bot Says
                </button>
                <button onClick={() => addNode('userInput')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-secondary/10 text-secondary transition-all">
                  <Search className="size-4" /> User Input
                </button>
                <button onClick={() => addNode('logic')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-tertiary/10 text-tertiary transition-all">
                  <GitBranch className="size-4" /> Smart Branch
                </button>
                <button onClick={() => addNode('sentiment')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-500 transition-all">
                  <Smile className="size-4" /> Sentiment
                </button>
                <button onClick={() => addNode('language')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-all">
                  <Globe className="size-4" /> Language
                </button>
                <button onClick={() => addNode('backtrack')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-purple-500/10 text-purple-500 transition-all">
                  <RotateCcw className="size-4" /> Backtrack
                </button>
                <button onClick={() => addNode('action')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-amber-500/10 text-amber-500 transition-all">
                  <Smartphone className="size-4" /> Action
                </button>
                <button onClick={() => addNode('knowledge')} className="flex items-center gap-2 text-xs font-bold p-2 rounded-lg hover:bg-indigo-500/10 text-indigo-500 transition-all">
                  <BookOpen className="size-4" /> Knowledge
                </button>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        <div className={cn(
          "w-96 border-l border-outline-variant/10 bg-surface-low p-8 overflow-y-auto transition-all transform shrink-0",
          !selectedNode && "translate-x-full opacity-0 pointer-events-none"
        )}>
          {selectedNode && (
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings2 className="size-5 text-primary" />
                  <h3 className="font-headline font-bold text-lg">Block Settings</h3>
                </div>
                <button 
                  onClick={removeNode}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-all"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Block Name</label>
                  <input 
                    className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30" 
                    type="text" 
                    value={selectedNode.data.label}
                    onChange={(e) => updateNodeLabel(e.target.value)}
                  />
                </div>

                {selectedNode.type === 'speech' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Bot's Response</label>
                    <textarea 
                      className="w-full h-32 bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface resize-none focus:ring-1 focus:ring-primary/30" 
                      placeholder="What should the bot say?"
                      value={selectedNode.data.speech || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, speech: val } } : n));
                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, speech: val } });
                      }}
                    />
                  </div>
                )}

                {selectedNode.type === 'userInput' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Expected Intents</label>
                    <div className="flex flex-wrap gap-2 p-4 bg-surface-container-highest rounded-2xl">
                      {(selectedNode.data.intents || []).map((intent: string, idx: number) => (
                        <span key={`${intent}-${idx}`} className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-bold flex items-center gap-2">
                          {intent}
                          <button 
                            onClick={() => {
                              const newIntents = selectedNode.data.intents.filter((_: any, i: number) => i !== idx);
                              setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, intents: newIntents } } : n));
                              setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, intents: newIntents } });
                            }}
                            className="hover:text-red-500"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                      <button 
                        onClick={() => {
                          const intent = prompt('Enter new intent:');
                          if (intent) {
                            const newIntents = [...(selectedNode.data.intents || []), intent];
                            setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, intents: newIntents } } : n));
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, intents: newIntents } });
                          }
                        }}
                        className="text-xs font-bold text-outline hover:text-secondary"
                      >
                        + Add Intent
                      </button>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'sentiment' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        This block analyzes the user's tone and routes the conversation based on their mood.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Sensitivity</label>
                      <select className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30">
                        <option>Balanced</option>
                        <option>High (Detect subtle frustration)</option>
                        <option>Low (Only strong emotions)</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'language' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Automatically detect the user's language and switch the bot's persona accordingly.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Supported Languages</label>
                      <div className="flex flex-wrap gap-2">
                        {['English', 'Spanish', 'French', 'German'].map(lang => (
                          <span key={lang} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'backtrack' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Use this to handle "Wait, go back" or "I changed my mind" scenarios.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Backtrack To</label>
                      <select className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30">
                        <option>Previous Message</option>
                        <option>Last User Input</option>
                        <option>Start of Conversation</option>
                      </select>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'action' && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Action Type</label>
                      <select 
                        className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30"
                        value={selectedNode.data.actionType || 'sms'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, actionType: val } } : n));
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, actionType: val } });
                        }}
                      >
                        <option value="sms">Send SMS</option>
                        <option value="email">Send Email</option>
                        <option value="webhook">Trigger Webhook</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Message Template</label>
                      <textarea className="w-full h-24 bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface resize-none focus:ring-1 focus:ring-primary/30" placeholder="Hello, here is your payment link: {{link}}" />
                    </div>
                  </div>
                )}

                {selectedNode.type === 'knowledge' && (
                  <div className="flex flex-col gap-6">
                    <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Connect this node to your Knowledge Base to handle off-topic questions or provide detailed policy info.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Search Query</label>
                      <input 
                        className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30" 
                        type="text" 
                        value={selectedNode.data.query || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, query: val } } : n));
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, query: val } });
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 p-6 rounded-3xl bg-primary/5 border border-primary/10 flex flex-col gap-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="size-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">AI Assistant</span>
                  </div>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {selectedNode.type === 'speech' 
                      ? "I can help you write a more natural response. Should I make it more professional or friendly?"
                      : "I can suggest common intents based on the previous bot response."}
                  </p>
                  <div className="flex gap-2">
                    <button className="text-xs font-bold text-primary hover:underline">Professional</button>
                    <button className="text-xs font-bold text-primary hover:underline">Friendly</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inline Test Simulator Drawer */}
        {simOpen && (
          <div className="w-96 border-l border-outline-variant/10 bg-surface-low flex flex-col shrink-0">
            <div className="p-4 border-b border-outline-variant/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-sm">Live Simulator</span>
              </div>
              <button onClick={() => setSimOpen(false)} className="text-outline hover:text-on-surface"><X className="size-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {simChat.length === 0 && (
                <div className="text-center text-xs text-outline py-8">
                  <Play className="size-6 mx-auto mb-2 opacity-40" />
                  Type a message to simulate a user turn through the current live graph.
                  <div className="mt-2 font-mono text-[10px]">Start: {simNode || nodes[0]?.id || '—'}</div>
                </div>
              )}
              {simChat.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-outline mb-1 uppercase font-bold">{msg.role}</span>
                  <div className={cn(
                    "text-xs px-3 py-2 rounded-xl max-w-[85%]",
                    msg.role === 'user' ? 'bg-primary/20 text-primary rounded-br-none' 
                    : msg.role === 'system' ? 'bg-white/5 text-outline italic border border-white/5'
                    : 'bg-white/10 text-on-surface rounded-bl-none'
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {simRunning && <div className="text-xs text-outline italic animate-pulse">Evaluating...</div>}
            </div>
            <form onSubmit={e => { e.preventDefault(); runSimulatorTurn(); }} className="p-3 border-t border-outline-variant/5">
              <div className="relative">
                <input
                  type="text"
                  value={simInput}
                  onChange={e => setSimInput(e.target.value)}
                  placeholder="Simulate user phrase..."
                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <button type="submit" disabled={simRunning || !simInput.trim()} className="absolute right-2 top-2 bottom-2 w-7 flex items-center justify-center hover:text-emerald-400 text-outline rounded transition-colors">
                  <Play className="size-3" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
