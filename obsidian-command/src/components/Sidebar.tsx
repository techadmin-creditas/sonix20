import React from 'react';
import { NavLink } from 'react-router-dom';
import { AVAILABLE_MODULES } from '../constants/modules';
import { cn } from '../lib/utils';
import { AuthUser } from '../lib/api';
import { ThemeToggle } from './ThemeToggle';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar({
  currentUser,
  onLogout,
}: {
  currentUser: AuthUser;
  onLogout: () => void;
}) {
  const { canRead, isAdmin } = useAuth();

  return (
    <aside className="w-64 h-screen bg-surface-lowest border-r border-outline-variant/10 flex flex-col sticky top-0 shrink-0 z-50">
      <div className="flex flex-1 flex-col gap-8 overflow-auto p-8">
        <div className="flex justify-center items-center">
          <div className="py-2">

            <img src="/images/sidebarlogo.png" alt="Sonix 2.0" className="logo-pulse-sidebar" />

            {/* <img
              src="/images/logoSonix.png"
              alt="Sonix Logo"
              className="h-10 w-auto object-contain brightness-0 invert opacity-95 transition-opacity"
            /> */}
          </div>
          {/* <ThemeToggle /> */}
        </div>

        <nav className="flex flex-col gap-2">
          {AVAILABLE_MODULES.map((item) => {
            if (!canRead(item.id)) return null;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                  isActive
                    ? "ember-gradient studio-glow shadow-lg"
                    : "text-on-surface-variant hover:bg-surface-high/60"
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("size-5 transition-colors", isActive ? "" : "text-outline group-hover:text-primary")} />
                    <span className={cn("text-sm transition-all", isActive ? "font-bold tracking-tight" : "font-medium")}>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* <div className="mt-4">
          <NavLink
            to="/personas/create"
            className="flex items-center gap-3 px-4 py-3 rounded-xl ember-gradient text-on-primary-fixed font-bold shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95"
          >
            <PlusCircle className="size-5" />
            <span className="text-sm">New Bot</span>
          </NavLink>
        </div> */}

        {/* <div className="mt-auto pt-8 border-t border-outline-variant/5">
          <div className="p-4 rounded-2xl bg-surface-low border border-outline-variant/10">
            <p className="text-[10px] font-bold text-outline tracking-wider uppercase mb-2">Plan Usage</p>
            <div className="w-full h-1.5 bg-surface-highest rounded-full overflow-hidden mb-2">
              <div className="h-full ember-gradient w-4/5"></div>
            </div>
            <p className="text-xs text-on-surface-variant">8.2k / 10k mins</p>
          </div>
        </div> */}
      </div>

      <NavLink
        to=""
        className={({ isActive }) => cn(
          "p-6 border-t border-outline-variant/10 transition-all cursor-pointer group",
          isActive ? "ember-gradient studio-glow" : "hover:bg-surface-high/60"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-high border border-outline-variant/20 flex items-center justify-center text-primary font-bold uppercase">
            {currentUser.username.substring(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{currentUser.username}</span>
            <span className="text-[10px] uppercase tracking-tighter text-outline">{currentUser.role}</span>
          </div>
          <button
            onClick={onLogout}
            className="ml-auto p-2 rounded-lg bg-surface-low hover:bg-surface-high border border-outline-variant/20"
            title="Logout"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </NavLink>
    </aside>
  );
}
