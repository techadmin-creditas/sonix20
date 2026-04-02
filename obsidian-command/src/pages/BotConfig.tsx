import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Loader2,
  CheckCircle2,
  Cloud,
  PhoneOff,
  ClipboardList,
  Webhook,
  ShieldCheck,
  Wallet,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api, Bot } from '../lib/api';

const AGENT_TASK_OUTBOUND_EXAMPLE = `{
  "spec_version": 1,
  "call_purpose": "Remind the user that a payment is due and help them pay or understand options.",
  "opening_script_hint": "Brief greeting, who you represent, ask if it is a good time (no sensitive data).",
  "verification_policy": "Confirm first name or last four digits only if your playbook allows; never ask for full card or passwords.",
  "value_props": ["Avoid late fees", "Keeps account in good standing", "Takes about two minutes"],
  "objection_handling": "If they refuse: empathize once, offer one alternative (payment plan, link, or callback). If still no: polite exit.",
  "off_topic_behavior": "answer_briefly_then_return",
  "tool_policy": "Use search_knowledge for policy amounts, due dates, and payment methods before stating them.",
  "exit_conditions": "User pays, agrees to callback, or declines twice after your alternate offer.",
  "max_persuasion_rounds": 2,
  "escalation_triggers": ["speak to human", "supervisor", "lawyer"]
}`;

const AGENT_TASK_INBOUND_EXAMPLE = `{
  "spec_version": 1,
  "call_purpose": "Help the user with product questions and resolve their issue in one session when possible.",
  "opening_script_hint": "Warm greeting; ask how you can help.",
  "verification_policy": "Collect only what is needed per policy; never ask for secrets.",
  "off_topic_behavior": "answer_briefly_then_return",
  "tool_policy": "Prefer search_knowledge for facts; use appointments tools when relevant.",
  "exit_conditions": "Issue resolved or user is satisfied; then thank them and call end_voice_session."
}`;

