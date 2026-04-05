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
  X,
  Cpu,
  History,
  Terminal,
  Activity
} from 'lucide-react';
import { KNOWLEDGE_BASE } from '../constants';
import { cn } from '../lib/utils';
import { api, KnowledgeEntry, RawVectorEntry, QACacheEntry } from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function KnowledgeBase() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Global');
  const [activeTab, setActiveTab] = useState<'manual' | 'learned' | 'vector' | 'ingest' | 'tools'>('manual');
  const [vectorSubTab, setVectorSubTab] = useState<'memory' | 'qa'>('memory');
  const [bots, setBots] = useState<any[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({ question: '', answer: '', topic: 'General', priority: 2 });

  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [toolData, setToolData] = useState({
    name: '',
    description: '',
    url: '',
    method: 'GET',
    parameters: '{"city": "string"}',
    headers: '{}'
  });

  const loadEntries = async () => {
    setLoading(true);
    try {
      if (activeTab === 'manual') {
        const data = await api.getKnowledgeEntries();
        setEntries(data);
      } else if (activeTab === 'learned' || activeTab === 'manual') {
          // Fallback or specific logic
          if (activeTab === 'learned' && selectedBotId) {
            const data = await api.getLearnedMemory(selectedBotId);
            setEntries(data.map((d: any) => ({
                id: d.id,
                question: d.category.toUpperCase() + ": " + d.source,
                answer: d.content,
                topic: d.category,
                priority: 1,
                created_at: parseFloat(d.timestamp) || Date.now() / 1000
            })));
          }
      } else if (activeTab === 'vector') {
        if (vectorSubTab === 'memory') {
          const data = await api.getAllVectorMemory();
          setEntries(data.map(d => ({
            id: d.id,
            question: d.metadata?.source || `Document Shard: ${d.id.slice(0, 8)}...`,
            answer: d.content,
            topic: d.metadata?.category?.toUpperCase() || 'CORE',
            priority: 0,
            created_at: parseFloat(d.metadata?.timestamp) || Date.now() / 1000,
            rawMetadata: d.metadata
          })));
        } else {
          const data = await api.getQACacheMemory();
          setEntries(data.map(d => ({
            id: d.id,
            question: d.question,
            answer: d.answer,
            topic: 'QA Cache',
            priority: 0,
            created_at: parseFloat(d.cached_at) || Date.now() / 1000,
            bot_id: d.bot_id
          })));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBots = async () => {
    try {
      const data = await api.getBots();
      setBots(data);
      if (data.length > 0 && !selectedBotId) {
        setSelectedBotId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTools = async () => {
    try {
      const data = await api.getCustomTools();
      setTools(data);
    } catch (err) { console.error(err); }
  };

  React.useEffect(() => {
    loadBots();
  }, []);

  React.useEffect(() => {
    loadEntries();
    if (activeTab === 'tools') loadTools();
  }, [activeTab, selectedBotId, vectorSubTab]);
  
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = (entry.question || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (entry.answer || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'Global' || (entry.topic === activeFilter);
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this knowledge entry?')) {
      try {
        if (activeTab === 'manual') {
          await api.deleteKnowledgeEntry(id);
        } else {
          await api.deleteLearnedMemory(id.toString());
        }
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

  const handleToolForge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedParams = {};
      let parsedHeaders = {};
      try { parsedParams = JSON.parse(toolData.parameters); } catch { alert('Invalid JSON in Parameters'); return; }
      try { parsedHeaders = JSON.parse(toolData.headers); } catch { alert('Invalid JSON in Headers'); return; }
      await api.createCustomTool({
        name: toolData.name,
        description: toolData.description,
        url: toolData.url,
        method: toolData.method,
        parameters: parsedParams,
        headers: parsedHeaders,
      });
      setIsToolModalOpen(false);
      setToolData({ name: '', description: '', url: '', method: 'GET', parameters: '{"city": "string"}', headers: '{}' });
      loadTools();
    } catch (err) {
      alert('Failed to forge tool — check console for details.');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/5 blur-[120px] rounded-full"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/2 blur-[150px] rounded-full"></div>

      <Header 
        title="Intelligence Hub" 
        subtitle="Manage knowledge core and autonomous tools."
        actions={
          <div className="flex gap-4">
             <button 
               onClick={() => setIsModalOpen(true)}
               className="h-10 px-6 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-outline font-bold flex items-center gap-2"
             >
                <PlusCircle className="size-4" />
                New Entry
             </button>
             <button 
               onClick={() => setActiveTab('tools')}
               className="h-10 px-6 rounded-xl ember-gradient text-on-primary-fixed font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all"
             >
                <Cpu className="size-4" />
                Forge Tool
             </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar z-10">
        <div className="flex justify-between items-end mb-10 mt-8">
          <div>
            <h2 className="text-4xl font-extrabold text-on-surface tracking-tight uppercase tracking-widest">Neural Memory Core</h2>
            <p className="text-outline mt-2 text-lg">Manage distributed knowledge shards and autonomous capabilities.</p>
          </div>
        </div>

        <div className="mb-10 flex flex-col md:flex-row gap-6 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-6 text-outline group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Find any topic, question, or answer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-16 pl-16 pr-6 bg-surface-low rounded-xl border-none ring-1 ring-white/5 focus:ring-primary/40 focus:bg-surface transition-all text-lg placeholder:text-outline/50 text-on-surface shadow-xl shadow-primary/5"
            />
          </div>
          <div className="flex bg-surface-low p-1.5 rounded-2xl ghost-border h-16 shrink-0 overflow-x-auto no-scrollbar">
             {[
               { id: 'manual', label: 'Manual Core' },
               { id: 'learned', label: 'Autonomous' },
               { id: 'vector', label: 'Vector Store' },
               { id: 'ingest', label: 'Unified Inflow' },
               { id: 'tools', label: 'Tools Forge' }
             ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={cn("px-6 rounded-xl font-bold transition-all text-[10px] uppercase tracking-[0.2em] whitespace-nowrap", 
                    activeTab === t.id ? "ember-gradient text-on-primary-fixed shadow-lg" : "text-outline hover:bg-white/5")}
                >
                   {t.label}
                </button>
             ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-outline uppercase tracking-widest mr-2">Shard Filter:</span>
              <div className="flex flex-wrap gap-3">
              {activeTab === 'manual' ? (
                  ['Global', 'Sales', 'Support', 'Fulfillment'].map(filter => (
                      <FilterChip 
                          key={filter} 
                          label={filter} 
                          active={activeFilter === filter} 
                          onClick={() => setActiveFilter(filter)}
                      />
                  ))
              ) : (activeTab === 'learned' || activeTab === 'vector') ? (
                <>
                  <FilterChip 
                    label="Global Cluster" 
                    active={activeFilter === 'Global'} 
                    onClick={() => setActiveFilter('Global')} 
                  />
                  <FilterChip 
                    label="PDF Shards" 
                    active={activeFilter === 'DOCUMENTATION'} 
                    onClick={() => setActiveFilter('DOCUMENTATION')} 
                  />
                  <FilterChip 
                    label="Web Crawls" 
                    active={activeFilter === 'WEBSITE'} 
                    onClick={() => setActiveFilter('WEBSITE')} 
                  />
                </>
              ) : null}
              </div>
            </div>

            <div className="flex items-center gap-6">
              {activeTab === 'learned' && (
                <div className="flex h-10 px-4 bg-white/5 rounded-full items-center border border-white/10 gap-4">
                  <span className="text-[10px] font-black text-outline uppercase tracking-widest">Node:</span>
                  <select 
                    className="bg-transparent text-[10px] font-black text-primary uppercase focus:outline-none cursor-pointer"
                    value={selectedBotId}
                    onChange={e => setSelectedBotId(e.target.value)}
                  >
                    {bots.map(bot => (
                      <option key={bot.id} value={bot.id}>{bot.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {activeTab === 'vector' && (
                <div className="flex gap-2">
                  <FilterChip 
                    label="Long-term Memory" 
                    active={vectorSubTab === 'memory'} 
                    onClick={() => setVectorSubTab('memory')}
                  />
                  <FilterChip 
                    label="Semantic Cache" 
                    active={vectorSubTab === 'qa'} 
                    onClick={() => setVectorSubTab('qa')}
                  />
                </div>
              )}
              {['learned', 'vector'].includes(activeTab) && (
                <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest px-4 py-2 bg-primary/5 rounded-lg border border-primary/20 flex items-center gap-2">
                  <Activity className="size-3 animate-pulse" />
                  Live Cluster Active
                </div>
              )}
            </div>
        </div>

        <div className="flex gap-8 relative">
          <div className="flex-1">
            {activeTab === 'ingest' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-10 rounded-2xl bg-surface-low border border-white/5 shadow-2xl relative overflow-hidden group hover:border-primary/20 transition-all">
                        <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                            <ExternalLink size={240} className="text-primary" />
                        </div>
                        <h3 className="text-3xl font-black text-on-surface mb-2 uppercase tracking-tighter">Crawl Intelligence</h3>
                        <p className="text-outline text-sm mb-10 font-medium max-w-xs">Index any website or support documentation directly into the neural cluster.</p>
                        <div className="space-y-4">
                            <input 
                              type="text" 
                              placeholder="https://docs.example.com/shipping-policy"
                              className="w-full h-14 px-6 bg-surface-highest rounded-xl ghost-border text-on-surface focus:outline-none focus:border-primary/50 transition-all font-mono text-xs"
                              value={ingestUrl}
                              onChange={e => setIngestUrl(e.target.value)}
                            />
                            <button 
                              onClick={async () => {
                                setIngestLoading(true);
                                try { await api.ingestUrl(ingestUrl); alert('Ingestion job forked!'); setIngestUrl(''); } catch(e) { alert('Failed'); }
                                finally { setIngestLoading(false); }
                              }}
                              disabled={ingestLoading || !ingestUrl}
                              className="w-full h-14 rounded-xl ember-gradient text-on-primary-fixed font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all"
                            >
                                {ingestLoading ? <Loader2 size={20} className="animate-spin" /> : 'Execute Neural Index'}
                            </button>
                        </div>
                    </div>

                    <div className="p-10 rounded-2xl bg-surface-low border border-white/5 shadow-2xl relative overflow-hidden group hover:border-primary/20 transition-all">
                        <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Database size={240} className="text-primary" />
                        </div>
                        <h3 className="text-3xl font-black text-on-surface mb-2 uppercase tracking-tighter">Shard Ingestion</h3>
                        <p className="text-outline text-sm mb-10 font-medium max-w-xs">Upload manual PDF shards to expand the distributed vector knowledge base.</p>
                        <input 
                          type="file" id="pdf-ingest" className="hidden" accept=".pdf" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try { await api.ingestPdf(file); alert('Knowledge shard uploaded!'); } catch(e) { alert('Upload failed'); }
                            }
                          }}
                        />
                        <label 
                          htmlFor="pdf-ingest"
                          className="w-full h-14 rounded-xl ghost-border bg-surface-highest hover:bg-surface-high transition-all text-outline font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer border-dashed border-2"
                        >
                            <PlusCircle size={20} />
                            Ingest PDF Shard
                        </label>
                    </div>
                </div>
            ) : activeTab === 'tools' ? (
              <div className="space-y-6">
                 <div className="p-10 rounded-3xl bg-surface-low border border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-3xl font-black text-on-surface uppercase tracking-tight">Active Tool Registry</h3>
                            <p className="text-outline text-sm font-medium mt-1">Manage dynamically discovered tools and custom API endpoints.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tools.map(tool => (
                            <div key={tool.id} className="p-6 rounded-2xl bg-surface-highest ghost-border hover:border-primary/30 transition-all group relative">
                                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 rounded-lg bg-surface hover:text-primary"><Edit2 size={12} /></button>
                                </div>
                                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-inner ring-1 ring-primary/20">
                                    <Cpu size={22} />
                                </div>
                                <h4 className="font-bold text-on-surface text-lg mb-1 leading-tight">{tool.name}</h4>
                                <p className="text-[11px] text-outline line-clamp-2 leading-relaxed mb-6 font-medium">{tool.description}</p>
                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <span className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded text-outline uppercase tracking-wider">{tool.type}</span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <div className="size-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        Verified
                                    </span>
                                </div>
                            </div>
                        ))}
                        <button 
                          onClick={() => setIsToolModalOpen(true)}
                          className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all text-outline hover:text-primary group"
                        >
                            <PlusCircle size={40} className="opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em]">Forge New Tool Capability</span>
                        </button>
                    </div>
                 </div>
              </div>
            ) : (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                     {loading ? (
                       <div className="col-span-2 py-40 flex flex-col items-center justify-center gap-4">
                         <Loader2 className="size-10 text-primary animate-spin" />
                         <p className="text-outline font-black uppercase tracking-[0.3em] text-[10px]">Accessing Distributed Core...</p>
                       </div>
                     ) : (
                       <>
                         {filteredEntries.map((entry) => (
                           <div 
                             key={entry.id}
                             onClick={() => { setSelectedEntry(entry); setShowPreview(true); }}
                             className={cn(
                               "group p-6 rounded-2xl bg-white/3 ghost-border hover:bg-white/7 transition-all cursor-pointer relative",
                               selectedEntry?.id === entry.id && showPreview && "border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-xl"
                             )}
                           >
                             <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={(e) => handleDelete(entry.id, e)} className="p-2 rounded-lg bg-surface-highest text-error/60 hover:text-error transition-colors shadow-lg"><Trash2 className="size-3.5" /></button>
                             </div>
                             <div className="flex justify-between items-start mb-6">
                               <div className="flex items-center gap-3">
                                 <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg", entry.priority >= 5 ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "bg-surface-highest text-outline ring-1 ring-white/5")}>
                                    {activeTab === 'vector' ? <Cpu className="size-5" /> : activeTab === 'learned' ? <History className="size-5" /> : <Database className="size-5" />}
                                 </div>
                                 <div>
                                   <p className="text-[10px] font-black text-primary/80 uppercase tracking-widest">{entry.topic}</p>
                                   <p className="text-[11px] text-outline font-bold mt-0.5">Priority {entry.priority}</p>
                                 </div>
                               </div>
                             </div>
                             <h4 className="text-lg font-bold text-on-surface mb-3 leading-tight font-headline tracking-tight">{entry.question}</h4>
                             <p className="text-outline text-sm line-clamp-2 leading-relaxed font-medium opacity-80">{entry.answer}</p>
                           </div>
                         ))}
                         {filteredEntries.length === 0 && (
                           <div className="col-span-2 py-32 text-center bg-surface-low/50 rounded-3xl ghost-border border-dashed">
                             <Database className="size-16 text-outline/10 mx-auto mb-6" />
                             <p className="text-on-surface font-headline font-bold text-lg mb-2">No Clusters Found</p>
                             <p className="text-outline text-sm max-w-xs mx-auto">No knowledge shards matching your search parameters were found in the current cluster.</p>
                           </div>
                         )}
                       </>
                     )}
                </div>
            )}

            {/* Preview Pane */}
            {showPreview && selectedEntry && !['ingest', 'tools'].includes(activeTab) && (
              <div className="w-96 shrink-0 glass-panel p-10 rounded-3xl ghost-border border-white/5 sticky top-24 h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar shadow-2xl z-20">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-2xl font-black text-on-surface tracking-tighter uppercase ls-tight">Shard Data</h3>
                  <button onClick={() => setShowPreview(false)} className="size-8 rounded-full bg-white/5 flex items-center justify-center text-outline hover:text-on-surface hover:bg-white/10 transition-all"><X className="size-4" /></button>
                </div>
                <div className="space-y-10">
                  <div>
                    <p className="text-[10px] font-black text-outline uppercase tracking-[0.3em] mb-4">Neural Vector Payload</p>
                    <div className="p-6 rounded-2xl bg-white/4 text-sm text-on-surface/80 leading-relaxed border-l-4 border-primary shadow-inner font-medium">
                      {selectedEntry.answer}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-outline uppercase tracking-[0.3em] mb-4">Attribute Cluster</p>
                    <div className="space-y-5">
                      <MetaItem label="Shard Hash" value={selectedEntry.id} mono />
                      <MetaItem label="Time Scoped" value={new Date((selectedEntry.created_at || 0) * 1000).toLocaleDateString()} />
                      <MetaItem label="Neural Collection" value={selectedEntry.topic} />
                      {activeTab === 'vector' && selectedEntry.rawMetadata && (
                        <div className="pt-6 space-y-4 border-t border-white/10">
                           <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.3em]">Raw Vector Attributes</p>
                           <div className="grid grid-cols-1 gap-2">
                              {Object.entries(selectedEntry.rawMetadata).map(([k, v]: [string, any]) => (
                                 <div key={k} className="p-3 bg-black/30 rounded-xl border border-white/5">
                                    <p className="text-[9px] font-black text-outline uppercase tracking-widest mb-1">{k}</p>
                                    <p className="text-[10px] font-mono text-primary/80 truncate font-bold">{String(v)}</p>
                                 </div>
                              ))}
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Q&A Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-surface-low w-full max-w-2xl rounded-[2.5rem] border border-white/10 p-12 relative z-10 shadow-3xl">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-4xl font-headline font-black uppercase tracking-tighter">Forge Entry</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="size-10 rounded-full bg-white/5 flex items-center justify-center text-outline hover:text-on-surface transition-all"
              >
                <X className="size-6" />
              </button>
            </div>
            <form className="space-y-8" onSubmit={handleAdd}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Activation Query</label>
                <input 
                  type="text" 
                  className="w-full h-16 px-8 rounded-2xl bg-surface-highest ghost-border focus:outline-none focus:border-primary/50 text-on-surface font-headline font-bold text-lg" 
                  placeholder="e.g. Identity Disclosure Protocol" 
                  value={formData.question}
                  onChange={e => setFormData(prev => ({ ...prev, question: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Neural Output</label>
                <textarea 
                  className="w-full p-8 rounded-2xl bg-surface-highest ghost-border focus:outline-none focus:border-primary/50 h-40 text-on-surface font-medium leading-relaxed" 
                  placeholder="Input detailed factual response payload..."
                  value={formData.answer}
                  onChange={e => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                ></textarea>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Collection</label>
                  <select 
                    className="w-full h-16 px-6 rounded-2xl bg-surface-highest ghost-border focus:outline-none text-on-surface font-bold text-sm uppercase tracking-widest cursor-pointer"
                    value={formData.topic}
                    onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  >
                    <option>General</option>
                    <option>Policy</option>
                    <option>Technical</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Priority Rank</label>
                  <select 
                    className="w-full h-16 px-6 rounded-2xl bg-surface-highest ghost-border focus:outline-none text-on-surface font-bold text-sm uppercase tracking-widest cursor-pointer"
                    value={formData.priority}
                    onChange={e => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                  >
                    <option value={1}>Tier 1 (Critical)</option>
                    <option value={2}>Tier 2 (Standard)</option>
                    <option value={3}>Tier 3 (Informational)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full h-20 rounded-2xl ember-gradient text-on-primary-fixed font-black uppercase tracking-[0.4em] text-sm shadow-2xl active:scale-95 transition-all mt-4">
                Commit to Memory
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tool Forge Modal */}
      {isToolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsToolModalOpen(false)}></div>
          <div className="bg-surface-low w-full max-w-2xl rounded-[2.5rem] border border-white/10 p-12 relative z-10 shadow-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-4xl font-headline font-black uppercase tracking-tighter">Forge Tool</h3>
                <p className="text-outline text-[11px] font-bold mt-1">Define a new API capability for the bot's intelligence engine.</p>
              </div>
              <button onClick={() => setIsToolModalOpen(false)} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-outline hover:text-on-surface transition-all">
                <X className="size-6" />
              </button>
            </div>
            <form className="space-y-6" onSubmit={handleToolForge}>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Tool Name <span className="text-primary">*</span></label>
                  <input
                    type="text" required
                    placeholder="e.g. get_weather_update"
                    className="w-full h-14 px-6 rounded-2xl bg-surface-highest ghost-border focus:outline-none focus:border-primary/50 text-on-surface font-mono font-bold text-sm"
                    value={toolData.name}
                    onChange={e => setToolData(p => ({ ...p, name: e.target.value.replace(/\s+/g, '_').toLowerCase() }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">HTTP Method</label>
                  <select
                    className="w-full h-14 px-6 rounded-2xl bg-surface-highest ghost-border focus:outline-none text-on-surface font-black text-sm uppercase tracking-widest cursor-pointer"
                    value={toolData.method}
                    onChange={e => setToolData(p => ({ ...p, method: e.target.value }))}
                  >
                    {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Description <span className="text-primary">*</span></label>
                <input
                  type="text" required
                  placeholder="e.g. Fetch live weather data for a given city."
                  className="w-full h-14 px-6 rounded-2xl bg-surface-highest ghost-border focus:outline-none focus:border-primary/50 text-on-surface font-medium text-sm"
                  value={toolData.description}
                  onChange={e => setToolData(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">API Endpoint URL <span className="text-primary">*</span></label>
                <input
                  type="url" required
                  placeholder="https://api.example.com/weather?city={city}"
                  className="w-full h-14 px-6 rounded-2xl bg-surface-highest ghost-border focus:outline-none focus:border-primary/50 text-on-surface font-mono font-bold text-sm"
                  value={toolData.url}
                  onChange={e => setToolData(p => ({ ...p, url: e.target.value }))}
                />
                <p className="text-[10px] text-outline/60 ml-2">Use {'{'}<span className="text-primary font-mono">param</span>{'}'} placeholders to inject values from bot context.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Parameters Schema <span className="text-outline/50">(JSON)</span></label>
                <textarea
                  rows={3}
                  className="w-full p-4 rounded-2xl bg-surface-highest ghost-border focus:outline-none focus:border-primary/50 text-on-surface font-mono text-sm"
                  value={toolData.parameters}
                  onChange={e => setToolData(p => ({ ...p, parameters: e.target.value }))}
                  placeholder='{"city": "string", "unit": "celsius|fahrenheit"}'
                />
                <p className="text-[10px] text-outline/60 ml-2">Define what the LLM must extract to call this tool.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-outline uppercase tracking-[0.3em] ml-2">Request Headers <span className="text-outline/50">(optional JSON)</span></label>
                <textarea
                  rows={2}
                  className="w-full p-4 rounded-2xl bg-surface-highest ghost-border focus:outline-none focus:border-primary/50 text-on-surface font-mono text-sm"
                  value={toolData.headers}
                  onChange={e => setToolData(p => ({ ...p, headers: e.target.value }))}
                  placeholder='{"Authorization": "Bearer YOUR_API_KEY"}'
                />
              </div>
              <button type="submit" className="w-full h-16 rounded-2xl ember-gradient text-on-primary-fixed font-black uppercase tracking-[0.4em] text-sm shadow-2xl active:scale-95 transition-all mt-2">
                ⚙️ Deploy Tool to Intelligence Engine
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
        "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
        active 
          ? "bg-primary text-on-primary-fixed shadow-[0_0_20px_rgba(255,183,123,0.3)]" 
          : "bg-surface-highest text-outline hover:bg-white/5 ghost-border border-white/5"
      )}
    >
      {label}
    </button>
  );
}

function MetaItem({ label, value, mono }: any) {
  return (
    <div className="flex justify-between items-center text-[10px]">
      <span className="text-outline font-black uppercase tracking-widest">{label}</span>
      <span className={cn("text-on-surface font-bold", mono && "text-primary font-mono select-all tracking-tighter")}>{value}</span>
    </div>
  );
}
