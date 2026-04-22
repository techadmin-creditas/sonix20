import {
  LayoutDashboard,
  MessageSquare,
  Mic2,
  Bot,
  GitBranch,
  Database,
  BarChart3,
  User,
  ShieldCheck,
  Settings
} from 'lucide-react';

export interface ModuleDefinition {
  id: string;
  label: string;
  icon: any;
  path: string;
  description: string;
  isAdminOnly?: boolean;
}

export const AVAILABLE_MODULES: ModuleDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    description: 'System-wide overview and real-time metrics.'
  },
  {
    id: 'sessions',
    label: 'Sessions',
    icon: MessageSquare,
    path: '/sessions',
    description: 'Live monitoring and session history.'
  },
  // {
  //   id: 'studio',
  //   label: 'Voice Library',
  //   icon: Mic2,
  //   path: '/studio',
  //   description: 'Manage cloned voices and synthesis profiles.'
  // },
  {
    id: 'personas',
    label: 'Bot Factory',
    icon: Bot,
    path: '/personas',
    description: 'Design and configure autonomous agents.'
  },
  {
    id: 'persona',
    label: 'Persona',
    icon: User,
    path: '/persona',
    description: 'Customize agent personality and behavior.'
  },
  // {
  //   id: 'workflows',
  //   label: 'Workflows',
  //   icon: GitBranch,
  //   path: '/workflows',
  //   description: 'Define multi-step interaction logic.'
  // },
  // { 
  //   id: 'knowledge', 
  //   label: 'Knowledge Base', 
  //   icon: Database, 
  //   path: '/knowledge',
  //   description: 'Manage information shards and RAG sourcing.'
  // },
  // { 
  //   id: 'analytics', 
  //   label: 'Analytics', 
  //   icon: BarChart3, 
  //   path: '/analytics',
  //   description: 'Performance reports and interaction trends.'
  // },
  // {
  //   id: 'profile',
  //   label: 'Profile',
  //   icon: User,
  //   path: '/profile',
  //   description: 'Personal account settings and preferences.'
  // },
  // {
  //   id: 'users',
  //   label: 'Users',
  //   icon: ShieldCheck,
  //   path: '/users',
  //   description: 'Manage system identities and permissions.',
  //   isAdminOnly: true
  // },
  // {
  //   id: 'settings',
  //   label: 'Settings',
  //   icon: Settings,
  //   path: '/settings',
  //   description: 'Global system configuration.',
  //   isAdminOnly: true
  // }
];
