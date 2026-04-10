import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { ArrowLeft, ArrowRight, Bot, Loader2, Sparkles } from 'lucide-react';

type Preset = {
  key: string;
  title: string;
  tags: string[];
  default_language: 'hi' | 'en';
  persona: string;
  system_prompt: string;
  tts_provider?: string;
};

const PRESETS: Preset[] = [
  {
    key: 'female_hi_soft_focus',
    title: 'Female · Hindi · Soft · Focus',
    tags: ['female', 'hindi', 'soft', 'focused'],
    default_language: 'hi',
    persona: 'A calm, focused, soft-spoken female Hindi voice agent. Polite, efficient, and empathetic.',
    system_prompt:
      'You are a calm, focused female Hindi voice agent. Speak briefly and clearly. Ask one question at a time. Confirm key details. End with clear next steps.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'female_en_hard_direct',
    title: 'Female · English · Hard · Direct',
    tags: ['female', 'english', 'direct', 'firm'],
    default_language: 'en',
    persona: 'A firm, direct female English voice agent. No fluff; outcome-oriented.',
    system_prompt:
      'You are a firm, direct English voice agent. Be concise. Drive the conversation to a resolution with clear options. Avoid filler.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'male_hi_soft_empathy',
    title: 'Male · Hindi · Soft · Empathetic',
    tags: ['male', 'hindi', 'soft', 'empathetic'],
    default_language: 'hi',
    persona: 'An empathetic male Hindi voice agent. Patient, reassuring, and helpful.',
    system_prompt:
      'You are an empathetic male Hindi voice agent. Acknowledge feelings, reassure, then ask focused questions. Keep responses short.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'male_en_soft_support',
    title: 'Male · English · Soft · Support',
    tags: ['male', 'english', 'support', 'gentle'],
    default_language: 'en',
    persona: 'A gentle male English support agent. Friendly and helpful, with structured troubleshooting.',
    system_prompt:
      'You are a gentle English support agent. Ask clarifying questions, provide step-by-step guidance, confirm outcomes, and summarize next steps.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'female_hi_hard_collection',
    title: 'Female · Hindi · Hard · Collections',
    tags: ['female', 'hindi', 'firm', 'collections'],
    default_language: 'hi',
    persona: 'A firm female Hindi collections agent. Polite but assertive.',
    system_prompt:
      'You are a firm Hindi collections agent. Verify identity, state the issue clearly, offer payment options, handle objections briefly, and close with an action.',
    tts_provider: 'elevenlabs',
  },
  {
    key: 'female_en_soft_sales',
    title: 'Female · English · Soft · Sales',
    tags: ['female', 'english', 'sales', 'warm'],
    default_language: 'en',
    persona: 'A warm female English sales agent. Curious, confident, and persuasive.',
    system_prompt:
      'You are a warm English sales agent. Discover needs, highlight benefits, handle objections, and propose the next step. Keep it short and confident.',
    tts_provider: 'elevenlabs',
  },
];

export default function DiyPersonaPresets() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get('return') || '/diy-with-ai';

  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);

  const createdLink = useMemo(() => {
    if (!createdBotId) return null;
    const url = new URL(returnTo, window.location.origin);
    url.searchParams.set('bot_id', createdBotId);
    return `${url.pathname}${url.search}`;
  }, [createdBotId, returnTo]);

  const createFromPreset = async (p: Preset) => {
    setError(null);
    setCreatedBotId(null);
    setCreatingKey(p.key);
    try {
      const name = `DIY · ${p.title}`;
      const res = await api.createBot({
        name,
        description: 'Created from DIY With AI persona preset.',
        role: 'Voice Agent',
        persona: p.persona,
        system_prompt: p.system_prompt,
        llm_provider: 'gemini',
        llm_model: 'gemini-2.0-flash-001',
        tts_provider: p.tts_provider,
        default_language: p.default_language,
        tools_enabled: ['search_knowledge', 'book_appointment', 'get_appointments', 'remember_user_fact'],
        temperature: 0.7,
        max_tokens: 2048,
        is_active: true,
      });
      const id = res?.id || res?.bot?.id;
      if (!id) throw new Error('Bot create did not return id');
      setCreatedBotId(String(id));
    } catch (e: any) {
      setError(e?.message || 'Failed to create persona.');
    } finally {
      setCreatingKey(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="DIY With AI · Persona presets"
        subtitle="Create one of the 6 recommended personas."
        actions={
          <button
            onClick={() => navigate(returnTo)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-low ghost-border text-xs font-bold hover:bg-surface-high transition-all"
          >
            <ArrowLeft className="size-4" />
            Back to DIY
          </button>
        }
      />

      <div className="p-6 lg:p-10 max-w-5xl w-full">
        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {createdLink && (
          <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-on-surface">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Persona created. Return to DIY and select it.
              </div>
              <button
                onClick={() => navigate(createdLink)}
                className="inline-flex items-center gap-2 rounded-xl ember-gradient px-4 py-2 text-xs font-bold text-on-primary-fixed"
              >
                Go to DIY
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <div key={p.key} className="rounded-3xl ghost-border bg-surface-low p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-headline text-lg font-bold">{p.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full border border-outline-variant/20 bg-surface-highest px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-outline">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Bot className="size-5" />
                </div>
              </div>

              <p className="mt-4 text-sm text-on-surface-variant leading-relaxed">
                {p.persona}
              </p>

              <div className="mt-5">
                <button
                  onClick={() => void createFromPreset(p)}
                  disabled={creatingKey === p.key}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-2 rounded-2xl ember-gradient px-4 py-3 text-xs font-bold text-on-primary-fixed',
                    creatingKey === p.key && 'opacity-70 cursor-not-allowed',
                  )}
                >
                  {creatingKey === p.key ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Create persona
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

