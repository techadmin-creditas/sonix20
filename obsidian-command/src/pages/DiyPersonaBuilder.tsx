import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { api, DiyPersonaDraft } from '../lib/api';
import { cn } from '../lib/utils';
import { Angry, ArrowRight, Focus, Loader2, Smile, Sparkles, UserRound, Wand2 } from 'lucide-react';

const STORAGE_KEY = 'diy.persona.draft';

function saveDraft(draft: DiyPersonaDraft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export default function DiyPersonaBuilder() {
  const nav = useNavigate();
  const [objective, setObjective] = useState('');
  const [domain, setDomain] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [tone, setTone] = useState('');
  const [constraints, setConstraints] = useState('');
  const [voices, setVoices] = useState<{ id: string; name: string; provider: string }[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DiyPersonaDraft | null>(null);
  const [llmUsed, setLlmUsed] = useState<string | null>(null);

  const canGenerate = useMemo(() => objective.trim().length >= 8 && !loading, [objective, loading]);

  useEffect(() => {
    let mounted = true;
    async function loadVoices() {
      setVoicesLoading(true);
      try {
        const v = await api.getVoices();
        if (!mounted) return;
        setVoices(v || []);
        // Default-select first ElevenLabs voice if available.
        const eleven = (v || []).find((x) => String(x.provider).toLowerCase() === 'elevenlabs');
        if (eleven && !selectedVoiceId) setSelectedVoiceId(eleven.id);
      } catch {
        // ignore; voice selection is optional
      } finally {
        if (mounted) setVoicesLoading(false);
      }
    }
    void loadVoices();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVoice = useMemo(() => voices.find((v) => v.id === selectedVoiceId) || null, [voices, selectedVoiceId]);

  const generate = async () => {
    if (!canGenerate) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.generateDiyPersona({
        objective: objective.trim(),
        domain: domain.trim() || undefined,
        language,
        tone: tone.trim() || undefined,
        constraints: constraints.trim() || undefined,
      });
      const withVoice: DiyPersonaDraft = {
        ...res.persona,
        voice_id: selectedVoice?.id || undefined,
        voice_name: selectedVoice?.name || undefined,
        voice_provider: selectedVoice?.provider || undefined,
      };
      setDraft(withVoice);
      setLlmUsed(res.llm_used);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate persona');
    } finally {
      setLoading(false);
    }
  };

  const useInDiy = () => {
    if (!draft) return;
    // Ensure we persist the currently selected voice.
    const out: DiyPersonaDraft = {
      ...draft,
      voice_id: selectedVoice?.id || draft.voice_id,
      voice_name: selectedVoice?.name || draft.voice_name,
      voice_provider: selectedVoice?.provider || draft.voice_provider,
    };
    saveDraft(out);
    nav('/diy-with-ai');
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Persona Builder"
        subtitle="Generate a persona + system prompt using AI, then use it in a DIY live session."
      />

      <div className="p-6 lg:p-10 w-full">
        <div className="mx-auto w-full max-w-6xl grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
          <div className="bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-outline">
                <Sparkles className="size-4 text-primary" />
                Build a persona
              </div>
              <button
                onClick={() => nav('/diy-with-ai')}
                className="text-xs font-bold text-primary hover:opacity-90"
              >
                Back to DIY
              </button>
            </div>

            <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/40 p-5">
              <p className="text-sm font-bold">Input</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Describe the objective. We’ll generate persona + system prompt for the bot factory.
              </p>

              <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest text-outline">Objective</label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="mt-2 w-full min-h-[120px] rounded-xl border border-outline-variant/15 bg-surface-highest p-3 text-sm outline-none focus:border-primary/40"
                placeholder="Example: You are a bank collections agent for credit card bills. Verify identity, keep it concise, offer payment options, handle objections, end with a clear next step."
              />

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">Domain (optional)</label>
                  <input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-outline-variant/15 bg-surface-highest px-3 py-2.5 text-sm outline-none focus:border-primary/40"
                    placeholder="banking, support, sales…"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">Language</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-xs font-bold',
                        language === 'en' ? 'border-primary/35 bg-primary/10 text-primary' : 'border-outline-variant/15 bg-surface-highest',
                      )}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('hi')}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-xs font-bold',
                        language === 'hi' ? 'border-primary/35 bg-primary/10 text-primary' : 'border-outline-variant/15 bg-surface-highest',
                      )}
                    >
                      Hindi
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">Voice (for live calls)</label>
                <div className="mt-2 rounded-xl border border-outline-variant/15 bg-surface-highest px-3 py-2.5">
                  <select
                    value={selectedVoiceId}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                    aria-label="Select voice"
                    disabled={voicesLoading || voices.length === 0}
                  >
                    {voices.length === 0 ? (
                      <option value="">No voices available</option>
                    ) : (
                      voices
                        .filter((v) => String(v.provider).toLowerCase() === 'elevenlabs')
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.provider})
                          </option>
                        ))
                    )}
                  </select>
                </div>
                <p className="mt-2 text-[11px] text-on-surface-variant">
                  {voicesLoading ? 'Loading voices…' : 'This voice_id is saved into the bot config used for the live session.'}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">Tone (optional)</label>
                  <input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-outline-variant/15 bg-surface-highest px-3 py-2.5 text-sm outline-none focus:border-primary/40"
                    placeholder="soft, firm, warm, direct…"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">Constraints (optional)</label>
                  <input
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-outline-variant/15 bg-surface-highest px-3 py-2.5 text-sm outline-none focus:border-primary/40"
                    placeholder="short answers, verify facts, no legal advice…"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={generate}
                  disabled={!canGenerate}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl ember-gradient px-6 py-3 text-xs font-bold text-on-primary-fixed',
                    !canGenerate && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                  Generate persona
                </button>
                <button
                  onClick={useInDiy}
                  disabled={!draft}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-highest px-6 py-3 text-xs font-bold',
                    !draft && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  Use in DIY
                  <ArrowRight className="size-4" />
                </button>
              </div>
              {llmUsed && <p className="mt-3 text-[10px] text-outline font-mono">LLM: {llmUsed}</p>}
            </div>
          </div>

          <div className="bg-surface-low rounded-3xl ghost-border p-6 lg:p-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-outline">Preview</p>
              <div className="text-[10px] font-bold uppercase tracking-widest text-outline">Illustration</div>
            </div>

            <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/40 p-5">
              {/* Simple inline illustration (no external assets) */}
              <div className="rounded-2xl border border-outline-variant/10 bg-gradient-to-br from-primary/10 via-surface-high to-surface-highest p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold">{draft?.title || 'Your persona will appear here'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(draft?.tags || ['voice', 'agent', 'prompt']).slice(0, 8).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-outline-variant/20 bg-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-outline"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <PreviewAvatar label={draft?.title || ''} tags={draft?.tags || []} />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-outline-variant/10 bg-surface-highest/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline">Persona</p>
                    <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                      {draft?.persona || 'Generate to see persona.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-outline-variant/10 bg-surface-highest/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline">System prompt</p>
                    <p className="mt-2 text-sm text-on-surface-variant leading-relaxed line-clamp-6">
                      {draft?.system_prompt || 'Generate to see system prompt.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-outline">
                  <span>Language: {draft?.default_language || language}</span>
                  <span>
                    Voice: {draft?.voice_name || selectedVoice?.name || '—'}
                  </span>
                </div>
              </div>

              <p className="mt-4 text-xs text-on-surface-variant">
                This persona is used by the bot factory for the next live session.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewAvatar({ label, tags }: { label: string; tags: string[] }) {
  const text = `${label} ${(tags || []).join(' ')}`.toLowerCase();
  const isFemale = /\bfemale\b/.test(text);
  const isMale = /\bmale\b/.test(text);
  const style: 'soft' | 'firm' | 'focus' =
    /focus|focused/.test(text) ? 'focus' : /firm|direct|hard|collections/.test(text) ? 'firm' : 'soft';

  const AccentIcon = style === 'firm' ? Angry : style === 'focus' ? Focus : Smile;
  const badge = isFemale ? 'F' : isMale ? 'M' : 'AI';

  return (
    <div className="relative size-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
      <UserRound className="size-5" />
      <div className="absolute -bottom-1 -right-1 rounded-full border border-outline-variant/20 bg-surface-highest px-1.5 py-0.5 flex items-center gap-1 shadow-lg">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-on-surface">{badge}</span>
        <AccentIcon className="size-3 text-primary" />
      </div>
    </div>
  );
}

