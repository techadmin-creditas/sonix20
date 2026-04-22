import React from 'react';
import { 
  Zap, 
  Eraser, 
  Lock, 
  ZapOff,
  ChevronRight,
  ShieldAlert,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { AVAILABLE_MODULES } from '../constants/modules';

export const PRESETS = {
  DASHBOARD_ONLY: ['read:dashboard'],
  VIEW_ALL: AVAILABLE_MODULES.map(m => `read:${m.id}`),
  FULL_ACCESS: ['*'],
  CLEAR: []
};

interface PermissionSelectorProps {
  permissions: string[];
  onToggle: (permission: string) => void;
  onApplyPreset: (perms: string[]) => void;
  disabled?: boolean;
  isAdminRole?: boolean;
  selectedId?: string;
}

export const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  permissions,
  onToggle,
  onApplyPreset,
  disabled = false,
  isAdminRole = false,
  selectedId
}) => {
  const isGlobal = permissions.includes('*');

  // Filter out redundant permissions for cleaner display
  // e.g. if we have read:*, don't show read:dashboard separately
  const summaryPerms = React.useMemo(() => {
    if (isGlobal) return ['*'];
    const hasReadStar = permissions.includes('read:*');
    const hasUpdateStar = permissions.includes('update:*');
    
    return permissions.filter(p => {
      if (p === 'read:*' || p === 'update:*') return true;
      if (hasReadStar && p.startsWith('read:')) return false;
      if (hasUpdateStar && p.startsWith('update:')) return false;
      return true;
    });
  }, [permissions, isGlobal]);

  return (
    <div className="space-y-8">
      {/* Active Protocol Summary */}
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        {summaryPerms.map(p => (
          <motion.span 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={p} 
            className={cn(
              "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border",
              p === '*' ? "ember-gradient border-primary/20" :
              p.startsWith('read:') ? "bg-primary/10 text-primary border-primary/20" :
              p.startsWith('update:') ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
              "bg-surface-highest text-outline border-white/5"
            )}
          >
            {p === '*' && <Zap className="size-3" />}
            {p.startsWith('read:') && <ChevronRight className="size-2.5" />}
            {p.startsWith('update:') && <Lock className="size-2.5" />}
            {p.replace('read:', '').replace('update:', '').replace('*', 'Global')}
          </motion.span>
        ))}
      </div>

      {/* Presets Toolbar */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-white/5">
          <Zap className="size-4 text-primary" />
          <span className="text-[10px] font-bold uppercase text-primary tracking-widest">Presets</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.DASHBOARD_ONLY)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-surface-highest border border-white/10 text-[9px] font-bold uppercase hover:border-primary/30 disabled:opacity-30 transition-all active:scale-95"
          >
            Dashboard
          </button>
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.VIEW_ALL)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-surface-highest border border-white/10 text-[9px] font-bold uppercase hover:border-primary/30 disabled:opacity-30 transition-all active:scale-95"
          >
            Observer
          </button>
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.FULL_ACCESS)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold uppercase disabled:opacity-30 transition-all active:scale-95"
          >
            Full Access
          </button>
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.CLEAR)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-bold uppercase disabled:opacity-30 transition-all active:scale-95 flex items-center"
          >
            <Eraser className="size-3 mr-1" /> Clear
          </button>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="glass-panel overflow-hidden rounded-2xl border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-highest/10 border-b border-white/5">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-outline">Module</th>
                <th className="px-6 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-outline">Read</span>
                    <button
                      type="button"
                      disabled={disabled || isAdminRole || isGlobal}
                      onClick={() => {
                        const allRead = AVAILABLE_MODULES.map(m => `read:${m.id}`);
                        onApplyPreset(Array.from(new Set([...permissions, ...allRead])));
                      }}
                      className="text-[9px] font-bold uppercase text-primary/60 hover:text-primary transition-colors"
                    >
                      Set All
                    </button>
                  </div>
                </th>
                <th className="px-6 py-4">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-outline">Update</span>
                    <button
                      type="button"
                      disabled={disabled || isAdminRole || isGlobal}
                      onClick={() => {
                        const allUpdate = AVAILABLE_MODULES.map(m => `update:${m.id}`);
                        onApplyPreset(Array.from(new Set([...permissions, ...allUpdate])));
                      }}
                      className="text-[9px] font-bold uppercase text-amber-500/60 hover:text-amber-500 transition-colors"
                    >
                      Set All
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {AVAILABLE_MODULES.map((mod, idx) => {
                const hasRead = isGlobal || permissions.includes(`read:*`) || permissions.includes(`read:${mod.id}`);
                const hasUpdate = isGlobal || permissions.includes(`update:${mod.id}`);
                const isSystemProtected = mod.isAdminOnly;

                return (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    key={mod.id} 
                    className={cn(
                      "group hover:bg-white/5 transition-colors",
                      isSystemProtected && "bg-amber-500/2"
                    )}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "size-10 rounded-xl flex items-center justify-center transition-all shadow-inner",
                          isSystemProtected ? "bg-amber-500/10 text-amber-500" : "bg-surface-highest/50 text-outline"
                        )}>
                          <mod.icon className="size-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-on-surface tracking-tight">{mod.label}</p>
                          {isSystemProtected && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <ShieldAlert className="size-2.5 text-amber-500" />
                              <span className="text-[9px] font-bold uppercase text-amber-500/70 tracking-tighter">Admin</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          disabled={disabled || isAdminRole || isGlobal}
                          onClick={() => onToggle(`read:${mod.id}`)}
                          className={cn(
                            "size-6 rounded-lg border transition-all flex items-center justify-center group/check",
                            hasRead 
                              ? "bg-primary border-primary text-on-primary-fixed shadow-md shadow-primary/20" 
                              : "bg-background/50 border-primary/50 text-transparent hover:border-primary/50"
                          )}
                        >
                          <Check className={cn("size-3.5 stroke-[3px]", hasRead ? "opacity-100" : "opacity-100  group-hover/check:opacity-30 group-hover/check:text-outline")} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          disabled={disabled || isAdminRole || isGlobal}
                          onClick={() => onToggle(`update:${mod.id}`)}
                          className={cn(
                            "size-6 rounded-lg border transition-all flex items-center justify-center group/check",
                            hasUpdate 
                              ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20" 
                              : "bg-background/50 border-primary/50 text-transparent hover:border-amber-500/50"
                          )}
                        >
                          <Check className={cn("size-3.5 stroke-[3px]", hasUpdate ? "opacity-100" : "opacity-100 group-hover/check:opacity-30 group-hover/check:text-outline")} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
