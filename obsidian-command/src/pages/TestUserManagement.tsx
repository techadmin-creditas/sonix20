import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  AlertCircle,
  Columns,
  Database,
  Loader2,
  X,
  CreditCard,
  User,
  Settings2
} from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export default function TestUserManagement() {
  const [schema, setSchema] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('TEXT');
  const [userFormData, setUserFormData] = useState<any>({});
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [schemaRes, customerRes] = await Promise.all([
        api.request('GET', '/test-customers/schema'),
        api.request('GET', '/test-customers')
      ]);
      setSchema(schemaRes.columns || []);
      setCustomers(customerRes.customers || []);
    } catch (err) {
      console.error("Failed to fetch test users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    try {
      await api.request('POST', '/test-customers/schema/columns', { 
        name: newColumnName.trim(),
        type: newColumnType 
      });
      setIsAddingColumn(false);
      setNewColumnName('');
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to add column");
    }
  };

  const handleSaveUser = async () => {
    try {
      await api.request('POST', '/test-customers', userFormData);
      setIsAddingUser(false);
      setEditingUser(null);
      setUserFormData({});
      fetchData();
    } catch (err) {
      alert("Failed to save user");
    }
  };

  const handleDeleteUser = async (accNum: string) => {
    if (!window.confirm(`Delete customer ${accNum}?`)) return;
    try {
      await api.request('DELETE', `/test-customers/${accNum}`);
      fetchData();
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const filteredCustomers = customers.filter(c => 
    Object.values(c).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  if (loading && customers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="size-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-10 bg-background overflow-y-auto font-body dark">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex flex-col gap-2">
           <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Database className="size-6" />
              </div>
              <h1 className="text-4xl font-headline font-black tracking-tight text-on-surface">Test User Vault</h1>
           </div>
           <p className="text-on-surface-variant font-medium opacity-60 ml-1">Configure customer scenarios with dynamic metadata injection.</p>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsAddingColumn(true)}
            className="px-6 py-3 rounded-2xl bg-surface-high text-on-surface font-bold text-sm border border-outline-variant/10 hover:bg-surface-highest transition-all flex items-center gap-2"
          >
            <Columns className="size-4" /> Add Field
          </button>
          <button 
            onClick={() => {
              setUserFormData({});
              setIsAddingUser(true);
            }}
            className="px-8 py-3 rounded-2xl ember-gradient text-on-primary-fixed font-headline font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <Plus className="size-5" /> Provision User
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-outline" />
          <input 
            type="text" 
            placeholder="Search by name, account, or any dynamic attribute..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface-low border border-outline-variant/10 rounded-2xl pl-14 pr-6 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        <div className="flex bg-surface-low p-1.5 rounded-2xl border border-outline-variant/5 shadow-sm">
           <button className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm"><List className="size-5" /></button>
           <button className="p-2.5 rounded-xl text-outline hover:text-on-surface"><LayoutGrid className="size-5" /></button>
        </div>
      </div>

      {/* Schema Badge Row */}
      <div className="flex flex-wrap gap-2 mb-8">
         <span className="text-[10px] font-black uppercase tracking-widest text-outline mr-2 self-center">Active Payload:</span>
         {schema.map(col => (
           <div key={col.cid} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2 group transition-all hover:bg-white/10">
              <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-primary transition-colors">{col.name}</span>
              <span className="text-[9px] px-1.5 bg-black/30 rounded font-mono text-outline">{col.type}</span>
           </div>
         ))}
      </div>

      {/* Main Table */}
      <div className="bg-surface-low rounded-[32px] border border-outline-variant/10 shadow-2xl overflow-hidden glass-panel">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-high">
            <tr>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-outline">Entity</th>
              {schema.filter(col => !['customer_name', 'account_number', 'id', 'created_at', 'updated_at'].includes(col.name)).map(col => (
                <th key={col.cid} className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-outline">{col.name}</th>
              ))}
              <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-outline">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {filteredCustomers.map((user) => (
              <tr key={user.account_number} className="hover:bg-primary/5 transition-all group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-surface-highest flex items-center justify-center border border-outline-variant/10 text-outline group-hover:text-primary transition-all shadow-inner">
                      <User className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">{user.customer_name || 'Unnamed Record'}</h3>
                      <p className="text-[11px] font-mono text-outline tracking-tighter opacity-60">ACC: {user.account_number}</p>
                    </div>
                  </div>
                </td>
                {schema.filter(col => !['customer_name', 'account_number', 'id', 'created_at', 'updated_at'].includes(col.name)).map(col => (
                  <td key={col.cid} className="px-6 py-6">
                    <span className="text-sm font-medium text-on-surface-variant/80 italic">
                      {user[col.name] !== null ? String(user[col.name]) : '—'}
                    </span>
                  </td>
                ))}
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => {
                        setUserFormData(user);
                        setEditingUser(user);
                        setIsAddingUser(true);
                      }}
                      className="p-3 rounded-xl hover:bg-primary/10 text-outline hover:text-primary transition-all"
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.account_number)}
                      className="p-3 rounded-xl hover:bg-red-500/10 text-outline hover:text-red-500 transition-all"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCustomers.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4">
             <div className="size-20 rounded-full bg-surface-high flex items-center justify-center text-outline/20">
                <Users className="size-10" />
             </div>
             <div>
                <h4 className="text-lg font-bold text-on-surface">No Records Found</h4>
                <p className="text-sm text-outline">Try searching for something else or seed new data.</p>
             </div>
          </div>
        )}
      </div>

      {/* Add Column Modal */}
      {isAddingColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-[480px] bg-surface rounded-[40px] p-10 shadow-2xl border border-primary/20 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Columns className="size-5" /></div>
                    <h2 className="text-2xl font-headline font-black">Evolve Payload</h2>
                 </div>
                 <button onClick={() => setIsAddingColumn(false)} className="text-outline hover:text-on-surface transition-all"><X className="size-5" /></button>
              </div>
              
              <div className="space-y-6">
                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-outline">Field Identifier</label>
                    <input 
                      type="text" 
                      placeholder="e.g. risk_category, last_payment_date"
                      className="w-full bg-surface-low border border-outline-variant/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all font-mono"
                      value={newColumnName}
                      onChange={e => setNewColumnName(e.target.value)}
                    />
                    <div className="flex items-center justify-between px-1 bg-black/10 p-2 rounded-lg mt-1">
                       <p className="text-[9px] text-outline italic leading-relaxed">
                         Correction Preview:
                       </p>
                       <span className="text-[10px] font-mono font-bold text-primary">
                         {newColumnName.trim().replace(/\s+/g, '_').replace(/-/g, '_').toLowerCase() || '—'}
                       </span>
                    </div>
                 </div>

                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-outline">Data Type</label>
                    <select 
                      className="w-full h-14 bg-surface-low border border-outline-variant/10 rounded-2xl px-6 py-0 text-sm focus:outline-none transition-all cursor-pointer font-bold"
                      value={newColumnType}
                      onChange={e => setNewColumnType(e.target.value)}
                    >
                      <option value="TEXT">Text String</option>
                      <option value="REAL">Decimal / Number</option>
                      <option value="INTEGER">Whole Number</option>
                    </select>
                 </div>

                 <button 
                  onClick={handleAddColumn}
                  className="w-full py-5 rounded-2xl bg-primary text-on-primary font-headline font-black text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all mt-4"
                 >
                    Apply Database Migration
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Provision User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="w-[640px] bg-surface rounded-[40px] p-12 shadow-2xl border border-outline-variant/10 animate-in slide-in-from-bottom-5 duration-300 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Plus className="size-6" /></div>
                    <h2 className="text-3xl font-headline font-black">{editingUser ? 'Sync Entity' : 'Provision Identity'}</h2>
                 </div>
                 <button onClick={() => { setIsAddingUser(false); setEditingUser(null); }} className="text-outline hover:text-on-surface transition-all"><X className="size-6" /></button>
              </div>
              
              <div className="grid grid-cols-2 gap-8 mb-10">
                 {schema.filter(col => !['id', 'created_at', 'updated_at'].includes(col.name)).map(col => (
                    <div key={col.cid} className="flex flex-col gap-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-outline flex items-center justify-between">
                         {col.name.replace(/_/g, ' ')}
                         <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded italic opacity-40 font-normal">{col.type}</span>
                       </label>
                       <input 
                         type={col.type === 'REAL' || col.type === 'INTEGER' ? 'number' : 'text'}
                         className="w-full bg-surface-low border border-outline-variant/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                         disabled={col.name === 'account_number' && editingUser !== null}
                         value={userFormData[col.name] || ''}
                         onChange={e => setUserFormData({ ...userFormData, [col.name]: e.target.value })}
                       />
                    </div>
                 ))}
              </div>

              <div className="flex items-center gap-4 pt-4">
                  <button 
                    onClick={() => { setIsAddingUser(false); setEditingUser(null); }}
                    className="flex-1 py-5 rounded-2xl bg-surface-high font-bold text-sm hover:bg-surface-highest transition-all"
                  >
                    Discard Changes
                  </button>
                  <button 
                    onClick={handleSaveUser}
                    className="grow py-5 rounded-2xl bg-primary text-on-primary font-headline font-black text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="size-5" />
                    {editingUser ? 'Verify & Commit' : 'Initialize Record'}
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
