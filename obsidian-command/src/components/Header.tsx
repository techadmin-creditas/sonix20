import React from 'react';
import { Bell, Search, PlusCircle } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="h-20 glass-panel border-b border-outline-variant/10 px-10 flex items-center justify-between sticky top-0 z-50">
      <div className="flex flex-col">
        {subtitle && <span className="text-[10px] uppercase tracking-[0.2em] text-outline font-bold">{subtitle}</span>}
        <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 bg-surface-container px-4 py-2 rounded-xl border border-outline-variant/5">
          <Search className="size-4 text-outline" />
          <input 
            type="text" 
            placeholder="Command Search..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-outline"
          />
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <button className="size-10 flex items-center justify-center rounded-xl bg-surface-high hover:bg-surface-highest transition-all border border-outline-variant/10">
            <Bell className="size-5 text-on-surface-variant" />
          </button>
          <div className="size-10 rounded-full border border-primary/20 p-0.5">
            <img 
              src="https://picsum.photos/seed/admin/100/100" 
              alt="Avatar" 
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
