import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
   Zap,
   Users,
   Activity,
   ShieldCheck,
   Mic2,
   ArrowUpRight,
   TrendingUp,
   Cpu,
   Globe,
   Monitor,
   Search,
   ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStudio } from '../contexts/StudioContext';
import { useNavigate } from 'react-router-dom';
import { RefreshCcw, Database } from 'lucide-react';

const MetricCard = ({ label, value, subvalue, icon: Icon, color, onClick }: any) => (
   <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
         "bg-surface-lowest p-6 rounded-3xl border border-outline-variant/10 relative overflow-hidden group premium-forge-border shadow-sm text-left w-full",
         onClick && "hover:border-primary/40 transition-all cursor-pointer"
      )}
   >
      <div className={cn("absolute top-0 right-0 size-24 blur-3xl opacity-5", color)} />
      <div className="flex justify-between items-start mb-6">
         <div className="size-10 rounded-xl bg-surface-low flex items-center justify-center text-primary border border-outline-variant/5">
            <Icon className="size-5" />
         </div>
         <div className="flex items-center gap-1 text-emerald-500 font-bold text-[9px] uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10">
            <TrendingUp className="size-3" />
            Optimal
         </div>
      </div>
      <div className="space-y-1">
         <p className="text-[10px] font-bold text-outline uppercase tracking-[0.2em]">{label}</p>
         <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-headline font-extrabold text-on-surface">{value}</h3>
            <span className="text-xs text-outline font-medium">{subvalue}</span>
         </div>
      </div>
      {onClick && (
         <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight className="size-4 text-primary" />
         </div>
      )}
   </motion.button>
);

