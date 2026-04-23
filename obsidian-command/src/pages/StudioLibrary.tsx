import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Library,
  Plus,
  Play,
  Pause,
  Mic2,
  PlusCircle,
  Upload,
  Cloud,
  Check,
  Zap,
  Volume2,
  Share2,
  Database
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStudio } from '../contexts/StudioContext';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, MoreVertical, Trash2, ExternalLink } from 'lucide-react';
import { VOICES } from '../data/voiceData';

// const VOICES = [
//   { id: 'v1', name: 'Ananya', languages: ['Hindi', 'English', 'Tamil'], provider: 'ElevenLabs', type: 'Neural', role: 'Support Specialist', latency: '125ms', stability: '92%' },
//   { id: 'v2', name: 'Aarav', languages: ['Hindi'], provider: 'Deepgram', type: 'Neural', role: 'Collection Authority', latency: '148ms', stability: '88%' },
//   { id: 'v3', name: 'Priya', languages: ['Hindi', 'English', 'Spanish', 'Tamil'], provider: 'ElevenLabs', type: 'Neural', role: 'Customer Success', latency: '135ms', stability: '95%' },
//   { id: 'v4', name: 'Arjun', languages: ['Hindi', 'English'], provider: 'Gemini', type: 'Neural', role: 'Sales Specialist', latency: '162ms', stability: '82%' },
//   { id: 'v5', name: 'Kavya', languages: ['Hindi', 'English'], provider: 'ElevenLabs', type: 'Neural', role: 'Verification Lead', latency: '118ms', stability: '97%' },
// ];

// --- Sub-components ---

