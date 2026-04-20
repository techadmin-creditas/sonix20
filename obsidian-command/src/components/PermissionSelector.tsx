import React from 'react';
import { 
  Zap, 
  Eraser, 
  Lock, 
  ZapOff,
  ChevronRight,
  ShieldAlert
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
              p === '*' ? "bg-primary text-on-primary-fixed border-primary/20" :
              p.startsWith('read:') ? "bg-primary/10 text-primary border-primary/20" :
              p.startsWith('update:') ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
              "bg-surface-highest text-outline border-white/5"
            )}
          >
            {p === '*' && <Zap className="size-3" />}
            {p.startsWith('read:') && <ChevronRight className="size-2.5" />}
            {p.startsWith('update:') && <Lock className="size-2.5" />}
            {p.replace('read:', '').replace('update:', '').replace('*', 'Universal Access')}
          </motion.span>
        ))}
      </div>

      {/* Presets Toolbar */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-white/5">
          <Zap className="size-4 text-primary" />
          <span className="text-[9px] font-black uppercase text-primary tracking-widest">Protocol Presets</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.DASHBOARD_ONLY)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-surface-highest border border-white/5 text-[8px] font-black uppercase hover:border-primary/30 disabled:opacity-30 transition-all active:scale-95"
          >
            Dashboard Neutral
          </button>
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.VIEW_ALL)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-surface-highest border border-white/5 text-[8px] font-black uppercase hover:border-primary/30 disabled:opacity-30 transition-all active:scale-95"
          >
            Observer Mode
          </button>
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.FULL_ACCESS)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase disabled:opacity-30 transition-all active:scale-95"
          >
            Level 10 Clearance
          </button>
          <button 
            type="button"
            onClick={() => onApplyPreset(PRESETS.CLEAR)} 
            disabled={disabled || isAdminRole}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase disabled:opacity-30 transition-all active:scale-95 flex items-center"
          >
            <Eraser className="size-3 mr-1" /> Wipe All
          </button>
        </div>
      </div>

      {/* Permissions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {AVAILABLE_MODULES.map((mod, idx) => {
          const hasRead = isGlobal || permissions.includes(`read:*`) || permissions.includes(`read:${mod.id}`);
          const hasUpdate = isGlobal || permissions.includes(`update:${mod.id}`);

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: Math.min(idx * 0.03, 0.3) }} 
              key={mod.id} 
              className={cn(
                "p-4 rounded-2xl border transition-all space-y-4",
                mod.isAdminOnly ? "bg-amber-500/5 border-amber-500/10" : "bg-surface-highest/30 border-white/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "size-8 rounded-xl flex items-center justify-center transition-colors",
                    mod.isAdminOnly ? "bg-amber-500/20 text-amber-500" : "bg-surface-highest text-outline"
                  )}>
                    <mod.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-on-surface uppercase tracking-wider">{mod.label}</p>
                    {mod.isAdminOnly && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <ShieldAlert className="size-2 text-amber-500" />
                        <span className="text-[7px] font-black uppercase text-amber-500/70 tracking-tighter">System Protected</span>
                      </div>
                    )}
                  </div>
                </div>
                {isGlobal && <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Master Access</span>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled || isAdminRole || isGlobal}
                  onClick={() => onToggle(`read:${mod.id}`)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1.5",
                    hasRead 
                      ? "bg-primary/20 border-primary/30 text-primary shadow-sm" 
                      : "bg-transparent border-white/5 text-outline opacity-40 hover:opacity-100"
                  )}
                >
                  <ChevronRight className={cn("size-2.5", hasRead ? "text-primary" : "text-outline")} />
                  Read
                </button>
                <button
                  type="button"
                  disabled={disabled || isAdminRole || isGlobal}
                  onClick={() => onToggle(`update:${mod.id}`)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1.5",
                    hasUpdate 
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-500 shadow-sm" 
                      : "bg-transparent border-white/5 text-outline opacity-40 hover:opacity-100"
                  )}
                >
                  <Lock className={cn("size-2.5", hasUpdate ? "text-amber-500" : "text-outline")} />
                  Update
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