export default function BotConfig() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isCreateMode = !id;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const [models, setModels] = React.useState<{ id: string, name: string }[]>([]);
  const [voices, setVoices] = React.useState<{ id: string, name: string, provider: string }[]>([]);
  const [workflows, setWorkflows] = React.useState<{ id: string, name: string }[]>([]);

  const [formData, setFormData] = React.useState<Partial<Bot>>({
    name: '',
    role: '',
    persona: '',
    system_prompt: '',
    greeting: '',
    llm_model: '',
    voice_id: '',
    tools_enabled: [],
    temperature: 0.7,
    max_tokens: 2048,
    icon: 'bot',
    color: 'primary',
    workflow_id: '',
    pipeline_mode: 'classic',
    escalate_webhook_url: '',
    actions_webhook_url: '',
    post_call_webhook_url: '',
    min_stt_confidence: 0.6,
    topic_restriction: '',
    refuse_off_topic: false,
  });

  const [policyDraft, setPolicyDraft] = React.useState({
    guardrail: '{}',
    data_access: '{}',
    conversation: '{}',
    agent_task_spec: '{}',
  });

  React.useEffect(() => {
    async function loadData() {
      try {
        const [modelsData, voicesData, workflowData] = await Promise.all([
          api.getModels(),
          api.getVoices(),
          api.getWorkflows()
        ]);
        setModels(modelsData);
        setVoices(voicesData);
        setWorkflows(workflowData);

        if (!isCreateMode && id) {
          const botData = await api.getBot(id);
          setFormData({
            ...botData,
            pipeline_mode: botData.pipeline_mode || 'classic',
          });
          setPolicyDraft({
            guardrail: JSON.stringify(botData.guardrail_policy || {}, null, 2),
            data_access: JSON.stringify(botData.data_access_policy || {}, null, 2),
            conversation: JSON.stringify(botData.conversation_policy || {}, null, 2),
            agent_task_spec: JSON.stringify(botData.agent_task_spec || {}, null, 2),
          });
        } else {
          // Set sensible defaults for Create Mode 
          if (modelsData.length > 0) {
            setFormData(prev => ({ ...prev, llm_model: modelsData[0].id }));
          }
          if (voicesData.length > 0) {
            setFormData(prev => ({ ...prev, voice_id: voicesData[0].id }));
          }
        }
      } catch (err) {
        console.error('Failed to load bot config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isCreateMode]);

  const handleSave = async () => {
    if (isCreateMode && (!formData.name || !formData.system_prompt)) {
      alert('Name and System Instructions are required');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      let guardrail_policy: Record<string, unknown> = {};
      let data_access_policy: Record<string, unknown> = {};
      let conversation_policy: Record<string, unknown> = {};
      let agent_task_spec: Record<string, unknown> = {};

      try { guardrail_policy = JSON.parse(policyDraft.guardrail); } catch { alert('Invalid JSON in Guardrail policy'); setSaving(false); return; }
      try { data_access_policy = JSON.parse(policyDraft.data_access); } catch { alert('Invalid JSON in Data access policy'); setSaving(false); return; }
      try { conversation_policy = JSON.parse(policyDraft.conversation); } catch { alert('Invalid JSON in Conversation policy'); setSaving(false); return; }
      try { agent_task_spec = JSON.parse(policyDraft.agent_task_spec); } catch { alert('Invalid JSON in agent_task_spec'); setSaving(false); return; }

      const wf = formData.workflow_id?.trim();
      const finalData = {
        ...formData,
        workflow_id: wf ? wf : null,
        guardrail_policy,
        data_access_policy,
        conversation_policy,
        agent_task_spec,
        persona: formData.persona || formData.role || 'helpful AI assistant',
        description: formData.description || `AI agent specializing in ${formData.role || 'general tasks'}`,
      };

      if (isCreateMode) {
        await api.createBot(finalData);
        navigate('/personas');
      } else if (id) {
        await api.updateBot(id, finalData);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      tools_enabled: prev.tools_enabled?.includes(tool)
        ? prev.tools_enabled.filter(t => t !== tool)
        : [...(prev.tools_enabled || []), tool]
    }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 text-primary animate-spin" />
          <p className="text-on-surface-variant font-medium animate-pulse">Loading Neural Configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col  bg-background text-on-surface">
      {/* Focused Header */}
      <header className="h-20 flex items-center justify-between px-10 glass-panel sticky top-0 z-50 border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/personas')}
            className="size-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="font-headline font-extrabold text-2xl tracking-tight text-on-surface">
              {isCreateMode ? (
                <>Create <span className="text-primary">New Bot</span></>
              ) : (
                <>Bot Config: <span className="text-primary">{formData.name}</span></>
              )}
            </h1>
            <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">
              {isCreateMode ? 'Bot Factory • Neural Synthesis' : formData.role || 'Enterprise Support Tier'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/personas')}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:text-on-surface ghost-border transition-all"
          >
            {isCreateMode ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2",
              saveSuccess
                ? "bg-green-500/10 text-green-500 border border-green-500/20"
                : "ember-gradient text-on-primary-fixed shadow-primary/10 hover:shadow-primary/20",
              saving && "opacity-50 cursor-not-allowed"
            )}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="size-4" />
            ) : isCreateMode ? (
              <Sparkles className="size-4" />
            ) : null}
            {saving
              ? (isCreateMode ? 'Synthesizing...' : 'Saving...')
              : saveSuccess ? 'Saved!'
                : isCreateMode ? 'Initialize Bot' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Editor Grid */}
      <div className="p-10 grid grid-cols-12 gap-10 max-w-[1600px] mx-auto w-full">
        {/* Left Column (Persona & Instructions) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          {/* Persona Section */}
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <UserRoundPen className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Persona & Instructions</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Identity Name</label>
                <input
                  className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 w-full focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Core Role</label>
                <input
                  className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 w-full focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                  type="text"
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">System Prompt</label>
              <div className="relative">
                <textarea
                  className="w-full h-80 bg-surface-container-highest border border-outline-variant/10 font-mono text-sm leading-relaxed p-6 rounded-2xl resize-none text-primary/90 focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                  spellCheck="false"
                  value={formData.system_prompt}
                  onChange={e => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                />
                <div className="absolute top-4 right-4 text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest">Neural Logic Matrix</div>
              </div>
            </div>
          </section>

          {/* Greeting Section */}
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <MessageSquareText className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Initial Greeting Message</h3>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">First Contact String</label>
              <textarea
                className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary w-full focus:ring-1 focus:ring-primary/30 min-h-14 transition-all hover:bg-surface-container-high"
                rows={1}
                value={formData.greeting}
                onChange={e => setFormData(prev => ({ ...prev, greeting: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Proactive Silence Prompts</label>
                <span className="text-[10px] text-on-surface-variant/60 font-medium italic">One per line</span>
              </div>
              <textarea
                className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary w-full focus:ring-1 focus:ring-primary/30 min-h-32 transition-all hover:bg-surface-container-high"
                placeholder="Are you still there?&#10;I'm here whenever you're ready."
                value={(formData.proactive_prompts || []).join('\n')}
                onChange={e => {
                  const lines = e.target.value.split('\n').filter(l => l.trim() !== '');
                  setFormData(prev => ({ ...prev, proactive_prompts: lines }));
                }}
              />
            </div>
          </section>
        </div>

        {/* Right Column (Config & Advanced) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          {/* Model & Voice */}
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <Settings2 className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Model & Voice</h3>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">LLM Engine</label>
                <div className="relative">
                  <select
                    className="appearance-none w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 pr-10 font-medium text-on-surface h-14 cursor-pointer focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
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
              <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/10">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">TTS Engine Profile</label>
                <div className="relative">
                  <select
                    className="appearance-none w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 pr-10 font-medium text-primary h-14 cursor-pointer focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                    value={formData.voice_id}
                    onChange={e => {
                      const vid = e.target.value;
                      const voice = voices.find(v => v.id === vid);
                      setFormData(prev => ({
                        ...prev,
                        voice_id: vid,
                        tts_provider: voice?.provider === 'elevenlabs' ? 'elevenlabs' : (prev.tts_provider === 'elevenlabs' ? 'deepgram_ws' : prev.tts_provider)
                      }));
                    }}
                  >
                    {voices.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant size-5" />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/10">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">TTS Provider</label>
                <select
                  className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 cursor-pointer focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed"
                  value={formData.tts_provider || 'deepgram_ws'}
                  onChange={e => setFormData(prev => ({ ...prev, tts_provider: e.target.value }))}
                >
                  <option
                    value="deepgram_ws"
                    disabled={voices.find(v => v.id === formData.voice_id)?.provider === 'elevenlabs'}
                  >
                    Deepgram (Websocket)
                  </option>
                  <option
                    value="deepgram_http"
                    disabled={voices.find(v => v.id === formData.voice_id)?.provider === 'elevenlabs'}
                  >
                    Deepgram (HTTP)
                  </option>
                  <option
                    value="elevenlabs"
                    disabled={voices.find(v => v.id === formData.voice_id)?.provider === 'deepgram'}
                  >
                    ElevenLabs (Multilingual)
                  </option>
                </select>
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/10">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Default Language</label>
                <select
                  className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 cursor-pointer focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                  value={formData.default_language || 'hi'}
                  onChange={e => setFormData(prev => ({ ...prev, default_language: e.target.value }))}
                >
                  <option value="hi">Hindi (hi)</option>
                  <option value="en">English (en)</option>
                  <option value="hi-en">Hinglish (Mixed)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/10">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">
                  Logic workflow binding <span className="font-normal normal-case text-on-surface-variant/70">(optional)</span>
                </label>
                <div className="relative">
                  <select
                    className="appearance-none w-full bg-surface-container-highest border border-outline-variant/20 rounded-2xl p-4 pr-10 font-medium text-primary h-14 cursor-pointer focus:ring-1 focus:ring-primary/40 transition-all hover:bg-surface-container-high"
                    value={formData.workflow_id || ''}
                    onChange={e => setFormData(prev => ({ ...prev, workflow_id: e.target.value || undefined }))}
                  >
                    <option value="">None — standard LLM autonomy (recommended default)</option>
                    {workflows.map(wf => (
                      <option key={wf.id} value={wf.id}>{wf.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant size-5" />
                </div>
                <p className="text-[10px] text-on-surface-variant px-2 leading-relaxed">
                  <span className="font-semibold text-on-surface/80">Not required.</span> Leave unset for normal voice agents. Attach a workflow only when you need a fixed script or branching graph from the Workflow Editor.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/10">
                <label className="text-xs font-bold uppercase tracking-widest text-primary px-1">Voice pipeline</label>
                <select
                  className="w-full bg-surface-container-highest border border-primary/20 rounded-2xl p-4 font-bold text-primary h-14 cursor-pointer transition-all hover:bg-surface-container-high"
                  value={formData.pipeline_mode || 'classic'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pipeline_mode: e.target.value }))}
                >
                  <option value="classic">Classic (STT → LLM → TTS)</option>
                  <option value="speech_speech">Speech-to-speech (falls back to classic until provider wired)</option>
                  <option value="gemini_s2s">Gemini speech-to-speech (Gemini Live STS)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Policies (JSON, editable — no secrets in DB; use env refs in URLs) */}
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <Settings2 className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Guardrails &amp; data rules</h3>
            </div>
            <p className="text-xs text-on-surface-variant">
              Example keys: guardrail — <code className="text-primary/80">reject_on_pii</code>,{' '}
              <code className="text-primary/80">injection_check_enabled</code>,{' '}
              <code className="text-primary/80">kb_only_factual</code>,{' '}
              <code className="text-primary/80">semantic_cache_ttl_seconds</code>. Data access —{' '}
              <code className="text-primary/80">enabled_scopes</code> (knowledge, appointments, weather, user_memory),{' '}
              <code className="text-primary/80">integrations.weather.url_template</code> with{' '}
              <code className="text-primary/80">{'{city}'}</code> and env placeholders like OPENWEATHER_API_KEY in the URL.
            </p>
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase text-on-surface-variant">guardrail_policy</label>
              <textarea
                className="w-full min-h-[120px] font-mono text-xs bg-surface-container-highest border border-outline-variant/20 rounded-xl p-3 text-primary transition-all hover:bg-surface-container-high"
                value={policyDraft.guardrail}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, guardrail: e.target.value }))}
              />
              <label className="text-[10px] font-bold uppercase text-on-surface-variant">data_access_policy</label>
              <textarea
                className="w-full min-h-[120px] font-mono text-xs bg-surface-container-highest border border-outline-variant/20 rounded-xl p-3 text-primary transition-all hover:bg-surface-container-high"
                value={policyDraft.data_access}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, data_access: e.target.value }))}
              />
              <label className="text-[10px] font-bold uppercase text-on-surface-variant">conversation_policy</label>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                <code className="text-primary/80">silence_threshold_ms</code>,{' '}
                <code className="text-primary/80">interrupt_aware_reply</code>,{' '}
                <code className="text-primary/80">max_tts_buffer_chars</code> (default 200; higher = fewer TTS segments).{' '}
                Smooth speech: <code className="text-primary/80">tts_flush_mode</code>{' '}
                <code>balanced</code> (flush on commas) | <code>sentence_only</code> (default, fewer mid-phrase cuts);{' '}
                <code className="text-primary/80">tts_streaming_mode</code> <code>chunked</code> |{' '}
                <code>whole_turn</code>; <code className="text-primary/80">tts_pipeline_llm</code> default{' '}
                <code>true</code> (chunked: LLM runs ahead of TTS, less dead air).
              </p>
              <textarea
                className="w-full min-h-[100px] font-mono text-xs bg-surface-container-highest border border-outline-variant/20 rounded-xl p-3 text-primary transition-all hover:bg-surface-container-high"
                value={policyDraft.conversation}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, conversation: e.target.value }))}
              />
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border border-primary/20">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Self-Driving Guardrails (Auto-RAG)</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Define the expertise boundary. If <code className="text-primary/80">Strict Refusal</code> is on, the bot will politely decline any query that is not semantically related to the focus topic.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Domain Focus Topic</label>
                <input
                  className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 w-full focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                  type="text"
                  placeholder="e.g. Indian Personal Banking"
                  value={formData.topic_restriction || ''}
                  onChange={e => setFormData(prev => ({ ...prev, topic_restriction: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Enforcement</label>
                <label className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10 cursor-pointer hover:bg-surface-container-high transition-colors h-14 group">
                  <span className="text-sm font-bold text-on-surface-variant group-hover:text-primary">Strict Topic Refusal</span>
                  <input
                    checked={formData.refuse_off_topic || false}
                    onChange={e => setFormData(prev => ({ ...prev, refuse_off_topic: e.target.checked }))}
                    className="rounded border-outline-variant bg-surface-variant text-primary focus:ring-primary/20 size-6"
                    type="checkbox"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <ClipboardList className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Task contract (agent_task_spec)</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Optional JSON appended to the system prompt for any outbound or goal-driven voice agent (not bank-specific).
              For polite hangup and server WebSocket close, enable the <code className="text-primary/80">end_voice_session</code>{' '}
              capability below and ask the model to say goodbye before calling that tool.
              Pair with <code className="text-primary/80">kb_only_factual</code> in guardrails when stating amounts or due dates.
              For Alexa-style clarity, keep <code className="text-primary/80">system_prompt</code> short sentences; pick a natural{' '}
              <code className="text-primary/80">voice_id</code> (e.g. Aura/ElevenLabs presets); tune smooth TTS in{' '}
              <code className="text-primary/80">conversation_policy</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs font-bold px-3 py-2 rounded-xl bg-primary/15 text-primary border border-primary/25"
                onClick={() =>
                  setPolicyDraft((p) => ({ ...p, agent_task_spec: AGENT_TASK_OUTBOUND_EXAMPLE }))
                }
              >
                Load outbound reminder template
              </button>
              <button
                type="button"
                className="text-xs font-bold px-3 py-2 rounded-xl bg-surface-container-highest border border-outline-variant/30 text-on-surface"
                onClick={() =>
                  setPolicyDraft((p) => ({ ...p, agent_task_spec: AGENT_TASK_INBOUND_EXAMPLE }))
                }
              >
                Load inbound support template
              </button>
              <button
                type="button"
                className="text-xs font-bold px-3 py-2 rounded-xl bg-surface-container-highest border border-outline-variant/30 text-on-surface"
                onClick={() => setPolicyDraft((p) => ({ ...p, agent_task_spec: '{}' }))}
              >
                Clear
              </button>
            </div>
            <textarea
              className="w-full min-h-[200px] font-mono text-xs bg-surface-container-highest border border-outline-variant/20 rounded-xl p-3 text-primary transition-all hover:bg-surface-container-high"
              value={policyDraft.agent_task_spec}
              onChange={(e) => setPolicyDraft((p) => ({ ...p, agent_task_spec: e.target.value }))}
              spellCheck={false}
            />
          </section>

          {/* Tools & Capabilities */}
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wrench className="size-5 text-primary" />
                <h3 className="font-headline font-bold text-lg">Capabilities</h3>
              </div>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded tracking-tighter uppercase">{formData.tools_enabled?.length || 0} Active</span>
            </div>
            <div className="space-y-3">
              <CapabilityToggle icon={Search} label="search_knowledge" checked={formData.tools_enabled?.includes('search_knowledge')} onChange={() => toggleTool('search_knowledge')} />
              <CapabilityToggle icon={CalendarPlus} label="book_appointment" checked={formData.tools_enabled?.includes('book_appointment')} onChange={() => toggleTool('book_appointment')} />
              <CapabilityToggle icon={CalendarDays} label="get_appointments" checked={formData.tools_enabled?.includes('get_appointments')} onChange={() => toggleTool('get_appointments')} />
              <CapabilityToggle icon={BrainCircuit} label="remember_user_fact" checked={formData.tools_enabled?.includes('remember_user_fact')} onChange={() => toggleTool('remember_user_fact')} />
              <CapabilityToggle icon={Cloud} label="get_weather" checked={formData.tools_enabled?.includes('get_weather')} onChange={() => toggleTool('get_weather')} />
              <CapabilityToggle icon={PhoneOff} label="end_voice_session" checked={formData.tools_enabled?.includes('end_voice_session')} onChange={() => toggleTool('end_voice_session')} />
              <CapabilityToggle icon={ShieldCheck} label="verify_customer" checked={formData.tools_enabled?.includes('verify_customer')} onChange={() => toggleTool('verify_customer')} />
              <CapabilityToggle icon={Wallet} label="get_account_balance" checked={formData.tools_enabled?.includes('get_account_balance')} onChange={() => toggleTool('get_account_balance')} />
              <CapabilityToggle icon={Receipt} label="get_loan_status" checked={formData.tools_enabled?.includes('get_loan_status')} onChange={() => toggleTool('get_loan_status')} />
            </div>
          </section>

          {/* Integrations & Webhooks */}
          <section className="glass-panel rounded-3xl p-8 flex flex-col gap-6 ghost-border">
            <div className="flex items-center gap-3">
              <Webhook className="size-5 text-primary" />
              <h3 className="font-headline font-bold text-lg">Integrations &amp; Webhooks</h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Escalation Webhook URL</label>
              <input
                className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 w-full focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                type="url"
                placeholder="https://your-crm.example.com/escalate"
                value={formData.escalate_webhook_url || ''}
                onChange={e => setFormData(prev => ({ ...prev, escalate_webhook_url: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant px-2">
                POST fired with <code className="text-primary/80">{"{ session_id, transcript, reason }"}</code> when user requests a human agent.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Actions Webhook URL</label>
              <input
                className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 w-full focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                type="url"
                placeholder="https://your-service.example.com/actions"
                value={formData.actions_webhook_url || ''}
                onChange={e => setFormData(prev => ({ ...prev, actions_webhook_url: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant px-2">
                Receives SMS/email action payloads from workflow action nodes.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant px-1">Post-Call Webhook URL</label>
              <input
                className="bg-surface-container-highest border border-outline-variant/10 rounded-2xl p-4 font-medium text-primary h-14 w-full focus:ring-1 focus:ring-primary/30 transition-all hover:bg-surface-container-high"
                type="url"
                placeholder="https://your-service.example.com/post-call"
                value={formData.post_call_webhook_url || ''}
                onChange={e => setFormData(prev => ({ ...prev, post_call_webhook_url: e.target.value }))}
              />
              <p className="text-[10px] text-on-surface-variant px-2">
                Receives <code className="text-primary/80">{"{ session_id, summary, intent }"}</code> after every session ends.
              </p>
            </div>

            <div className="flex flex-col gap-4 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Min STT Confidence</label>
                <span className="font-mono text-sm text-primary">{(formData.min_stt_confidence ?? 0.6).toFixed(2)}</span>
              </div>
              <input
                className="w-full custom-range cursor-pointer"
                max="1" min="0" step="0.05" type="range"
                value={formData.min_stt_confidence ?? 0.6}
                onChange={e => setFormData(prev => ({ ...prev, min_stt_confidence: parseFloat(e.target.value) }))}
              />
              <p className="text-[10px] text-on-surface-variant px-2">
                Below this threshold on short utterances, the bot asks the caller to repeat.
              </p>
            </div>
          </section>

          {/* Advanced Params */}
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
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold uppercase opacity-50">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
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
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold uppercase opacity-50">
                  <span>Short</span>
                  <span>Extensive</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer Visual Relief Spacing */}
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
        checked={checked}
        onChange={onChange}
        className="rounded border-outline-variant bg-surface-variant text-primary focus:ring-primary/20 size-5"
        type="checkbox"
      />
    </label>
  );
}
