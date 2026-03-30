import React, { useState } from 'react';
import { Header } from '../components/Header';
import { 
  Database, 
  Search, 
  PlusCircle, 
  ChevronRight, 
  Edit2, 
  Trash2, 
  CheckCircle2,
  ExternalLink,
  X
} from 'lucide-react';
import { KNOWLEDGE_BASE } from '../constants';
import { cn } from '../lib/utils';
import { api, KnowledgeEntry } from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function KnowledgeBase() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Global');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({ question: '', answer: '', topic: 'General', priority: 2 });

  const loadEntries = async () => {
    try {
      const data = await api.getKnowledgeEntries();
      setEntries(data);
      if (data.length > 0 && !selectedEntry) {
        setSelectedEntry(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadEntries();
  }, []);

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         entry.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'Global' || (entry.topic === activeFilter);
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this key knowledge entry?')) {
      try {
        await api.deleteKnowledgeEntry(id);
        setEntries(prev => prev.filter(ent => ent.id !== id));
        if (selectedEntry?.id === id) {
          setSelectedEntry(null);
          setShowPreview(false);
        }
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addKnowledgeEntry(formData);
      setIsModalOpen(false);
      setFormData({ question: '', answer: '', topic: 'General', priority: 2 });
      loadEntries();
    } catch (err) {
      alert('Failed to save');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/5 blur-[120px] rounded-full"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/2 blur-[150px] rounded-full"></div>

      <Header 
        title="Overview" 
        subtitle="Knowledge Base"
        actions={
          <button 
            onClick={() => setIsModalOpen(true)}
            className="h-10 px-6 rounded-xl ember-gradient text-on-primary-fixed font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <PlusCircle className="size-4" />
            New Entry
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar z-10">
        <div className="flex justify-between items-end mb-10 mt-8">
          <div>
            <h2 className="text-4xl font-extrabold text-on-surface tracking-tight">Domain Knowledge Explorer</h2>
            <p className="text-outline mt-2 text-lg">Manage and tune the core intelligence of your voice agents.</p>
          </div>
        </div>

        <div className="mb-10 space-y-6">
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-6 text-outline group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Find any topic, question, or answer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-16 pl-16 pr-6 bg-surface-low rounded-xl border-none ring-1 ring-white/5 focus:ring-primary/40 focus:bg-surface transition-all text-lg placeholder:text-outline/50 text-on-surface shadow-xl"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-outline uppercase tracking-widest mr-2">Models:</span>
            {['Global', 'Alex', 'Nova', 'Max'].map(filter => (
              <FilterChip 
                key={filter} 
                label={filter} 
                active={activeFilter === filter} 
                onClick={() => setActiveFilter(filter)}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-8 relative">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-2 py-40 flex flex-col items-center justify-center gap-4">
                <Loader2 className="size-10 text-primary animate-spin" />
                <p className="text-outline font-bold uppercase tracking-widest text-sm">Accessing Knowledge Core...</p>
              </div>
            ) : filteredEntries.map((entry) => (
              <div 
                key={entry.id}
                onClick={() => {
                  setSelectedEntry(entry);
                  setShowPreview(true);
                }}
                className={cn(
                  "group p-6 rounded-xl bg-white/5 ghost-border hover:bg-white/8 transition-all cursor-pointer relative",
                  selectedEntry?.id === entry.id && showPreview && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); console.log('Edit', entry.id); }}
                    className="p-2 rounded-lg bg-surface-highest text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(entry.id, e)}
                    className="p-2 rounded-lg bg-surface-highest text-error/60 hover:text-error transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "size-10 rounded-xl flex items-center justify-center shrink-0",
                      entry.priority >= 5 ? "bg-primary/20 text-primary" : "bg-surface-highest text-outline"
                    )}>
                      {/* Original priority indicator was here, replaced by the new div structure */}
                    </div>
                    <span className="text-xs font-bold text-primary tracking-widest uppercase">{entry.topic}</span>
                  </div>
                  <div className="bg-surface-highest px-2 py-1 rounded text-[10px] font-bold text-outline">PRIORITY {entry.priority}</div>
                </div>
                <h4 className="text-lg font-bold text-on-surface mb-2 leading-tight">{entry.question}</h4>
                <p className="text-outline text-sm line-clamp-2 mb-4 leading-relaxed">{entry.answer}</p>
              </div>
            ))}
            {!loading && filteredEntries.length === 0 && (
              <div className="col-span-2 py-20 text-center bg-surface-low rounded-xl ghost-border">
                <Database className="size-12 text-outline/20 mx-auto mb-4" />
                <p className="text-outline font-medium">No knowledge entries found matching your criteria.</p>
              </div>
            )}
          </div>

          {/* Preview Pane */}
          {showPreview && selectedEntry && (
            <div className="w-96 shrink-0 glass-panel p-8 rounded-xl ghost-border border-white/5 sticky top-24 h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-on-surface tracking-tight">Entry Details</h3>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="text-outline hover:text-on-surface"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="space-y-8">
                <div>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-3">Full Answer Text</p>
                  <div className="p-4 rounded-xl bg-white/3 text-sm text-on-surface/70 leading-relaxed border-l-2 border-primary">
                    {selectedEntry.answer}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mb-4">Metadata</p>
                  <div className="space-y-4">
                    <MetaItem label="Entry ID" value={`#KB-${selectedEntry.id}`} mono />
                    <MetaItem label="Created" value={new Date(selectedEntry.created_at * 1000).toLocaleDateString()} />
                    <MetaItem label="Topic" value={selectedEntry.topic} />
                  </div>
                </div>
                <div className="pt-6">
                  <button 
                    className="w-full mt-4 py-3 rounded-xl bg-white/5 border border-white/10 text-on-surface text-sm font-bold hover:bg-white/8 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="size-4" />
                    View Audit Logs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
            <div className="absolute inset-0 bg-primary/2 blur-[100px] -z-10 animate-pulse"></div>
          </div>
          <div className="bg-surface-low w-full max-w-2xl rounded-3xl ghost-border p-8 relative z-10 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-headline font-bold">Create Knowledge Entry</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-outline hover:text-on-surface"><X className="size-6" /></button>
            </div>
            <form className="space-y-6" onSubmit={handleAdd}>
              <div className="space-y-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Question / Trigger</label>
                <input 
                  type="text" 
                  className="w-full p-4 rounded-xl bg-surface-high ghost-border focus:outline-none focus:border-primary/50 text-on-surface" 
                  placeholder="e.g. What is your refund policy?" 
                  value={formData.question}
                  onChange={e => setFormData(prev => ({ ...prev, question: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">Answer / Response</label>
                <textarea 
                  className="w-full p-4 rounded-xl bg-surface-high ghost-border focus:outline-none focus:border-primary/50 h-32 text-on-surface" 
                  placeholder="Provide the detailed answer here..."
                  value={formData.answer}
                  onChange={e => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">Topic</label>
                  <select 
                    className="w-full p-4 rounded-xl bg-surface-high ghost-border focus:outline-none text-on-surface"
                    value={formData.topic}
                    onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  >
                    <option>General</option>
                    <option>Policy</option>
                    <option>Product</option>
                    <option>Technical</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">Priority</label>
                  <select 
                    className="w-full p-4 rounded-xl bg-surface-high ghost-border focus:outline-none text-on-surface"
                    value={formData.priority}
                    onChange={e => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  >
                    <option value={1}>1 (High)</option>
                    <option value={2}>2 (Medium)</option>
                    <option value={3}>3 (Low)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-4 rounded-xl ember-gradient text-on-primary-fixed font-bold shadow-xl active:scale-95 transition-all">
                Save Knowledge Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-5 py-2 rounded-full text-xs font-bold transition-all",
        active 
          ? "bg-primary text-on-primary-fixed shadow-[0_0_15px_rgba(255,183,123,0.2)]" 
          : "bg-surface text-outline hover:bg-surface-high ghost-border"
      )}
    >
      {label}
    </button>
  );
}

function MetaItem({ label, value, mono }: any) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-outline">{label}</span>
      <span className={cn("text-on-surface font-medium", mono && "text-primary font-mono font-bold tracking-tight")}>{value}</span>
    </div>
  );
}
