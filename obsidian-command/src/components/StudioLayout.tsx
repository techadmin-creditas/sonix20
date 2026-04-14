import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Mic2, 
  Library, 
  Zap, 
  ChevronLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { StudioProvider } from '../contexts/StudioContext';
import { Header } from './Header';
import { LogOut, Search, RefreshCw } from 'lucide-react';

const STUDIO_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/studio' },
  { icon: Mic2, label: 'Personas', path: '/studio/personas' },
  { icon: Library, label: 'Library', path: '/studio/library' },
  { icon: Zap, label: 'Test Console', path: '/studio/test' },
];

export function StudioLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/studio' },
    { icon: Mic2, label: 'Workbench', path: '/studio/personas' },
    { icon: Library, label: 'Voice Library', path: '/studio/library' },
    { icon: Zap, label: 'Test Console', path: '/studio/test' },
  ];

  const getHeaderContent = (path: string) => {
    if (path.includes('/personas')) return { title: 'Persona Workbench', subtitle: 'Neural Forge' };
    if (path.includes('/library')) return { title: 'Neural Registry', subtitle: 'Persona Fleet' };
    if (path.includes('/test')) return { title: 'Real-time Inference', subtitle: 'Test Console' };
    return { title: 'Neural Operations', subtitle: 'Command Dashboard' };
  };

  const { title, subtitle } = getHeaderContent(location.pathname);

  const studioActions = (
    <div className="flex items-center gap-6 w-full">
      <nav className="flex items-center gap-1 p-1 bg-surface-low/50 rounded-xl border border-outline-variant/10">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/studio'}
            className={({ isActive }) => cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
              isActive 
                ? "bg-primary text-on-primary-fixed shadow-md shadow-primary/20" 
                : "text-outline hover:text-on-surface hover:bg-surface-high/50"
            )}
          >
            <item.icon className="size-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
         <button className="p-2 rounded-xl bg-surface-low border border-outline-variant/5 text-outline hover:text-primary transition-all shadow-sm">
            <RefreshCw className="size-3.5" />
         </button>
         <div className="h-4 w-px bg-outline-variant/20 mx-1" />
         <NavLink 
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-surface-lowest border border-outline-variant/10 text-outline hover:text-rose-500 hover:border-rose-500/20 transition-all group font-bold text-[9px] uppercase tracking-widest"
         >
            <LogOut className="size-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Exit Studio
         </NavLink>
      </div>
    </div>
  );

  return (
    <StudioProvider>
      <div className="min-h-screen studio-mesh-gradient text-on-surface selection:bg-primary/30 selection:text-primary overflow-hidden flex flex-col">
        <Header 
          title={title} 
          subtitle={subtitle}
          actions={studioActions}
        />

        {/* --- Main Contents --- */}
        <main className="flex-1 relative overflow-auto custom-scrollbar flex flex-col pt-2">
          {/* Ambient Glows */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-primary/2 blur-[100px] rounded-full animate-pulse-subtle" />
            <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-primary/1 blur-[80px] rounded-full animate-pulse-subtle" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative z-10 p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1 flex flex-col">
             <AnimatePresence mode="wait">
               <motion.div
                 key={location.pathname}
                 initial={{ opacity: 0, y: 10, scale: 0.99 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: -10, scale: 1.01 }}
                 transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                 className="flex-1 flex flex-col"
               >
                 <Outlet />
               </motion.div>
             </AnimatePresence>
          </div>
        </main>
      </div>
    </StudioProvider>
  );
} 
