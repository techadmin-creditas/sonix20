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
  Panel,
  ReactFlowProvider,
  useReactFlow
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
  Play,
  Code,
  Copy,
  Check,
  RefreshCw,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

// --- Custom Node Components ---

const SpeechNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all relative",
    selected ? "border-primary shadow-[0_0_25px_rgba(255,183,123,0.3)]" : "border-primary/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Active</div>}
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
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all relative",
    selected ? "border-secondary shadow-[0_0_25px_rgba(255,182,142,0.3)]" : "border-secondary/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">User Turn</div>}
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
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all relative",
    selected ? "border-tertiary shadow-[0_0_25px_rgba(182,234,255,0.3)]" : "border-tertiary/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Thinking</div>}
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
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all relative",
    selected ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.3)]" : "border-emerald-500/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Detecting</div>}
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
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all relative",
    selected ? "border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.3)]" : "border-blue-500/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Translating</div>}
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
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all relative",
    selected ? "border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.3)]" : "border-purple-500/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Resetting</div>}
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

const FallbackNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[240px] transition-all relative",
    selected ? "border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]" : "border-amber-500/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Thinking</div>}
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-500 border-2 border-background" />
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
        <Zap className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60">LLM Fallback</div>
        <div className="text-sm font-bold">{data.label}</div>
      </div>
    </div>
    <div className="mt-3 text-[10px] text-outline leading-tight italic bg-white/5 p-2 rounded-lg">
      Captures unhandled intent and allows AI to steer conversation back on track.
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-amber-500 border-2 border-background" />
  </div>
);

const ActionNode = ({ data, selected }: any) => (
  <div className={cn(
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[200px] transition-all relative",
    selected ? "border-amber-400/50 shadow-[0_0_25px_rgba(251,191,36,0.2)]" : "border-amber-400/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Running</div>}
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
    "px-5 py-4 rounded-2xl glass-panel border-2 min-w-[220px] transition-all relative",
    selected ? "border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.3)]" : "border-indigo-500/20",
    data.isActive && "border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] scale-105 animate-pulse-subtle"
  )}>
    {data.isActive && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg z-10">Searching</div>}
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
  llm_fallback: FallbackNode,
};

// --- Main Component ---

export default function WorkflowEditorWrapper() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
}

function WorkflowEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { setCenter } = useReactFlow();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowId, setWorkflowId] = useState<string | undefined>(id);

  // Simulator state
  const [simOpen, setSimOpen] = useState(false);
  const [simInput, setSimInput] = useState('');
  const [simChat, setSimChat] = useState<{role: string, text: string}[]>([]);
  const [simNode, setSimNode] = useState<string | undefined>();
  const [simHistory, setSimHistory] = useState<string[]>([]);
  const [simVisitCounts, setSimVisitCounts] = useState<Record<string, number>>({});
  const [simRunning, setSimRunning] = useState(false);
  const [expandedIntent, setExpandedIntent] = useState<string | null>(null);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [aiStrategyPrompt, setAiStrategyPrompt] = useState("");

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

  const addConnectedNode = (type: string, dataLabel?: string, edgeLabel?: string) => {
    if (!selectedNode) {
      addNode(type);
      return;
    }
    const newId = Math.random().toString(36).substr(2, 9);
    
    // Default label: bot says -> user input = user_response
    let finalEdgeLabel = edgeLabel || "";
    if (!finalEdgeLabel && selectedNode.type === 'speech' && type === 'userInput') {
      finalEdgeLabel = 'user_response';
    }

    const newNode: Node = {
      id: newId,
      type,
      position: { x: selectedNode.position.x, y: selectedNode.position.y + 250 },
      data: { label: dataLabel || `New ${type}` },
    };
    
    const newEdge: Edge = {
      id: Math.random().toString(36).substr(2, 9),
      source: selectedNode.id,
      target: newId,
      label: finalEdgeLabel,
      animated: true,
      style: { strokeWidth: 2 }
    };

    setNodes((nds) => nds.concat(newNode));
    setEdges((eds) => eds.concat(newEdge));
    
    setSelectedNode(newNode);
    setCenter(newNode.position.x + 100, newNode.position.y + 50, { zoom: 1.2, duration: 800 });
    setExpandedIntent(null);
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

  const updateEdgeLabel = (label: string) => {
    if (!selectedNode) return;
    setEdges((eds) => 
      eds.map((edge) => {
        if (edge.target === selectedNode.id) {
           return { ...edge, label };
        }
        return edge;
      })
    );
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
    // ... Existing implementation
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
      const res = await api.testWorkflow(
        { nodes, edges }, 
        text, 
        currentNode, 
        simVisitCounts
      );

      if (res.status === 'success') {
        setSimNode(res.next_node_id);
        setSimVisitCounts(res.node_visit_counts || {});
        
        const newMsgs = (res.speak_responses || []).map((r: string) => ({ role: 'bot', text: r }));
        setSimChat(prev => [...prev, ...newMsgs]);

        if (res.is_disconnected) {
            setSimChat(prev => [...prev, { role: 'system', text: '— CALL DISCONNECTED —' }]);
            setSimNode(undefined);
        } else if (res.next_node_id) {
            setSimHistory(prev => [...prev, res.next_node_id]);
            const targetNode = nodes.find(n => n.id === res.next_node_id);
            if (targetNode) {
              setCenter(targetNode.position.x + 100, targetNode.position.y + 50, { zoom: 1.2, duration: 800 });
            }
        }
      }
      if (res.yield_to_llm) {
        setSimChat(prev => [...prev, { role: 'system', text: '— YIELDED TO FREEFORM LLM —' }]);
      }
    } catch (err) {
      console.error("Simulation failed:", err);
      setSimChat(prev => [...prev, { role: 'system', text: 'Simulation error — check backend.' }]);
    } finally {
      setSimRunning(false);
    }
  };

  /**
   * Sync Visual -> JSON (whenever graph changes)
   */
  useEffect(() => {
     if (isJsonMode && !isSyncing) {
        setJsonText(JSON.stringify({ nodes, edges }, null, 2));
     }
  }, [nodes, edges, isJsonMode]);

  /**
   * Sync JSON -> Visual (whenever user types)
   */
  const handleJsonChange = (val: string) => {
    setJsonText(val);
    setIsSyncing(true);
    try {
      const parsed = JSON.parse(val);
      setJsonError(null);
      if (parsed.nodes) setNodes(parsed.nodes);
      if (parsed.edges) setEdges(parsed.edges);
    } catch (e: any) {
      setJsonError(e.message);
    } finally {
      // Small debounce-like reset for the sync flag
      setTimeout(() => setIsSyncing(false), 10);
    }
  };

  const handleAISuggest = async (tone: string) => {
    if (!selectedNode) return;
    
    setIsGeneratingAI(true);
    try {
      const incomingEdge = edges.find(e => e.target === selectedNode.id);
      const sourceNode = incomingEdge ? nodes.find(n => n.id === incomingEdge.source) : null;
      const context = sourceNode ? (sourceNode.data.speech || sourceNode.data.label) : "";

      const suggestion = await api.suggestAIContent(
        selectedNode.type || 'speech',
        selectedNode.data.speech || selectedNode.data.label || "",
        tone,
        context
      );

      if (selectedNode.type === 'speech') {
        const newData = { ...selectedNode.data, speech: suggestion };
        setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: newData } : n));
        setSelectedNode({ ...selectedNode, data: newData });
      } else if (selectedNode.type === 'userInput' || selectedNode.type === 'logic') {
        const intents = suggestion.split(',').map(s => s.trim());
        const newData = { ...selectedNode.data, intents };
        setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: newData } : n));
        setSelectedNode({ ...selectedNode, data: newData });
      }
    } catch {
      alert('AI Suggestion failed. Check backend logs.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAIDesignOperation = async (op: 'REFACTOR' | 'SUGGEST_NEXT') => {
    if (!selectedNode) return;
    setIsGeneratingAI(true);
    try {
      // 1. Gather Context (Predecessors & Successors)
      const incomingEdges = edges.filter(e => e.target === selectedNode.id);
      const outgoingEdges = edges.filter(e => e.source === selectedNode.id);
      
      const predecessors = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean);
      const successors = outgoingEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean);

      const suggestion = await api.architectAI({
        operation_type: op,
        current_node: selectedNode,
        predecessors,
        successors,
        strategy_prompt: aiStrategyPrompt,
        workflow_goal: workflowDescription || workflowName
      });

      if (op === 'REFACTOR') {
        const text = typeof suggestion === 'string' ? suggestion : suggestion.speech || suggestion.label;
        updateNodeLabel(selectedNode.type === 'speech' ? selectedNode.data.label : text);
        if (selectedNode.type === 'speech') {
           setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, speech: text } } : n));
           setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, speech: text } });
        }
      } else if (op === 'SUGGEST_NEXT') {
        // AI returned a new node object: {type, label, speech}
        const { type, label, speech } = suggestion;
        addConnectedNode(type || 'speech', label || 'AI Generated Step', '');
        if (speech) {
           // Small delay to ensure the new node is added
           setTimeout(() => {
              setNodes(nds => nds.map(n => n.data.label === (label || 'AI Generated Step') ? { ...n, data: { ...n.data, speech } } : n));
           }, 50);
        }
      }
      
      setAiStrategyPrompt(""); // Clear prompt after success
    } catch (e) {
      console.error("Architect Error:", e);
      alert('Architect failed to design the next path.');
    } finally {
      setIsGeneratingAI(false);
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
    <div className="flex-1 flex flex-col h-screen bg-background text-on-surface overflow-hidden dark font-body">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0">
          <div className="absolute top-0 left-0 size-[600px] bg-amber-900/20 blur-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="absolute bottom-0 right-0 size-[600px] bg-orange-950/20 blur-[120px] translate-x-1/2 translate-y-1/2 rounded-full" />
      </div>

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-10 bg-surface shrink-0 z-50 border-b border-outline-variant/5 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/workflows')}
            className="size-10 flex items-center justify-center rounded-xl bg-surface-high hover:bg-surface-highest transition-all text-on-surface shadow-sm"
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
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                {id ? 'Existing Flow' : 'New Flow'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsJsonMode(!isJsonMode)}
            className={cn(
                "p-2.5 rounded-xl transition-all flex items-center justify-center border",
                isJsonMode ? "bg-primary/20 text-primary border-primary/30" : "text-on-surface-variant hover:text-primary hover:bg-primary/10 border-outline-variant/10"
            )}
            title="Split-View JSON Code"
          >
            <Code className="size-5" />
          </button>
          <button
            onClick={() => { 
              setSimChat([]); 
              const firstNodeId = nodes[0]?.id;
              setSimNode(firstNodeId); 
              setSimOpen(true); 
              setTimeout(() => runSimulatorTurn("", firstNodeId), 100);
            }}
            className="px-6 py-2.5 rounded-xl font-headline font-bold text-sm flex items-center gap-2 bg-surface-high text-emerald-400 hover:bg-emerald-500/10 hover:shadow-[0_0_20px_rgba(52,211,153,0.15)] transition-all ghost-border"
          >
            <Play className="size-4" />
            Test Flow
          </button>
          <button 
            onClick={() => navigate('/workflows')}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:text-on-surface transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "px-10 py-2.5 rounded-xl font-headline font-extrabold text-sm shadow-xl transition-all flex items-center gap-2 ember-gradient text-on-primary-fixed hover:scale-[1.02] active:scale-[0.98]",
              saving && "opacity-50 pointer-events-none"
            )}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? 'Processing...' : 'Deploy System'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Parallel Mode: JSON Code Panel */}
        {isJsonMode && (
          <div className="w-1/3 border-r border-outline-variant/10 flex flex-col bg-surface-lowest shrink-0 animate-in slide-in-from-left duration-500 overflow-hidden shadow-2xl">
                <header className="px-6 py-5 bg-surface-high flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Code className="size-4" />
                        </div>
                        <span className="text-[10px] font-headline font-bold uppercase tracking-[0.15em] text-on-surface-variant">Command Source</span>
                    </div>
                    {jsonError ? (
                        <div className="flex items-center gap-1.5 text-red-400 animate-pulse">
                            <AlertTriangle className="size-3" />
                            <span className="text-[9px] font-bold uppercase">Invalid Format</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                            <CheckCircle className="size-3" />
                            <span className="text-[9px] font-bold uppercase">Synced</span>
                        </div>
                    )}
                </header>
                <div className="flex-1 relative bg-black/5">
                    <textarea
                        className={cn(
                            "w-full h-full p-6 bg-transparent font-mono text-[10px] leading-relaxed resize-none focus:outline-none transition-colors",
                            jsonError ? "text-red-300" : "text-primary"
                        )}
                        spellCheck={false}
                        value={jsonText}
                        onChange={(e) => handleJsonChange(e.target.value)}
                    />
                    {jsonError && (
                        <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-[9px] text-red-300 font-mono italic truncate">{jsonError}</p>
                        </div>
                    )}
                </div>
                <footer className="px-5 py-3 border-t border-outline-variant/5 bg-black/20 flex items-center justify-between">
                    <button 
                        onClick={async () => await navigator.clipboard.writeText(jsonText)}
                        className="text-[9px] font-bold text-outline hover:text-on-surface flex items-center gap-1.5"
                    >
                        <Copy className="size-3" /> Copy Definition
                    </button>
                    <div className="text-[9px] font-bold text-outline uppercase tracking-tight">UTF-8 Live Rendering</div>
                </footer>
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 relative bg-surface-lowest/30">
          <ReactFlow
            nodes={nodes.map(n => ({
              ...n,
              data: { ...n.data, isActive: n.id === simNode }
            }))}
            edges={edges.map(e => ({
              ...e,
              animated: simHistory.includes(e.target) && simHistory.includes(e.source),
              style: simHistory.includes(e.target) && simHistory.includes(e.source) 
                ? { stroke: '#10b981', strokeWidth: 3, opacity: 1 } 
                : { opacity: 0.4 }
            }))}
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
        {selectedNode && (
          <div className={cn(
            "w-96 border-l border-outline-variant/10 bg-surface-low p-8 overflow-y-auto transition-all transform shrink-0"
          )}>
            <div className="flex flex-col gap-8">
              {/* Header: Node Title/Label */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline">Node Name</label>
                    <input 
                      type="text" 
                      className="text-xl font-headline font-extrabold bg-transparent border-b border-outline-variant/20 focus:border-primary focus:outline-none w-full pb-1"
                      value={selectedNode.data.label || ''}
                      onChange={(e) => updateNodeLabel(e.target.value)}
                    />
                </div>
                <button onClick={removeNode} className="p-2 ml-4 rounded-lg hover:bg-red-500/10 text-red-500 transition-all shrink-0">
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* Incoming Connection Label */}
              {edges.find(e => e.target === selectedNode.id) && (
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline flex items-center gap-2">
                    <Link2 className="size-3" /> Incoming Path Label
                  </label>
                  <input 
                    type="text" 
                    className="text-xs font-bold bg-transparent border-b border-outline-variant/20 focus:border-primary focus:outline-none w-full pb-1 py-1"
                    placeholder="e.g. user_response, retry_1..."
                    value={edges.find(e => e.target === selectedNode.id)?.label || ''}
                    onChange={(e) => updateEdgeLabel(e.target.value)}
                  />
                  <p className="text-[9px] text-outline italic">Renames the path leading into this block.</p>
                </div>
              )}

              {/* Quick Actions: Connect to New Node */}
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-outline">Quick Link (Generic Next)</label>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => addConnectedNode('speech', 'Bot Response')} 
                        className="flex-1 px-3 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 border border-primary/20 transition-all flex items-center justify-center gap-1"
                    >
                        <MessageSquare className="size-3" /> Bot
                    </button>
                    <button 
                        onClick={() => addConnectedNode('userInput', 'User Input')} 
                        className="flex-1 px-3 py-2 rounded-xl bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider hover:bg-secondary/20 border border-secondary/20 transition-all flex items-center justify-center gap-1"
                    >
                        <Search className="size-3" /> Input
                    </button>
                    <button 
                        onClick={() => addConnectedNode('logic', 'Logic Branch')} 
                        className="flex-1 px-3 py-2 rounded-xl bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase tracking-wider hover:bg-tertiary/20 border border-tertiary/20 transition-all flex items-center justify-center gap-1"
                    >
                        <GitBranch className="size-3" /> Logic
                    </button>
                </div>
              </div>

              <div className="h-px bg-outline-variant/10" />

                {selectedNode.type === 'speech' && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Speech Generation Mode</label>
                        <div className="flex p-1 bg-surface-high rounded-2xl shadow-sm">
                            <button 
                                onClick={() => {
                                    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, mode: 'direct' } } : n));
                                    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, mode: 'direct' } });
                                }}
                                className={cn(
                                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                                    (selectedNode.data.mode || 'direct') === 'direct' ? "bg-surface-low text-primary shadow-sm" : "text-outline hover:text-on-surface"
                                )}
                            >
                                Standard (Direct)
                            </button>
                            <button 
                                onClick={() => {
                                    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, mode: 'llm' } } : n));
                                    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, mode: 'llm' } });
                                }}
                                className={cn(
                                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                                    selectedNode.data.mode === 'llm' ? "bg-surface-low text-primary shadow-sm" : "text-outline hover:text-on-surface"
                                )}
                            >
                                <Sparkles className="size-3 inline mr-1" /> AI Dynamic
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">
                            {(selectedNode.data.mode || 'direct') === 'direct' ? "Bot's Response" : "AI Base Guidance"}
                        </label>
                        <textarea 
                        className="w-full h-32 bg-surface-high border-none rounded-2xl p-4 font-body font-medium text-on-surface resize-none focus:ring-1 focus:ring-primary/20 transition-all" 
                        placeholder={selectedNode.data.mode === 'llm' ? "What goal should the AI achieve in this turn?" : "What should the bot say?"}
                        value={selectedNode.data.speech || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, speech: val } } : n));
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, speech: val } });
                        }}
                        />
                    </div>
                  </div>
                )}


                {selectedNode.type === 'logic' && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Goal Persistence</label>
                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-500 flex items-center gap-2">
                                    <RotateCcw className="size-3" /> Retry Limit
                                </span>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="10"
                                    className="w-16 bg-surface-lowest/50 border border-amber-500/20 rounded-lg px-2 py-1 text-xs font-bold text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                    value={selectedNode.data.retry_limit || 0}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, retry_limit: val } } : n));
                                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, retry_limit: val } });
                                    }}
                                />
                            </div>
                            <p className="text-[10px] text-on-surface-variant leading-relaxed">
                                Sets how many times the bot should try to convince the user before failing.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Branch Intents</label>
                      <div className="flex flex-col gap-2">
                        {(selectedNode.data.intents || []).map((intent: string, idx: number) => {
                          const isExpanded = expandedIntent === `logic-${selectedNode.id}-${intent}-${idx}`;
                          return (
                            <div key={`${intent}-${idx}`} className="flex flex-col gap-2 p-3 rounded-xl bg-tertiary/10 border border-tertiary/20 group animate-in fade-in slide-in-from-right-1 duration-200">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-tertiary uppercase tracking-tight">{intent}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => setExpandedIntent(isExpanded ? null : `logic-${selectedNode.id}-${intent}-${idx}`)}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      isExpanded ? "bg-tertiary text-on-surface" : "bg-tertiary/20 text-tertiary hover:bg-tertiary/30"
                                    )}
                                  >
                                    {isExpanded ? <X className="size-3" /> : <PlusCircle className="size-3" />}
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const newIntents = selectedNode.data.intents.filter((_: any, i: number) => i !== idx);
                                      setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, intents: newIntents } } : n));
                                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, intents: newIntents } });
                                    }}
                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="flex gap-2 animate-in zoom-in-95 duration-200 mt-1">
                                  <button onClick={() => addConnectedNode('speech', `Response for ${intent}`, intent)} className="flex-1 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase hover:bg-primary/20 flex items-center justify-center gap-1">
                                    <MessageSquare className="size-3" /> Bot
                                  </button>
                                  <button onClick={() => addConnectedNode('userInput', `Collector for ${intent}`, intent)} className="flex-1 py-2 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 text-[9px] font-bold uppercase hover:bg-secondary/20 flex items-center justify-center gap-1">
                                    <Search className="size-3" /> Input
                                  </button>
                                  <button onClick={() => addConnectedNode('logic', `Check for ${intent}`, intent)} className="flex-1 py-2 rounded-lg bg-tertiary/10 text-tertiary border border-tertiary/20 text-[9px] font-bold uppercase hover:bg-tertiary/20 flex items-center justify-center gap-1">
                                    <GitBranch className="size-3" /> Logic
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button 
                          onClick={() => {
                            const intent = prompt('Enter branch label (e.g. Yes, No, Change Language):');
                            if (intent) {
                              const newIntents = [...(selectedNode.data.intents || []), intent];
                              setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, intents: newIntents } } : n));
                              setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, intents: newIntents } });
                            }
                          }}
                          className="w-full py-3 rounded-xl border border-dashed border-tertiary/30 text-tertiary text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary/5 transition-all"
                        >
                          + Add Intent Branch
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'userInput' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Expected User Intents</label>
                    <div className="flex flex-col gap-2">
                      {(selectedNode.data.intents || []).map((intent: string, idx: number) => {
                        const isExpanded = expandedIntent === `user-${selectedNode.id}-${intent}-${idx}`;
                        return (
                          <div key={`${intent}-${idx}`} className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/10 border border-secondary/20 group animate-in fade-in slide-in-from-right-1 duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-secondary uppercase tracking-tight">{intent}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setExpandedIntent(isExpanded ? null : `user-${selectedNode.id}-${intent}-${idx}`)}
                                  className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    isExpanded ? "bg-secondary text-on-surface" : "bg-secondary/20 text-secondary hover:bg-secondary/30"
                                  )}
                                >
                                  {isExpanded ? <X className="size-3" /> : <PlusCircle className="size-3" />}
                                </button>
                                <button 
                                  onClick={() => {
                                    const newIntents = selectedNode.data.intents.filter((_: any, i: number) => i !== idx);
                                    setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, intents: newIntents } } : n));
                                    setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, intents: newIntents } });
                                  }}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="flex gap-2 animate-in zoom-in-95 duration-200 mt-1">
                                <button onClick={() => addConnectedNode('speech', `Handling ${intent}`, intent)} className="flex-1 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase hover:bg-primary/20 flex items-center justify-center gap-1">
                                  <MessageSquare className="size-3" /> Bot
                                </button>
                                <button onClick={() => addConnectedNode('userInput', `Collector for ${intent}`, intent)} className="flex-1 py-2 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 text-[9px] font-bold uppercase hover:bg-secondary/20 flex items-center justify-center gap-1">
                                  <Search className="size-3" /> Input
                                </button>
                                <button onClick={() => addConnectedNode('logic', `Logic for ${intent}`, intent)} className="flex-1 py-2 rounded-lg bg-tertiary/10 text-tertiary border border-tertiary/20 text-[9px] font-bold uppercase hover:bg-tertiary/20 flex items-center justify-center gap-1">
                                  <GitBranch className="size-3" /> Logic
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button 
                        onClick={() => {
                          const intent = prompt('Enter new intent (e.g. Greeting, Payment, Status Check):');
                          if (intent) {
                            const newIntents = [...(selectedNode.data.intents || []), intent];
                            setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, intents: newIntents } } : n));
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, intents: newIntents } });
                          }
                        }}
                        className="w-full py-3 rounded-xl border border-dashed border-secondary/30 text-secondary text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/5 transition-all"
                      >
                        + Add Expected Intent
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
                  </div>
                )}

                {selectedNode.type === 'language' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Automatically detect the user's language and switch the bot's persona accordingly.
                      </p>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'action' && (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Action Type</label>
                      <select 
                        className="bg-surface-high border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30"
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
                  </div>
                )}

                {selectedNode.type === 'knowledge' && (
                  <div className="flex flex-col gap-6">
                    <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Connect this node to your Knowledge Base to handle FAQs. 
                        Filters help prevent the bot from searching unrelated categories.
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Allowed Topics (Comma Separated)</label>
                      <input 
                        type="text" 
                        className="w-full bg-surface-high border-none rounded-xl p-3 text-xs font-medium text-on-surface focus:ring-1 focus:ring-primary/20 transition-all" 
                        placeholder="e.g. banking, payments, loan-policy"
                        value={Array.isArray(selectedNode.data.topics) ? selectedNode.data.topics.join(', ') : (selectedNode.data.topics || '')}
                        onChange={(e) => {
                          const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, topics: val } } : n));
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, topics: val } });
                        }}
                      />
                      <p className="text-[9px] text-outline px-1">Restricts search only to matching 'topic' tags in the DB.</p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Allowed Source Files (Comma Separated)</label>
                      <input 
                        type="text" 
                        className="w-full bg-surface-high border-none rounded-xl p-3 text-xs font-medium text-on-surface focus:ring-1 focus:ring-primary/20 transition-all" 
                        placeholder="e.g. banking_manual.pdf, faq_v2.pdf"
                        value={Array.isArray(selectedNode.data.sources) ? selectedNode.data.sources.join(', ') : (selectedNode.data.sources || '')}
                        onChange={(e) => {
                          const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, sources: val } } : n));
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, sources: val } });
                        }}
                      />
                      <p className="text-[9px] text-outline px-1">Limits results to specific uploaded filenames.</p>
                    </div>
                  </div>
                )}

                {selectedNode.type === 'llm_fallback' && (
                  <div className="flex flex-col gap-6">
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        When the conversation goes off-script, this node allows the LLM to creatively handle the situation while attempting to redirect back to known paths.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Specific Fallback Prompt</label>
                        <textarea 
                        className="w-full h-32 bg-surface-high border-none rounded-2xl p-4 font-body font-medium text-on-surface resize-none focus:ring-1 focus:ring-primary/20 transition-all" 
                        placeholder="e.g. If the user is confused about policy, explain it softly and ask if they are ready to proceed with payment."
                        value={selectedNode.data.speech || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, speech: val } } : n));
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, speech: val } });
                        }}
                        />
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-8 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 text-primary mb-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <Sparkles className="size-4" />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Flow Architect</span>
                  </div>
                  
                  <div className="flex flex-col gap-4 px-1">
                      <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center justify-between">
                            Contextual Strategy
                            <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded italic lowercase font-normal opacity-60">LLM Enhanced</span>
                          </label>
                          <textarea 
                            className="w-full h-24 bg-surface-highest border-none rounded-2xl p-4 text-xs font-medium text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-primary/20 transition-all" 
                            placeholder="e.g. If user says 'I don't have money', offer a partial payment and remind them of the legal notice."
                            value={aiStrategyPrompt}
                            onChange={(e) => setAiStrategyPrompt(e.target.value)}
                          />
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          disabled={isGeneratingAI}
                          onClick={() => handleAIDesignOperation('REFACTOR')}
                          className="w-full py-4 rounded-2xl bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-primary/10 transition-all disabled:opacity-50"
                        >
                          {isGeneratingAI ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                          Refine Flow with AI
                        </button>
                        
                        <button 
                          disabled={isGeneratingAI}
                          onClick={() => handleAIDesignOperation('SUGGEST_NEXT')}
                          className="w-full py-4 rounded-2xl bg-surface-highest border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {isGeneratingAI ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                          Predict Next Step
                        </button>
                      </div>

                      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 mt-1">
                        <p className="text-[9px] text-on-surface-variant italic leading-tight">
                          The Architect analyzes the <b>bidirectional flow</b> (who spoke before and who follows) to ensure your dialogue remains logically consistent.
                        </p>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                </div>
              )}
              {simHistory.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4 p-2 bg-black/20 rounded-lg border border-white/5">
                    <span className="text-[8px] font-bold text-outline uppercase tracking-widest w-full mb-1">Path History</span>
                    {simHistory.map((h, i) => (
                        <div key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {nodes.find(n => n.id === h)?.data.label || h}
                        </div>
                    ))}
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
