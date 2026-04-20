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
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TestUserManagement() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
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
    if (!isAdmin) return;
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
    if (isAdmin) fetchData();
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="size-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col bg-background p-6 lg:p-10">
        <Header title="Vault Access Restricted" subtitle="Identity Shield Active" />
        <main className="flex-1 flex items-center justify-center">
          <div className="max-w-2xl w-full glass-panel rounded-3xl p-12 text-center border border-primary/10 shadow-2xl">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-8 shadow-inner">
              <Database className="size-10" />
            </div>
            <h2 className="text-3xl font-headline font-black tracking-tight mb-4">Neural Clearance Required</h2>
            <p className="text-on-surface-variant max-w-sm mx-auto mb-10 leading-relaxed">
              The Test User Vault contains sensitive identity samples. Your current clearance is insufficient.
            </p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-8 py-3.5 rounded-xl bg-primary text-on-primary-fixed font-bold flex items-center gap-2 mx-auto hover:brightness-110 active:scale-95 transition-all shadow-lg"
            >
              Return to Grid
            </button>
          </div>
        </main>
      </div>
    );
  }

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
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="size-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col min-w-0 overflow-hidden">
      <Header
        title="Test User Vault"
        subtitle="Data Sovereignty"
        actions={<div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-outline group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Query vault..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-surface-low border border-outline-variant/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary/30 w-64 transition-all"
            />
          </div>
          <button
            onClick={() => setIsAddingColumn(true)}
            className="px-4 py-2 rounded-xl bg-surface-low text-outline font-bold text-[10px] uppercase tracking-widest border border-outline-variant/5 hover:bg-surface-high transition-all flex items-center gap-2"
          >
            <Columns className="size-3.5" /> Evolve Schema
          </button>
          <button
            onClick={() => {
              setUserFormData({});
              setIsAddingUser(true);
            }}
            className="px-6 py-2 rounded-xl bg-primary text-on-primary-fixed font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <Plus className="size-4" /> Provision User
          </button>
        </div>}
      />
      <div className="p-10 flex flex-col gap-10 flex-1 min-w-0 overflow-hidden">
        {/* Schema DNA Row */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <span className="text-[8px] font-black uppercase tracking-widest text-outline mr-2 self-center opacity-50">Active Payload:</span>
          {schema.map(col => (
            <div key={col.cid} className="px-2.5 py-1 rounded-lg bg-surface-low border border-outline-variant/5 flex items-center gap-2 group transition-all hover:border-primary/20">
              <span className="text-[9px] font-bold text-outline group-hover:text-primary transition-colors uppercase tracking-wider">{col.name}</span>
              <span className="text-[7px] px-1 bg-surface-lowest rounded-md font-mono text-outline/40 font-black">{col.type}</span>
            </div>
          ))}
        </div>

        {/* Main Vault Content */}
        <div className="flex-1 bg-surface-lowest rounded-4xl border border-outline-variant/10 relative overflow-hidden flex flex-col premium-forge-border shadow-inner">
          <div className="flex-1 overflow-auto scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-lowest z-10 shadow-sm">
                <tr className="border-b border-outline-variant/10">
                  <th className="px-8 py-4 text-[9px] font-bold text-outline uppercase tracking-widest">Neural Entity</th>
                  {schema.filter(col => !['customer_name', 'account_number', 'id', 'created_at', 'updated_at'].includes(col.name)).map(col => (
                    <th key={col.cid} className="px-6 py-4 text-[9px] font-bold text-outline uppercase tracking-widest">{col.name}</th>
                  ))}
                  <th className="w-[120px] px-8 py-4 text-right text-[9px] font-bold text-outline uppercase tracking-widest">Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filteredCustomers.map((user) => (
                  <tr key={user.account_number} className="hover:bg-primary/5 transition-all group border-b border-outline-variant/5">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="size-10 rounded-xl bg-surface-low flex items-center justify-center border border-outline-variant/5 text-outline group-hover:text-primary transition-all shadow-inner shrink-0">
                          <User className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors truncate">{user.customer_name || 'Unnamed Record'}</h3>
                          <p className="text-[9px] font-mono text-outline/50 tracking-tighter uppercase font-black truncate">ACC: {user.account_number}</p>
                        </div>
                      </div>
                    </td>
                    {schema.filter(col => !['customer_name', 'account_number', 'id', 'created_at', 'updated_at'].includes(col.name)).map(col => (
                      <td key={col.cid} className="px-6 py-5 min-w-[150px] max-w-[250px]">
                        <div className="text-[11px] font-bold text-outline italic truncate" title={user[col.name] !== null ? String(user[col.name]) : ''}>
                          {user[col.name] !== null ? String(user[col.name]) : '—'}
                        </div>
                      </td>
                    ))}
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setUserFormData(user);
                            setEditingUser(user);
                            setIsAddingUser(true);
                          }}
                          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary-fixed transition-all"
                          title="Edit Entry"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.account_number)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 text-outline hover:text-rose-500 transition-all border border-transparent hover:border-rose-500/20"
                          title="Purge Entry"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="size-16 rounded-3xl bg-surface-low border border-outline-variant/5 flex items-center justify-center text-outline/20 mb-4">
                  <Database className="size-8" />
                </div>
                <h4 className="text-sm font-bold text-on-surface uppercase tracking-widest">Vault Empty</h4>
                <p className="text-[10px] text-outline font-medium mt-1 uppercase tracking-widest">No neural records matching the current query.</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-surface-low/50 border-t border-outline-variant/5 flex justify-between items-center shrink-0">
            <p className="text-[10px] font-bold text-outline uppercase tracking-widest">
              Total Entities: <span className="text-on-surface">{customers.length}</span>
            </p>
            <p className="text-[10px] font-bold text-outline uppercase tracking-widest">
              Neural Schema Version: <span className="text-primary">v2.4.1</span>
            </p>
          </div>
        </div>

        {/* Add Column Modal */}
        {isAddingColumn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-sm animate-in fade-in duration-300 p-6">
            <div className="w-full max-w-md bg-surface-lowest rounded-[2.5rem] p-10 shadow-3xl border border-outline-variant/10 animate-in zoom-in-95 duration-300 premium-forge-border">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Columns className="size-5" /></div>
                  <h2 className="text-xl font-headline font-extrabold uppercase tracking-tight">Evolve Schema</h2>
                </div>
                <button onClick={() => setIsAddingColumn(false)} className="text-outline hover:text-on-surface transition-all"><X className="size-5" /></button>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-outline ml-1">Field Identifier</label>
                  <input
                    type="text"
                    placeholder="e.g. risk_category"
                    className="w-full bg-surface-low/50 border border-outline-variant/10 rounded-2xl px-6 py-4 text-sm font-bold text-on-surface focus:border-primary/40 outline-none transition-all placeholder:opacity-30"
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                  />
                  <div className="flex items-center justify-between px-4 py-2 bg-surface-low/40 rounded-xl mt-1">
                    <p className="text-[8px] text-outline uppercase font-bold tracking-widest">Mapped Key:</p>
                    <span className="text-[9px] font-mono font-black text-primary">
                      {newColumnName.trim().replace(/\s+/g, '_').replace(/-/g, '_').toLowerCase() || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-outline ml-1">Acoustic Logic</label>
                  <select
                    className="w-full h-14 bg-surface-low/50 border border-outline-variant/10 rounded-2xl px-6 py-0 text-sm focus:border-primary/40 outline-none transition-all cursor-pointer font-bold appearance-none"
                    value={newColumnType}
                    onChange={e => setNewColumnType(e.target.value)}
                  >
                    <option value="TEXT">TEXT (Linguistic)</option>
                    <option value="REAL">REAL (Metric)</option>
                    <option value="INTEGER">INT (Counter)</option>
                  </select>
                </div>

                <button
                  onClick={handleAddColumn}
                  className="w-full py-5 rounded-2xl bg-primary text-on-primary-fixed font-bold text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                >
                  Apply Schema Logic
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Provision User Modal */}
        {isAddingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-sm animate-in fade-in duration-400 p-6">
            <div className="w-full max-w-2xl bg-surface-lowest rounded-[3rem] p-12 shadow-3xl border border-outline-variant/10 animate-in slide-in-from-bottom-5 duration-400 premium-forge-border max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Plus className="size-6" /></div>
                  <h2 className="text-2xl font-headline font-extrabold uppercase tracking-tight">{editingUser ? 'Synchronize Record' : 'Provision Identity'}</h2>
                </div>
                <button onClick={() => { setIsAddingUser(false); setEditingUser(null); }} className="text-outline hover:text-on-surface transition-all"><X className="size-6" /></button>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-10">
                {schema.filter(col => !['id', 'created_at', 'updated_at'].includes(col.name)).map(col => (
                  <div key={col.cid} className="flex flex-col gap-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-outline flex items-center justify-between ml-1">
                      {col.name.replace(/_/g, ' ')}
                      <span className="text-[7px] bg-surface-low px-2 py-0.5 rounded opacity-60 font-black">{col.type}</span>
                    </label>
                    <input
                      type={col.type === 'REAL' || col.type === 'INTEGER' ? 'number' : 'text'}
                      placeholder={`Enter ${col.name}...`}
                      className="w-full bg-surface-low/50 border border-outline-variant/10 rounded-2xl px-6 py-4 text-sm font-bold text-on-surface focus:border-primary/40 outline-none transition-all placeholder:opacity-20"
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
                  className="flex-1 py-5 rounded-2xl bg-surface-low font-bold text-[10px] uppercase tracking-widest text-outline hover:text-on-surface transition-all border border-outline-variant/5"
                >
                  Cancel Protocol
                </button>
                <button
                  onClick={handleSaveUser}
                  className="grow py-5 rounded-2xl bg-primary text-on-primary-fixed font-bold text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="size-5" />
                  {editingUser ? 'Synchronize' : 'Initialize'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
