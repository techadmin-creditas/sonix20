import React from 'react';
import { Header } from '../components/Header';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Shield, Calendar, Globe,
    Settings2, Key, Database, Bot as BotIcon, Activity,
    ExternalLink, LogOut, Verified, CreditCard,
    HardDrive, BrainCircuit, Loader2, Save, Check, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api, Bot, AuthUser } from '../lib/api';
import { useNotifications } from '../contexts/NotificationContext';

export default function Profile({ currentUser }: { currentUser: AuthUser }) {
    const { notifications } = useNotifications();
    const navigate = useNavigate();

    const [healthData, setHealthData] = React.useState<any>(null);
    const [vectorHealth, setVectorHealth] = React.useState<{ status: string; doc_count: number } | null>(null);
    const [healthLoading, setHealthLoading] = React.useState(true);
    const [bots, setBots] = React.useState<Bot[]>([]);
    const [isEditing, setIsEditing] = React.useState(false);
    const [userData, setUserData] = React.useState({
        name: currentUser.username,
        email: `${currentUser.username.toLowerCase()}@sonix.ai`,
        role: currentUser.role === 'admin' ? "System Administrator" : "Standard User",
        joined: "Oct 2023",
        status: "Verified",
        location: "California, USA",
        plan: currentUser.role === 'admin' ? "Enterprise Alpha" : "Growth Beta",
        apiCalls: "1.2M / 5M",
        credits: "$842.10"
    });

    React.useEffect(() => {
        async function loadData() {
            try {
                const [health, vector, botList] = await Promise.all([
                    api.getHealth().catch(() => null),
                    api.getVectorHealth().catch(() => null),
                    api.getBots().catch(() => []),
                ]);
                setHealthData(health);
                setVectorHealth(vector);
                setBots(botList);
            } catch { /* non-fatal */ }
            finally { setHealthLoading(false); }
        }
        loadData();
    }, []);

    const svcStatus = (key: string) => {
        if (healthLoading) return 'checking';
        if (!healthData) return 'offline';
        return healthData.services?.[key] ?? (healthData.status === 'ok' ? 'online' : 'unknown');
    };

    const handleSave = () => {
        setIsEditing(false);
        alert('Profile updated successfully!');
    };

    return (
        <div className="flex-1 flex flex-col bg-background">
            <Header
                title="Account Profile"
                subtitle="System Identity & Preferences"
            />

            <main className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto w-full flex flex-col gap-10">

                {/* Profile Identity Card */}
                <div className="glass-panel rounded-4xl p-8 sm:p-12 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 blur-3xl -z-10 group-hover:bg-primary/10 transition-colors duration-700" />
                    <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 relative z-10">
                        <div className="relative">
                            <div className="size-32 sm:size-40 rounded-full border-2 border-primary/20 p-1.5 bg-surface-lowest shadow-2xl">
                                <img
                                    src="https://picsum.photos/seed/admin/200/200"
                                    alt="Avatar"
                                    className="w-full h-full rounded-full object-cover shadow-inner"
                                />
                            </div>
                            <div className="absolute -bottom-2 -right-2 size-10 rounded-full ember-gradient flex items-center justify-center border-4 border-surface-lowest text-white shadow-lg">
                                <Verified className="size-5" />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left gap-4">
                            <div className="w-full max-w-md">
                                <div className="flex items-center gap-3 mb-1 justify-center md:justify-start">
                                    {isEditing ? (
                                        <input
                                            value={userData.name}
                                            onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                                            className="text-4xl font-headline font-black tracking-tight bg-white/5 border-b border-primary/50 outline-none w-full"
                                            autoFocus
                                        />
                                    ) : (
                                        <h1 className="text-4xl font-headline font-black tracking-tight">{userData.name}</h1>
                                    )}
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20 shrink-0">
                                        {userData.plan}
                                    </span>
                                </div>
                                <div className="text-outline font-medium tracking-wide flex items-center gap-2 justify-center md:justify-start">
                                    <Globe className="size-4" />
                                    {isEditing ? (
                                        <input
                                            value={userData.location}
                                            onChange={(e) => setUserData({ ...userData, location: e.target.value })}
                                            className="bg-white/5 border-b border-white/20 outline-none w-full"
                                        />
                                    ) : (
                                        <span>{userData.location} • {userData.role}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={handleSave}
                                            className="bg-primary hover:bg-primary/80 text-on-primary px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <Check className="size-4" />
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="bg-white/5 hover:bg-white/10 text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm border border-white/5 transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <X className="size-4" />
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="bg-surface-highest hover:bg-white/10 text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm border border-white/5 transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <Settings2 className="size-4 text-primary" />
                                            Edit Profile
                                        </button>
                                        <button className="bg-surface-highest hover:bg-white/10 text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm border border-white/5 transition-all flex items-center gap-2 active:scale-95">
                                            <Key className="size-4 text-amber-400" />
                                            API Access
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-col items-end gap-2 text-right border-l border-white/5 pl-12 py-2">
                            <div className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Current Credits</div>
                            <div className="text-4xl font-headline font-black text-emerald-400">{userData.credits}</div>
                            <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1 mt-1">
                                Add balance <ExternalLink className="size-3" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-1 space-y-8">
                        <section className="glass-panel rounded-3xl p-8 space-y-6">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-outline border-b border-white/5 pb-4">Personal Intelligence</h3>
                            <div className="space-y-6">
                                <InfoRow
                                    icon={Mail}
                                    label="Contact Email"
                                    value={userData.email}
                                    isEditing={isEditing}
                                    onChange={(val: string) => setUserData({ ...userData, email: val })}
                                />
                                <InfoRow icon={Shield} label="Access Control" value={userData.role} />
                                <InfoRow icon={Calendar} label="Commencement" value={userData.joined} />
                                <InfoRow icon={Activity} label="System Status" value="Active / Operational" />
                            </div>
                        </section>

                        {/* <section className="bg-red-500/5 rounded-3xl p-8 border border-red-500/10 transition-colors hover:bg-red-500/10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="size-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                                    <LogOut className="size-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-red-400">Security Actions</h4>
                                    <p className="text-[10px] text-red-400/60 font-bold uppercase tracking-widest mt-0.5">Dangerous Territory</p>
                                </div>
                            </div>
                            <p className="text-xs text-outline leading-relaxed mb-6">Ending your session will revoke neural tokens from the current browser environment.</p>
                            <button className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white font-bold text-sm transition-all border border-red-500/30">
                                Terminate All Sessions
                            </button>
                        </section> */}
                    </div>

                    {/* Right Column: Quotas & Infrastructure */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <section className="glass-panel rounded-3xl p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="size-5 text-primary" />
                                        <h3 className="font-bold">Usage Quota</h3>
                                    </div>
                                    <span className="text-[10px] font-mono p-1 bg-surface-highest rounded text-outline">AUTO-RENEW: ON</span>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-outline">Neural Tokens</span>
                                            <span className="text-sm font-black">{userData.apiCalls}</span>
                                        </div>
                                        <div className="w-full h-2 bg-surface-highest rounded-full overflow-hidden">
                                            <div className="h-full ember-gradient w-1/4 shadow-[0_0_10px_rgba(251,140,0,0.5)]" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-outline">Storage Capacity</span>
                                            <span className="text-sm font-black">1.2 GB / 10 GB</span>
                                        </div>
                                        <div className="w-full h-2 bg-surface-highest rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan-500 w-[12%]" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs font-bold text-outline">Active Agents</span>
                                            <span className="text-sm font-black">{bots.length} / 25</span>
                                        </div>
                                        <div className="w-full h-2 bg-surface-highest rounded-full overflow-hidden">
                                            <div className="h-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]" style={{ width: `${(bots.length / 25) * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-panel rounded-3xl p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <Database className="size-5 text-amber-400" />
                                        <h3 className="font-bold">Database Status</h3>
                                    </div>
                                    {healthLoading && <Loader2 className="size-4 animate-spin text-primary" />}
                                </div>
                                <div className="flex flex-col gap-6">
                                    <DatabaseItem
                                        icon={HardDrive}
                                        name="SQLite Primary"
                                        desc="Persistence Engine"
                                        status="online"
                                        active
                                    />
                                    <DatabaseItem
                                        icon={Database}
                                        name="Redis Layer"
                                        desc="Real-time Session Cache"
                                        status={svcStatus('redis')}
                                        active={svcStatus('redis') === 'online'}
                                    />
                                    <DatabaseItem
                                        icon={BrainCircuit}
                                        name="Vector Memory"
                                        desc={vectorHealth ? `${vectorHealth.doc_count} Documents` : 'Semantic RAG store'}
                                        status={vectorHealth?.status ?? (healthLoading ? 'checking' : 'unknown')}
                                        active={vectorHealth?.status === 'online'}
                                    />
                                </div>
                            </section>
                        </div>

                        {/* <section className="glass-panel rounded-3xl p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <BotIcon className="size-5 text-primary" />
                                    <h3 className="font-bold">Associated Bots</h3>
                                </div>
                                <button
                                    onClick={() => navigate('/personas')}
                                    className="text-xs font-bold text-primary hover:underline"
                                >
                                    View Factory
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {bots.length === 0 ? (
                                    <div className="sm:col-span-2 border-2 border-dashed border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-outline">
                                        <BotIcon className="size-8 opacity-20 mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-widest">No Active Agents Deployed</p>
                                    </div>
                                ) : (
                                    bots.slice(0, 4).map((bot, i) => (
                                        <div key={bot.id} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-highest border border-white/5 transition-all hover:border-primary/30 group">
                                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                                <BotIcon className="size-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{bot.name}</span>
                                                <span className="text-[10px] text-outline font-bold uppercase tracking-widest">
                                                    {bot.is_active ? 'Online' : 'Standby'} / {bot.llm_model.split('/')[1] || bot.llm_model}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section> */}
                    </div>
                </div>
            </main>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value, isEditing, onChange }: any) {
    return (
        <div className="flex items-center gap-4 group">
            <div className="size-10 rounded-xl bg-surface-highest flex items-center justify-center text-outline group-hover:text-primary transition-colors border border-white/5">
                <Icon className="size-4" />
            </div>
            <div className="flex flex-col flex-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline">{label}</span>
                {isEditing && onChange ? (
                    <input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="text-sm font-bold text-on-surface bg-white/5 border-b border-primary/30 outline-none w-full"
                    />
                ) : (
                    <span className="text-sm font-bold text-on-surface">{value}</span>
                )}
            </div>
        </div>
    );
}

function DatabaseItem({ icon: Icon, name, desc, status, active }: any) {
    const isOffline = status === 'offline' || status === 'unknown';
    const isChecking = status === 'checking';
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-surface-highest flex items-center justify-center">
                    <Icon className={cn("size-4", active ? "text-emerald-400" : isOffline ? "text-red-400" : "text-primary")} />
                </div>
                <div>
                    <p className="text-xs font-bold">{name}</p>
                    <p className="text-[10px] text-outline font-medium tracking-tight mt-0.5">{desc}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className={cn(
                    "size-1.5 rounded-full",
                    active ? "bg-emerald-400" : isOffline ? "bg-red-400" : isChecking ? "bg-amber-400 animate-pulse" : "bg-outline"
                )} />
                <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                    active ? "bg-emerald-500/10 text-emerald-400" : isOffline ? "bg-red-500/10 text-red-400" : "bg-surface-variant text-outline"
                )}>
                    {status}
                </span>
            </div>
        </div>
    );
}
