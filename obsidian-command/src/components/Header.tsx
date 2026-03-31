import React from 'react';
import { Bell, Search, PlusCircle } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="glass-panel border-b border-outline-variant/10 sticky top-0 z-50">

      {/* ── Row 1: Branding + utility icons ─────────────────── */}
      <div className="px-4 sm:px-6 lg:px-10 h-16 sm:h-[72px] flex items-center justify-between gap-4">

        {/* Title block — always fully visible, never truncated */}
        <div className="flex flex-col">
          {subtitle && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-outline font-bold leading-none mb-0.5">
              {subtitle}
            </span>
          )}
          <h2 className="font-headline text-xl lg:text-2xl font-extrabold text-on-surface tracking-tight leading-tight">
            {title}
          </h2>
        </div>

        {/* Utility: search + bell + avatar */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-3 bg-surface-container px-4 py-2 rounded-xl border border-outline-variant/5">
            <Search className="size-4 text-outline shrink-0" />
            <input
              type="text"
              placeholder="Command Search..."
              className="bg-transparent border-none focus:ring-0 text-sm w-36 xl:w-48 placeholder:text-outline outline-none"
            />
          </div>
          <button className="size-9 sm:size-10 flex items-center justify-center rounded-xl bg-surface-high hover:bg-surface-highest transition-all border border-outline-variant/10 shrink-0">
            <Bell className="size-4 sm:size-5 text-on-surface-variant" />
          </button>
          <div className="size-9 sm:size-10 rounded-full border border-primary/20 p-0.5 shrink-0">
            <img
              src="https://picsum.photos/seed/admin/100/100"
              alt="Avatar"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: Page actions — only rendered when provided ── */}
      {actions && (
        <div className="px-4 sm:px-6 lg:px-10 py-2.5 border-t border-outline-variant/8 bg-surface-low/40 flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
          {actions}
        </div>
      )}

    </header>
  );
}