const MiniWavePlayer = ({ isPlaying, onToggle }: { isPlaying: boolean; onToggle: () => void }) => {
  return (
    <div className={cn(
      "flex items-center gap-3 bg-surface-low/30 border border-outline-variant/5 rounded-2xl  min-w-[130px] group/player transition-all",
      isPlaying && "bg-primary/5 border-primary/20 shadow-sm"
    )}>
      <button
        onClick={onToggle}
        className={cn(
          "size-8 rounded-xl flex items-center justify-center transition-all shadow-sm",
          isPlaying ? "ember-gradient shadow-lg shadow-primary/20" : "bg-surface-high text-outline hover:text-primary hover:bg-surface-highest"
        )}
      >
        {isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current ml-0.5" />}
      </button>

      <div className="flex items-center gap-0.5 h-5 flex-1 select-none">
        {[0.4, 0.7, 0.3, 0.9, 0.5, 0.8, 0.2, 0.6, 0.4, 0.7].map((h, i) => (
          <motion.div
            key={i}
            animate={isPlaying ? { height: ['20%', `${h * 100}%`, '20%'] } : { height: '4px' }}
            transition={isPlaying ? {
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.08,
              ease: "easeInOut"
            } : { duration: 0.3 }}
            className={cn(
              "w-0.5 rounded-full transition-colors duration-500",
              isPlaying ? "bg-primary" : "bg-outline/20"
            )}
          />
        ))}
      </div>
    </div>
  );
};

const RegistryRow = ({ persona, isDeployed, onToggle, onTest, onDelete, isPlaying, onPlayToggle }: any) => {
  const relay = VOICES.find(r => r.id === persona.selectedVoice || r.name === persona.selectedVoice);
  const provider = relay?.provider || (persona.selectedVoice?.includes('v') ? 'ElevenLabs' : 'Neural');

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group border-b border-outline-variant/5 hover:bg-surface-low/50 transition-colors"
    >
      <td className="py-4 pl-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className={cn(
            "size-8 rounded-lg flex items-center justify-center font-bold text-[10px] border shadow-sm",
            persona.themeColor === 'amber' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
              persona.themeColor === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                persona.themeColor === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                  persona.themeColor === 'rose' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                    "bg-primary/10 border-primary/20 text-primary"
          )}>
            {persona.name?.charAt(0)}
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface leading-none">{persona.name}</p>
            <p className="text-[9px] text-outline mt-1">{persona.language} · {persona.gender}</p>
          </div>
        </div>
      </td>

      <td className="py-4 px-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-surface-lowest border border-outline-variant/5 flex items-center justify-center">
            <Database className="size-3 text-outline" />
          </div>
          <p className="text-[10px] text-primary/70 uppercase tracking-widest font-black">{provider}</p>
        </div>
      </td>

      <td className="py-4 px-4 whitespace-nowrap">
        <MiniWavePlayer isPlaying={isPlaying} onToggle={onPlayToggle} />
      </td>

      <td className="py-4 px-4">
        <p className="text-[10px] font-medium text-outline truncate max-w-[150px]">{persona.useCase}</p>
      </td>

      <td className="py-4 px-4">
        <div className="flex flex-col gap-2 w-32">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-bold text-outline uppercase">Urgency</span>
            <span className="text-[7px] font-mono text-outline">{persona.urgency}%</span>
          </div>
          <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${persona.urgency}%` }} />
          </div>
        </div>
      </td>

      <td className="py-4 px-4 whitespace-nowrap">
        <div className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-lg border w-fit",
          isDeployed ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-surface-low border-outline-variant/5 text-outline opacity-60"
        )}>
          <div className={cn("size-1.5 rounded-full", isDeployed ? "bg-emerald-500 animate-pulse" : "bg-outline/30")} />
          <span className="text-[8px] font-bold uppercase tracking-widest">{isDeployed ? 'Node Active' : 'Standby'}</span>
        </div>
      </td>

      <td className="py-4 px-4 text-right pr-4">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onTest}
            className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary-fixed transition-all"
            title="Launch Test Console"
          >
            <Zap className="size-3.5" />
          </button>
          <button
            onClick={onToggle}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              isDeployed ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500"
            )}
            title={isDeployed ? "Stop Instance" : "Deploy Instance"}
          >
            {isDeployed ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-outline hover:text-rose-500 transition-all"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

const VoiceRelayRow = ({ voice, isPlaying, onPlayToggle, onForge }: any) => (
  <motion.tr
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="group border-b border-outline-variant/5 hover:bg-surface-low/50 transition-colors"
  >
    <td className="py-4 pl-4 whitespace-nowrap">
      <div className="flex items-center gap-3">
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center font-bold text-[10px] border shadow-sm bg-primary/10 border-primary/20 text-primary"
        )}>
          {voice.name?.charAt(0)}
        </div>
        <div>
          <p className="text-xs font-bold text-on-surface leading-none">{voice.name}</p>
          <p className="text-[9px] text-outline mt-1">{voice.provider} · Neural Core</p>
        </div>
      </div>
    </td>

    <td className="py-4 px-4 whitespace-nowrap">
      <div className="flex flex-wrap gap-1 max-w-[150px]">
        {(voice.languages || ['English']).map((lang: string, i: number) => (
          <span key={i} className="px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 text-[8px] font-bold text-primary uppercase tracking-tighter">
            {lang}
          </span>
        ))}
      </div>
    </td>

    <td className="py-4 px-4 whitespace-nowrap">
      <MiniWavePlayer isPlaying={isPlaying} onToggle={onPlayToggle} />
    </td>

    <td className="py-4 px-4">
      <p className="text-[10px] font-medium text-outline truncate max-w-[150px]">{voice.role}</p>
    </td>

    <td className="py-4 px-4">
      <div className="flex flex-col gap-2 w-32">
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-bold text-outline uppercase">Latency</span>
          <span className="text-[7px] font-mono text-primary">
            {voice.latency}
          </span>
        </div>
        <div className="h-1 w-full bg-surface-low rounded-full overflow-hidden">
          <div className="h-full bg-primary"
            style={{ width: voice.stability }} />
        </div>
      </div>
    </td>

    <td className="py-4 px-4 whitespace-nowrap">
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 w-fit">
        <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-widest">Online</span>
      </div>
    </td>

    <td className="py-4 px-4 text-right pr-4">
      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* <button
          onClick={onForge}
          className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary-fixed transition-all"
          title="Forge Persona"
        >
          <Zap className="size-3.5" />
        </button> */}
        <button
          onClick={() => { }}
          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-outline hover:text-rose-500 transition-all"
          title="Delete Voice"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </td>
  </motion.tr>
);

const CloneVoiceView = ({ onClose }: { onClose: () => void }) => {
  const [isUploading, setIsUploading] = React.useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      onClose();
    }, 3000);
  };
  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-surface-low hover:bg-surface-high border border-outline-variant/10 transition-all text-outline group"
          >
            <X className="size-4 group-hover:text-primary transition-colors" />
          </button>
          <div className="h-8 w-px bg-outline-variant/10" />
          <div>
            <p className="text-[9px] font-bold text-primary uppercase tracking-[0.4em]">Voice Replicator</p>
            <h2 className="text-2xl font-headline font-extrabold text-on-surface uppercase tracking-tight">Clone Custom Voice</h2>
          </div>
        </div>
        <div className="px-4 py-2 rounded-xl bg-surface-low/50 border border-outline-variant/5">
          <p className="text-[9px] font-bold text-outline uppercase tracking-widest">Active Link: High Fidelity</p>
        </div>
      </div>

      <div className="bg-surface-lowest rounded-4xl p-10 relative overflow-hidden flex flex-col items-center text-center gap-8 shadow-2xl premium-forge-border">
        <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-2xl studio-glow-amber">
          <Mic2 className="size-12" />
        </div>

        <div className="space-y-4 max-w-md">
          <h2 className="text-3xl font-headline font-bold">Voice Synthesis</h2>
          <p className="text-outline text-sm leading-relaxed">Upload a high-fidelity 60s sample to replicate the voice patterns. Wav or MP3 required for optimal results.</p>
        </div>

        <div className="w-full h-64 rounded-[2.5rem] border-2 border-dashed border-outline-variant/20 bg-surface-low/30 flex flex-col items-center justify-center gap-4 hover:bg-surface-low/50 transition-all cursor-pointer group relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="size-14 rounded-2xl bg-surface-lowest flex items-center justify-center text-outline group-hover:text-primary transition-all border border-outline-variant/10 shadow-lg relative z-10">
            <Cloud className="size-7" />
          </div>
          <div className="relative z-10 space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface">Drag & Drop Sample</p>
            <p className="text-[10px] text-outline font-medium">MAX FILE SIZE: 24MB</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          <button
            disabled={isUploading}
            onClick={handleUpload}
            className="w-full ember-gradient py-4 rounded-2xl font-bold text-xs shadow-xl studio-glow-amber hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 relative overflow-hidden group/btn"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform" />
            <span className="relative z-10">
              {isUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="size-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                  Analyzing Voice...
                </div>
              ) : 'Start Cloning Process'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Page ---

export default function StudioLibrary() {
  const { personas, deployedIds, setActivePersonaId, recordActivity, toggleDeployment, deletePersona } = useStudio();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCloneMode, setIsCloneMode] = React.useState(false);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const filteredVoices = VOICES.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.languages || []).some((l: string) => l.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isCloneMode) {
    return <CloneVoiceView onClose={() => setIsCloneMode(false)} />;
  }

  return (
    <div className="space-y-6 h-[calc(100vh-120px)] overflow-hidden flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-outline group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search voices by name, provider or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-low border border-outline-variant/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary/30 w-80 transition-all shadow-inner"
            />
          </div>
        </div>
        {/* <button
          onClick={() => setIsCloneMode(true)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all group shadow-sm"
        >
          <PlusCircle className="size-4 group-hover:rotate-90 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Clone Voice</span>
        </button> */}
      </div>

      <div className="flex-1 bg-surface-lowest rounded-4xl border border-outline-variant/10 relative overflow-hidden flex flex-col premium-forge-border shadow-inner">
        <div className="flex-1 overflow-auto scrollbar-hide">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-lowest z-10">
              <tr className="border-b border-outline-variant/10">
                <th className="py-4 pl-4 text-[9px] font-bold text-outline uppercase tracking-widest">Voice Identity</th>
                <th className="py-4 px-4 text-[9px] font-bold text-outline uppercase tracking-widest">Language Compatibility</th>
                <th className="py-4 px-4 text-[9px] font-bold text-outline uppercase tracking-widest">Voice Sample</th>
                <th className="py-4 px-4 text-[9px] font-bold text-outline uppercase tracking-widest">Operational Role</th>
                <th className="py-4 px-4 text-[9px] font-bold text-outline uppercase tracking-widest">Behavioral DNA</th>
                <th className="py-4 px-4 text-[9px] font-bold text-outline uppercase tracking-widest">Status</th>
                <th className="py-4 px-4 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredVoices.length > 0 ? (
                filteredVoices.map((voice) => (
                  <VoiceRelayRow
                    key={voice.id}
                    voice={voice}
                    isPlaying={playingId === voice.id}
                    onPlayToggle={() => setPlayingId(playingId === voice.id ? null : voice.id)}
                    onForge={() => navigate('/studio/agents')}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <p className="text-xs font-bold text-outline uppercase tracking-[0.2em]">No matching neural assets found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-surface-low/50 border-t border-outline-variant/5 flex justify-between items-center shrink-0">
          <p className="text-[10px] font-bold text-outline uppercase tracking-widest">
            Neural Assets: <span className="text-on-surface">{filteredVoices.length}</span>
          </p>
          <div className="h-4 w-px bg-outline-variant/10" />
          {/* <p className="text-[10px] font-bold text-outline uppercase tracking-widest">
            Studio Personas: <span className="text-on-surface">{personas.length}</span>
          </p> */}
          <p className="text-[10px] font-bold text-outline uppercase tracking-widest ml-auto">
            Operational Nodes: <span className="text-emerald-500 font-mono">{filteredVoices?.length}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
