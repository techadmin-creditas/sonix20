import React from 'react';
import { Header } from '../components/Header';
import {
    User, Mail, Shield, Calendar, Globe,
    Settings2, Key, Database, Bot, Activity,
    ExternalLink, LogOut, Verified, CreditCard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNotifications } from '../contexts/NotificationContext';

export default function Profile() {
    const { notifications } = useNotifications();

    const user = {
        name: "Alex Rivera",
        email: "alex.rivera@sonix.ai",
        role: "Organization Owner",
        joined: "Oct 2023",
        status: "Verified",
        location: "California, USA",
        plan: "Enterprise Alpha",
        apiCalls: "1.2M / 5M",
        credits: "$842.10"
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
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-4xl font-headline font-black tracking-tight">{user.name}</h1>
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                                        {user.plan}
                                    </span>
                                </div>
                                <p className="text-outline font-medium tracking-wide flex items-center gap-2 justify-center md:justify-start">
                                    <Globe className="size-4" />
                                    {user.location} • {user.role}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                <button className="bg-surface-highest hover:bg-white/10 text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm border border-white/5 transition-all flex items-center gap-2 active:scale-95">
                                    <Settings2 className="size-4 text-primary" />
                                    Edit Profile
                                </button>
                                <button className="bg-surface-highest hover:bg-white/10 text-on-surface px-6 py-2.5 rounded-xl font-bold text-sm border border-white/5 transition-all flex items-center gap-2 active:scale-95">
                                    <Key className="size-4 text-amber-400" />
                                    API Access
                                </button>
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-col items-end gap-2 text-right border-l border-white/5 pl-12 py-2">
                            <div className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Current Credits</div>
                            <div className="text-4xl font-headline font-black text-emerald-400">{user.credits}</div>
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
                                <InfoRow icon={Mail} label="Contact Email" value={user.email} />
                                <InfoRow icon={Shield} label="Access Control" value={user.role} />
                                <InfoRow icon={Calendar} label="Commencement" value={user.joined} />
                                <InfoRow icon={Activity} label="System Status" value="Active / Operational" />
                            </div>
                        </section>

                        <section className="bg-red-500/5 rounded-3xl p-8 border border-red-500/10 transition-colors hover:bg-red-500/10">
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
                        </section>
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
                                            <span className="text-sm font-black">{user.apiCalls}</span>
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
                                            <span className="text-sm font-black">8 / 25</span>
                                        </div>
                                        <div className="w-full h-2 bg-surface-highest rounded-full overflow-hidden">
                                            <div className="h-full bg-violet-500 w-[32%]" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-panel rounded-3xl p-8">
                                <div className="flex items-center gap-3 mb-8">
                                    <Database className="size-5 text-amber-400" />
                                    <h3 className="font-bold">Infra Health</h3>
                                </div>
                                <div className="space-y-5">
                                    <InfraStatus label="PostgreSQL Instance" status="Optimal" color="text-emerald-400" />
                                    <InfraStatus label="Redis Session Cache" status="Online" color="text-emerald-400" />
                                    <InfraStatus label="Vector DB Cluster" status="Searching" color="text-primary" />
                                    <InfraStatus label="WebRTC Signaling" status="Standby" color="text-outline" />
                                    <InfraStatus label="STT Engine" status="Deepgram v3" color="text-cyan-400" />
                                </div>
                            </section>
                        </div>

                        <section className="glass-panel rounded-3xl p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <Bot className="size-5 text-primary" />
                                    <h3 className="font-bold">Associated Agents</h3>
                                </div>
                                <button className="text-xs font-bold text-primary hover:underline">View Factory</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {['Nova (Premium Support)', 'Alex (Inbound Sales)', 'Max (Technical)', 'Luna (Scheduling)'].map((bot, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-highest border border-white/5 transition-all hover:border-primary/30 group">
                                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                            <Bot className="size-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">{bot}</span>
                                            <span className="text-[10px] text-outline font-bold uppercase tracking-widest">Active / 24h Traffic</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-center gap-4 group">
            <div className="size-10 rounded-xl bg-surface-highest flex items-center justify-center text-outline group-hover:text-primary transition-colors border border-white/5">
                <Icon className="size-4" />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline">{label}</span>
                <span className="text-sm font-bold text-on-surface">{value}</span>
            </div>
        </div>
    );
}

function InfraStatus({ label, status, color }: any) {
    return (
        <div className="flex items-center justify-between py-1">
            <span className="text-xs font-medium text-outline">{label}</span>
            <span className={cn("text-[10px] font-black uppercase tracking-widest", color)}>{status}</span>
        </div>
    );
}
