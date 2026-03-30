import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  UserRoundPen, 
  MessageSquareText, 
  Settings2, 
  Wrench, 
  SlidersHorizontal,
  ChevronDown,
  Search,
  CalendarPlus,
  CalendarDays,
  BrainCircuit,
  Sparkles,
  Loader2,
  ShieldCheck,
  Wallet,
  Receipt,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

export default function CreateBot() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [initializing, setInitializing] = React.useState(true);
  
  const [models, setModels] = React.useState<{id: string, name: string}[]>([]);
  const [voices, setVoices] = React.useState<{id: string, name: string}[]>([]);

  const [formData, setFormData] = React.useState({
    name: '',
    role: '',
    persona: '',
    system_prompt: '',
    greeting: '',
    llm_model: '',
    voice_id: '',
    tools_enabled: [] as string[],
    temperature: 0.7,
    max_tokens: 2048,
    description: '',
    icon: 'bot',
    color: 'primary'
  });

  React.useEffect(() => {
    async function loadMetadata() {
      try {
        const [modelsData, voicesData] = await Promise.all([
          api.getModels(),
          api.getVoices()
        ]);
        setModels(modelsData);
        setVoices(voicesData);
        
        // Set defaults if lists are not empty
        if (modelsData.length > 0) {
          setFormData(prev => ({ ...prev, llm_model: modelsData[0].id }));
        }
        if (voicesData.length > 0) {
          setFormData(prev => ({ ...prev, voice_id: voicesData[0].id }));
        }
      } catch (err) {
        console.error('Failed to load metadata:', err);
      } finally {
        setInitializing(false);
      }
    }
    loadMetadata();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name || !formData.system_prompt) {
      alert('Name and System Instructions are required');
      return;
    }

    setLoading(true);
    try {
      await api.createBot({
        ...formData,
        persona: formData.persona || formData.role || 'helpful AI assistant',
        description: formData.description || `AI agent specializing in ${formData.role || 'general tasks'}`
      });
      navigate('/personas');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      tools_enabled: prev.tools_enabled.includes(tool)
        ? prev.tools_enabled.filter(t => t !== tool)
        : [...prev.tools_enabled, tool]
    }));
  };

  if (initializing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background text-on-surface">
      {/* Focused Header */}
      <header className="h-20 flex items-center justify-between px-10 glass-panel sticky top-0 z-50 border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="size-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="font-headline font-extrabold text-2xl tracking-tight text-on-surface">
              Create <span className="text-primary">New Agent</span>
            </h1>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">Bot Factory • Neural Synthesis</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:text-on-surface ghost-border transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 rounded-xl ember-gradient text-on-primary-fixed font-bold text-sm shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? 'Synthesizing...' : 'Initialize Agent'}
          </button>
        </div>
      </header>

      {/* Editor Grid */}
      <div className="p-10 grid grid-cols-12 gap-10 max-w-[1600px] mx-auto w-full">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <UserRoundPen className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Define Identity</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Agent Name</label>
                <input 
                  className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30" 
                  type="text" 
                  placeholder="e.g. Orion" 
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Primary Role</label>
                <input 
                  className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30" 
                  type="text" 
                  placeholder="e.g. Customer Success" 
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">System Instructions</label>
              <textarea 
                className="w-full h-80 bg-surface-container-low font-mono text-sm leading-relaxed p-6 rounded-2xl border-none resize-none text-primary/90 focus:ring-1 focus:ring-primary/30" 
                placeholder="# DEFINE AGENT BEHAVIOR HERE..."
                value={formData.system_prompt}
                onChange={e => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
              />
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <MessageSquareText className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Greeting Sequence</h3>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Opening Statement</label>
              <input 
                className="bg-surface-container-highest border-none rounded-2xl p-4 font-medium text-on-surface h-14 w-full focus:ring-1 focus:ring-primary/30" 
                type="text" 
                placeholder="How should the agent introduce itself?"
                value={formData.greeting}
                onChange={e => setFormData(prev => ({ ...prev, greeting: e.target.value }))}
              />
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <Settings2 className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Model & Voice</h3>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Inference Engine</label>
                <div className="relative">
                  <select 
                    className="appearance-none w-full bg-surface-container-highest border-none rounded-2xl p-4 pr-10 font-medium text-on-surface h-14 cursor-pointer focus:ring-1 focus:ring-primary/30"
                    value={formData.llm_model}
                    onChange={e => setFormData(prev => ({ ...prev, llm_model: e.target.value }))}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant size-5" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Voice Profile</label>
                <div className="relative">
                  <select 
                    className="appearance-none w-full bg-surface-container-highest border-none rounded-2xl p-4 pr-10 font-medium text-on-surface h-14 cursor-pointer focus:ring-1 focus:ring-primary/30"
                    value={formData.voice_id}
                    onChange={e => setFormData(prev => ({ ...prev, voice_id: e.target.value }))}
                  >
                    {voices.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant size-5" />
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <Wrench className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Capabilities</h3>
            </div>
            <div className="space-y-3">
              <CapabilityToggle icon={Search} label="search_knowledge" checked={formData.tools_enabled.includes('search_knowledge')} onChange={() => toggleTool('search_knowledge')} />
              <CapabilityToggle icon={CalendarPlus} label="book_appointment" checked={formData.tools_enabled.includes('book_appointment')} onChange={() => toggleTool('book_appointment')} />
              <CapabilityToggle icon={CalendarDays} label="get_appointments" checked={formData.tools_enabled.includes('get_appointments')} onChange={() => toggleTool('get_appointments')} />
              <CapabilityToggle icon={BrainCircuit} label="remember_user_fact" checked={formData.tools_enabled.includes('remember_user_fact')} onChange={() => toggleTool('remember_user_fact')} />
              <CapabilityToggle icon={ShieldCheck} label="verify_customer" checked={formData.tools_enabled.includes('verify_customer')} onChange={() => toggleTool('verify_customer')} />
              <CapabilityToggle icon={Wallet} label="get_account_balance" checked={formData.tools_enabled.includes('get_account_balance')} onChange={() => toggleTool('get_account_balance')} />
              <CapabilityToggle icon={Receipt} label="get_loan_status" checked={formData.tools_enabled.includes('get_loan_status')} onChange={() => toggleTool('get_loan_status')} />
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-8 ghost-border">
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Inference Params</h3>
            </div>
            <div className="space-y-10">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Temperature</label>
                  <span className="font-mono text-sm text-primary">{formData.temperature}</span>
                </div>
                <input 
                  className="w-full custom-range cursor-pointer" max="1" min="0" step="0.1" type="range" 
                  value={formData.temperature}
                  onChange={e => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Max Tokens</label>
                  <span className="font-mono text-sm text-primary">{formData.max_tokens}</span>
                </div>
                <input 
                  className="w-full custom-range cursor-pointer" max="4096" min="256" step="128" type="range" 
                  value={formData.max_tokens}
                  onChange={e => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="h-16"></div>
    </div>
  );
}

function CapabilityToggle({ icon: Icon, label, checked, onChange }: any) {
  return (
    <label className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low cursor-pointer hover:bg-surface-container-high transition-colors group">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-on-surface-variant group-hover:text-primary transition-colors" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <input 
        className="rounded border-outline-variant bg-surface-variant text-primary focus:ring-primary/20 size-5" 
        type="checkbox" 
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}
