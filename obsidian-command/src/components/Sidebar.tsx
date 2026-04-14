import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Mic2,
  BarChart3,
  Settings,
  Database,
  Bot,
  Sparkles,
  LogOut,
  PlusCircle,
  GitBranch,
  Users,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AuthUser } from '../lib/api';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: MessageSquare, label: 'Sessions', path: '/sessions' },
  { icon: Mic2, label: 'Voice Studio', path: '/studio' },
  { icon: Sparkles, label: 'DIY With AI', path: '/diy-with-ai' },
  { icon: Bot, label: 'Bot Factory', path: '/personas' },
  { icon: Sparkles, label: 'Persona Builder', path: '/persona' },
  { icon: GitBranch, label: 'Workflows', path: '/workflows' },
  // { icon: Database, label: 'Knowledge Base', path: '/knowledge' },
  // { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  // { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export function Sidebar({
  currentUser,
  onLogout,
}: {
  currentUser: AuthUser;
  onLogout: () => void;
}) {
  return (
    <aside className="w-64 h-screen bg-surface-lowest border-r border-outline-variant/10 flex flex-col sticky top-0 shrink-0">
      <div className="p-8 flex flex-col gap-8 flex-1 overflow-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-headline text-lg font-bold tracking-tight text-on-surface">SONIX 2.0</h1>
            {/* <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mt-1">The Obsidian Command</p> */}
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                isActive
                  ? "bg-surface-highest text-primary border border-outline-variant/20 shadow-lg"
                  : "text-on-surface-variant hover:bg-surface-high/50"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("size-5", isActive ? "text-primary" : "text-outline group-hover:text-primary")} />
                  <span className={cn("text-sm", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {currentUser.role === 'admin' && (
            <NavLink
              to="/users"
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                isActive
                  ? "bg-surface-highest text-primary border border-outline-variant/20 shadow-lg"
                  : "text-on-surface-variant hover:bg-surface-high/50"
              )}
            >
              {({ isActive }) => (
                <>
                  <Users className={cn("size-5", isActive ? "text-primary" : "text-outline group-hover:text-primary")} />
                  <span className={cn("text-sm", isActive ? "font-bold" : "font-medium")}>Users</span>
                </>
              )}
            </NavLink>
          )}
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
        to="/profile"
        className={({ isActive }) => cn(
          "p-6 border-t border-outline-variant/10 transition-all hover:bg-surface-high/50 cursor-pointer",
          isActive && "bg-primary/5"
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