export default function StudioDashboard() {
   const { personas, activityLog, metrics, recordActivity, resetStudio, voiceRelays, setActivePersonaId } = useStudio();
   const navigate = useNavigate();
   const [isGenerating, setIsGenerating] = React.useState(false);
   const [selectedProvider, setSelectedProvider] = React.useState<string | null>(null);

   // Calculate engine distribution from personas
   const engineStats = React.useMemo(() => {
      const stats: Record<string, number> = {};
      personas.forEach(p => {
         const relay = voiceRelays?.find(r => r.id === p.selectedVoice);
         const provider = relay?.provider || 'Unknown';
         stats[provider] = (stats[provider] || 0) + 1;
      });
      const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);

      // Set initial selection to top provider if not set
      if (!selectedProvider && sorted.length > 0) {
         setSelectedProvider(sorted[0][0]);
      }

      return sorted;
   }, [personas, voiceRelays, selectedProvider]);

   const filteredPersonas = React.useMemo(() => {
      if (!selectedProvider) return [];
      return personas.filter(p => {
         const relay = voiceRelays?.find(r => r.id === p.selectedVoice);
         return relay?.provider === selectedProvider;
      });
   }, [personas, voiceRelays, selectedProvider]);

   const handleDownloadReport = () => {
      setIsGenerating(true);
      recordActivity('Generating Operational Report...');
      setTimeout(() => {
         setIsGenerating(false);
         recordActivity('Report Exported to Workspace');
      }, 2000);
   };
   return (
      <div className="space-y-8 animate-in fade-in duration-700 h-[calc(100vh-120px)] overflow-hidden flex flex-col">
         <div className="flex justify-between items-end shrink-0">
            <div className="space-y-1">
               <p className="text-[10px] font-bold text-primary uppercase tracking-[0.4em]">Neural Operations</p>
               <h1 className="text-3xl font-headline font-extrabold text-on-surface uppercase tracking-tight leading-none">Command Dashboard</h1>
            </div>
            <div className="flex items-center gap-4 text-outline font-bold text-[10px] uppercase tracking-widest bg-surface-low px-4 py-2 rounded-xl border border-outline-variant/5">
               <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Live Relay: Active
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
            <MetricCard
               label="Global Fleet"
               value={String(personas.length)}
               subvalue="Neural Personas"
               icon={Users}
               color="bg-primary"
               onClick={() => navigate('/studio/library')}
            />
            <MetricCard
               label="Neural Relay"
               value={String(voiceRelays.length)}
               subvalue="Provider Nodes"
               icon={Zap}
               color="bg-amber-500"
               onClick={() => navigate('/persona')}
            />
            <MetricCard
               label="Inference"
               value={String(metrics.avgLatency)}
               subvalue="ms P99 Avg"
               icon={Cpu}
               color="bg-blue-500"
            />
            <MetricCard
               label="Uptime"
               value={metrics.uptime}
               subvalue="Operational"
               icon={ShieldCheck}
               color="bg-emerald-500"
            />
         </div>

         <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
            <div className="col-span-12 lg:col-span-8 bg-surface-lowest rounded-4xl border border-outline-variant/10 p-8 relative overflow-hidden flex flex-col gap-6 premium-forge-border shadow-inner">
               <div className="flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="text-lg font-headline font-bold">Neural Distribution</h3>
                     <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Global Provider Mapping</p>
                  </div>
                  <div className="flex gap-2 p-1 bg-surface-low rounded-xl border border-outline-variant/5">
                     {['Latency', 'Load', 'Distribution'].map(t => (
                        <button key={t} className={cn(
                           "px-4 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all",
                           t === 'Distribution' ? "bg-primary text-on-primary-fixed shadow-lg" : "text-outline hover:bg-surface-high"
                        )}>{t}</button>
                     ))}
                  </div>
               </div>

               <div className="flex-1 min-h-0 flex flex-col justify-center">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {engineStats.map(([provider, count], i) => (
                        <motion.button
                           key={provider}
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           transition={{ delay: i * 0.05 }}
                           onClick={() => setSelectedProvider(provider)}
                           className={cn(
                              "p-5 rounded-4xl border transition-all text-left relative overflow-hidden group/card",
                              selectedProvider === provider
                                 ? "bg-primary/10 border-primary/30 shadow-lg ring-1 ring-primary/20"
                                 : "bg-surface-low border-outline-variant/5 text-outline hover:border-outline-variant/10"
                           )}
                        >
                           <div className="flex justify-between items-start mb-4">
                              <div className={cn(
                                 "size-10 rounded-2xl flex items-center justify-center border shadow-inner transition-colors",
                                 selectedProvider === provider ? "bg-primary text-on-primary-fixed border-primary/20" : "bg-surface-lowest text-primary border-outline-variant/10"
                              )}>
                                 <Database className="size-4" />
                              </div>
                              <div className="text-right">
                                 <p className={cn("text-lg font-headline font-extrabold", selectedProvider === provider ? "text-primary" : "text-on-surface")}>{count}</p>
                                 <p className="text-[7px] font-bold text-outline uppercase tracking-widest">Active</p>
                              </div>
                           </div>
                           <div className="space-y-2">
                              <p className={cn("text-[9px] font-bold uppercase tracking-widest truncate", selectedProvider === provider ? "text-on-surface" : "text-outline")}>{provider}</p>
                              <div className="h-1 w-full bg-surface-lowest rounded-full overflow-hidden">
                                 <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${personas.length > 0 ? (count / personas.length) * 100 : 0}%` }}
                                    className="h-full bg-primary shadow-[0_0_8px_rgba(255,193,7,0.4)]"
                                 />
                              </div>
                           </div>
                           {selectedProvider === provider && (
                              <div className="absolute top-2 right-2">
                                 <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                              </div>
                           )}
                        </motion.button>
                     ))}
                  </div>
               </div>

               <div className="pt-6 border-t border-outline-variant/5 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-10">
                     <div className="flex items-center gap-3">
                        <div className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[9px] font-bold text-outline uppercase tracking-widest">Relay Integrity: 99.9%</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="size-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="text-[9px] font-bold text-outline uppercase tracking-widest">Neural Load: Balanced</span>
                     </div>
                  </div>
                  <div className="text-[9px] font-bold text-outline uppercase tracking-widest bg-surface-low px-3 py-1 rounded-full border border-outline-variant/5">
                     Sync: 3s ago
                  </div>
               </div>
            </div>

            <div className="col-span-12 lg:col-span-4 bg-surface-lowest rounded-4xl border border-outline-variant/10 p-8 flex flex-col gap-6 premium-forge-border overflow-hidden">
               <div className="shrink-0 space-y-1">
                  <div className="flex justify-between items-center">
                     <h3 className="text-lg font-headline font-bold">Fleet Insights</h3>
                     <div className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[8px] font-bold text-primary uppercase tracking-widest">
                        {selectedProvider} Deep-Dive
                     </div>
                  </div>
                  <p className="text-[9px] font-bold text-outline uppercase tracking-widest">Real-time Performance Relay</p>
               </div>

               <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  <AnimatePresence mode="popLayout">
                     {filteredPersonas.map((p, i) => (
                        <motion.div
                           key={p.id}
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.95 }}
                           transition={{ delay: i * 0.05 }}
                           className="p-4 rounded-3xl bg-surface-low border border-outline-variant/5 group hover:border-primary/20 transition-all cursor-pointer"
                           onClick={() => {
                              setActivePersonaId(p.id);
                              navigate('/studio/test');
                           }}
                        >
                           <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                 <div className={cn(
                                    "size-10 rounded-xl flex items-center justify-center text-[12px] font-bold border border-outline-variant/5 shadow-inner",
                                    p.themeColor === 'amber' || p.emotion === 'Empathetic' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'
                                 )}>
                                    {p.name.charAt(0)}
                                 </div>
                                 <div>
                                    <p className="text-xs font-bold text-on-surface">{p.name}</p>
                                    <p className="text-[8px] font-bold text-outline uppercase tracking-[0.2em]">{p.useCase}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[10px] font-mono text-primary font-bold">340ms</p>
                                 <p className="text-[7px] font-bold text-outline uppercase tracking-widest">Lat</p>
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="px-3 py-2 rounded-xl bg-surface-lowest border border-outline-variant/5">
                                 <p className="text-[7px] font-bold text-outline uppercase mb-1">Live Calls</p>
                                 <p className="text-[11px] font-bold text-on-surface">1.2k <span className="text-[8px] text-emerald-500">+12%</span></p>
                              </div>
                              <div className="px-3 py-2 rounded-xl bg-surface-lowest border border-outline-variant/5">
                                 <p className="text-[7px] font-bold text-outline uppercase mb-1">Sentiment</p>
                                 <p className="text-[11px] font-bold text-on-surface">Positive</p>
                              </div>
                           </div>

                           <div className="flex items-center justify-between pt-4 border-t border-outline-variant/5">
                              <div className="flex items-center gap-2">
                                 <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                 <span className="text-[8px] font-bold text-outline uppercase tracking-widest">Active Link</span>
                              </div>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Launch Test</span>
                                 <ChevronRight className="size-3 text-primary" />
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </AnimatePresence>
                  {filteredPersonas.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                        <div className="size-16 rounded-full bg-surface-low border border-outline-variant/5 flex items-center justify-center">
                           <Monitor className="size-8 text-outline shadow-xl" />
                        </div>
                        <div className="space-y-1">
                           <p className="text-sm font-bold text-on-surface">No Active Nodes</p>
                           <p className="text-[10px] text-outline uppercase tracking-widest leading-relaxed">Select a neural provider to analyze<br />localized distribution</p>
                        </div>
                     </div>
                  )}
               </div>

               <div className="flex gap-3">
                  <button
                     onClick={handleDownloadReport}
                     disabled={isGenerating}
                     className={cn(
                        "flex-1 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2",
                        isGenerating ? "bg-surface-high text-outline cursor-wait" : "bg-primary text-on-primary-fixed studio-glow-amber hover:scale-[1.02]"
                     )}
                  >
                     {isGenerating ? "Audit..." : "Audit Report"}
                     {!isGenerating && <ArrowUpRight className="size-3" />}
                  </button>
                  <button
                     onClick={resetStudio}
                     className="px-6 rounded-2xl bg-surface-low border border-outline-variant/10 text-outline hover:text-rose-500 hover:border-rose-500/20 transition-all flex items-center justify-center group"
                     title="Reset Studio Fleet"
                  >
                     <RefreshCcw className="size-4 group-hover:rotate-180 transition-transform duration-500" />
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
}
