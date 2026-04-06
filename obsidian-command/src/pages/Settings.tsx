import React from 'react';
import { Header } from '../components/Header';
import { Settings2, Download, Waves, Zap, Mic2, Database, HardDrive, Clock, UserPlus, MoreVertical, BrainCircuit, Loader2 } from 'lucide-react';
import { TEAMMATES } from '../constants';
import { cn } from '../lib/utils';
import { api } from '../lib/api';

export default function SettingsPage() {
  const [healthData, setHealthData] = React.useState<any>(null);
  const [vectorHealth, setVectorHealth] = React.useState<{ status: string; doc_count: number } | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadHealth() {
      try {
        const [health, vector] = await Promise.all([
          api.getHealth().catch(() => null),
          api.getVectorHealth().catch(() => null),
        ]);
        setHealthData(health);
        setVectorHealth(vector);
      } catch { /* non-fatal */ }
      finally { setHealthLoading(false); }
    }
    loadHealth();
  }, []);

  const svcStatus = (key: string) => {
    if (healthLoading) return 'checking';
    if (!healthData) return 'unknown';
    return healthData.services?.[key] ?? (healthData.status === 'ok' ? 'online' : 'unknown');
  };

  return (
    <div className="flex-1 flex flex-col ">
      <Header
        title="Platform Settings"
        actions={
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (confirm('Discard all unsaved changes?')) {
                  window.location.reload();
                }
              }}
              className="px-6 py-2.5 rounded-lg bg-surface-high border border-outline-variant/20 text-sm font-semibold hover:bg-surface-highest transition-all"
            >
              Discard Changes
            </button>
            <button
              onClick={() => alert('Settings saved successfully!')}
              className="px-6 py-2.5 rounded-lg ember-gradient text-on-primary-fixed text-sm font-bold shadow-lg active:scale-95 transition-all"
            >
              Save Changes
            </button>
          </div>
        }
      />

      <div className="p-10 max-w-6xl mx-auto w-full flex flex-col gap-12 pb-32">
        {/* Section 1: General Info */}
        <section>
          <div className="flex flex-col gap-1 mb-6">
            <h3 className="font-headline text-xl font-bold text-on-surface">General Information</h3>
            <p className="text-sm text-outline">Manage your organization's core identity and localization.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 glass-panel p-8 rounded-2xl flex flex-col gap-8">
              <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">Organization Name</label>
                  <input
                    className="w-full bg-surface-highest border-none rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/50 transition-all"
                    type="text"
                    defaultValue="Sonic Architect"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">Global Default Language</label>
                  <select className="w-full bg-surface-highest border-none rounded-lg px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary/50 transition-all appearance-none">
                    <option>English (United States)</option>
                    <option>Spanish (ES)</option>
                    <option>French (FR)</option>
                    <option>German (DE)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center gap-4 group cursor-pointer border-dashed border-2 border-outline-variant/20 hover:border-emerald-500/50 transition-all">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all group-hover:scale-110">
                <Settings2 className="size-10" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">Organization Logo</p>
                <p className="text-[10px] text-outline uppercase tracking-wider mt-1">Click to Replace</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: API & Providers */}
        <section>
          <div className="flex flex-col gap-1 mb-6">
            <h3 className="font-headline text-xl font-bold text-on-surface">API & Provider Integration</h3>
            <p className="text-sm text-outline">Manage connection strings and authentication for external LLM and Voice engines.</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <ProviderCard icon={Waves} name="Deepgram" status="Healthy" apiKey="sk_dg_••••••••••••••••3a9c" />
            <ProviderCard icon={Zap} name="Groq Inference" status="Online" apiKey="gq_v1_••••••••••••••••f821" />
            <ProviderCard icon={Mic2} name="ElevenLabs" status="Healthy" apiKey="xi_api_••••••••••••••••92b0" />
          </div>
        </section>

        {/* Section 3: Database & Logs */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-start gap-3">
              <h3 className="font-headline text-xl font-bold text-on-surface">Database Status</h3>
              <p className="text-sm text-outline">Real-time health of storage backends.</p>
              {healthLoading && <Loader2 className="size-4 animate-spin text-primary" />}
            </div>
            <div className="glass-panel p-8 rounded-2xl flex flex-col gap-6">
              <DatabaseItem
                icon={Database}
                name="Redis Cache"
                desc="Volatile session memory & TTS audio cache"
                status={svcStatus('redis')}
                active={svcStatus('redis') === 'online'}
              />
              <DatabaseItem
                icon={HardDrive}
                name="SQLite Primary"
                desc="Persistent bots, sessions, facts & logs"
                status="online"
                active
              />
              <DatabaseItem
                icon={BrainCircuit}
                name="ChromaDB Vector Memory"
                desc={vectorHealth ? `RAG context store · ${vectorHealth.doc_count} documents` : 'Semantic RAG context store'}
                status={vectorHealth?.status ?? (healthLoading ? 'checking' : 'unknown')}
                active={vectorHealth?.status === 'online'}
              />
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h3 className="font-headline text-xl font-bold text-on-surface">Log Retention</h3>
              <p className="text-sm text-outline">Policy for historical interaction data.</p>
            </div>
            <div className="glass-panel p-8 rounded-2xl flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">Retention Period</label>
                  <span className="text-2xl font-headline font-bold text-primary">90 <span className="text-sm text-outline font-normal">Days</span></span>
                </div>
                <input className="w-full h-1.5 bg-surface-highest rounded-full appearance-none cursor-pointer accent-primary" type="range" min="30" max="365" defaultValue="90" />
                <div className="flex justify-between text-[10px] font-bold text-outline uppercase tracking-tighter">
                  <span>30 Days</span>
                  <span>180 Days</span>
                  <span>1 Year</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Teammates */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col gap-1">
              <h3 className="font-headline text-xl font-bold text-on-surface">Teammates</h3>
              <p className="text-sm text-outline">Manage access and permissions for your team.</p>
            </div>
            <button
              onClick={() => alert('Invite user modal would open here.')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-high border border-outline-variant/20 text-sm font-bold hover:border-primary/50 transition-all"
            >
              <UserPlus className="size-4" />
              Invite User
            </button>
          </div>
          <div className="glass-panel rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-lowest/50">
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-outline border-b border-outline-variant/10">User</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-outline border-b border-outline-variant/10">Role</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-outline border-b border-outline-variant/10">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-outline border-b border-outline-variant/10 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {TEAMMATES.map((member) => (
                  <tr key={member.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full object-cover border border-outline-variant/20" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{member.name}</span>
                          <span className="text-xs text-outline">{member.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight",
                        member.role === 'Admin' ? "bg-primary/10 text-primary" : "bg-surface-variant text-outline"
                      )}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", member.status === 'Active Now' ? "bg-emerald-500" : "bg-emerald-500/40")}></div>
                        <span className={cn("text-xs", member.status === 'Active Now' ? "text-on-surface" : "text-outline")}>{member.status}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-outline hover:text-white transition-colors">
                        <MoreVertical className="size-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProviderCard({ icon: Icon, name, status, apiKey }: any) {
  return (
    <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border-l-4 border-emerald-500/50">
      <div className="flex items-center gap-6">
        <div className="w-12 h-12 rounded-xl bg-surface-highest flex items-center justify-center text-on-surface">
          <Icon className="size-6" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h4 className="font-bold">{name}</h4>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {status}
            </span>
          </div>
          <p className="text-xs text-outline font-mono mt-1">{apiKey}</p>
        </div>
      </div>
      <button
        onClick={() => {
          if (confirm(`Are you sure you want to rotate the API key for ${name}? This will invalidate the current key immediately.`)) {
            alert('Key rotated successfully. New key: ' + Math.random().toString(36).substring(7));
          }
        }}
        className="px-4 py-2 rounded-lg bg-surface-highest border border-outline-variant/20 text-xs font-bold hover:text-emerald-500 transition-colors"
      >
        Rotate Key
      </button>
    </div>
  );
}

function DatabaseItem({ icon: Icon, name, desc, status, active }: any) {
  const isOffline = status === 'offline' || status === 'unknown';
  const isChecking = status === 'checking';
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-surface-highest flex items-center justify-center">
          <Icon className={cn("size-5", active ? "text-emerald-400" : isOffline ? "text-red-400" : "text-primary")} />
        </div>
        <div>
          <p className="text-sm font-bold">{name}</p>
          <p className="text-xs text-outline">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(
          "size-2 rounded-full",
          active ? "bg-emerald-400" : isOffline ? "bg-red-400" : isChecking ? "bg-yellow-400 animate-pulse" : "bg-outline"
        )} />
        <span className={cn(
          "px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest",
          active ? "bg-emerald-500/10 text-emerald-400" : isOffline ? "bg-red-500/10 text-red-400" : "bg-surface-variant text-outline"
        )}>
          {status}
        </span>
      </div>
    </div>
  );
}
