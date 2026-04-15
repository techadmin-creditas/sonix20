import React, { createContext, useContext, useState, useEffect } from 'react';
import { VOICE_PERSONAS as INITIAL_PERSONAS, PersonaTemplate } from '../data/personaData';
import { VOICE_RELAYS, type VoiceRelay } from '../data/voiceData';
import { api, type AiPersona } from '../lib/api';

export type { AiPersona as PersonaProfile, PersonaTemplate };

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  time: string;
  icon?: any;
  highlight?: boolean;
}

export interface StudioMetrics {
  avgLatency: number;
  uptime: string;
  totalTokens: string;
}

export interface StudioState {
  personas: AiPersona[];
  deployedIds: string[];
  activePersonaId: string;
  activityLog: ActivityItem[];
  metrics: StudioMetrics;
  voiceRelays: VoiceRelay[];
}

interface StudioContextType extends StudioState {
  refreshPersonas: () => Promise<void>;
  addPersona: (persona: Partial<AiPersona>) => Promise<void>;
  updatePersona: (id: string, data: Partial<AiPersona>) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
  toggleDeployment: (id: string) => Promise<void>;
  setActivePersonaId: (id: string) => void;
  recordActivity: (action: string, user?: string) => void;
  setMetrics: (metrics: Partial<StudioMetrics>) => void;
  resetStudio: () => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StudioState>(() => {
    const saved = localStorage.getItem('studio_unified_state');
    const defaults: StudioState = {
      personas: [],
      deployedIds: [],
      activePersonaId: '',
      activityLog: [
        { id: '1', user: 'System', action: 'Neural Grid Initialized', time: 'Just now' }
      ],
      metrics: {
        avgLatency: 385,
        uptime: '99.98%',
        totalTokens: '12.4M'
      },
      voiceRelays: VOICE_RELAYS
    };

    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }

    return defaults;
  });

  const refreshPersonas = async () => {
    try {
      const personas = await api.listAiPersonas();
      setState(prev => ({
        ...prev,
        personas,
        deployedIds: personas.filter(p => p.isDeployed).map(p => p.id),
        activePersonaId: prev.activePersonaId || personas[0]?.id || ''
      }));
    } catch (err) {
      console.error('Failed to refresh personas:', err);
    }
  };

  useEffect(() => {
    refreshPersonas();
  }, []);

  useEffect(() => {
    localStorage.setItem('studio_unified_state', JSON.stringify(state));
  }, [state]);

  const recordActivity = (action: string, user: string = 'System') => {
    const newItem: ActivityItem = {
      id: Date.now().toString(),
      user,
      action,
      time: 'Just now',
      highlight: user === 'System'
    };
    setState(prev => ({
      ...prev,
      activityLog: [newItem, ...prev.activityLog].slice(0, 20)
    }));
  };

  const addPersona = async (newPersona: Partial<AiPersona>) => {
    try {
      const persona = await api.createAiPersona(newPersona);
      setState(prev => ({
        ...prev,
        personas: [persona, ...prev.personas]
      }));
      recordActivity(`Forge Synthesis Complete: ${persona.name}`);
    } catch (err) {
      console.error('Failed to add persona:', err);
    }
  };

  const updatePersona = async (id: string, data: Partial<AiPersona>) => {
    try {
      await api.updateAiPersona(id, data);
      setState(prev => ({
        ...prev,
        personas: prev.personas.map(p => p.id === id ? { ...p, ...data } : p)
      }));
      recordActivity(`Updated Persona: ${data.name || id}`);
    } catch (err) {
      console.error('Failed to update persona:', err);
    }
  };

  const deletePersona = async (id: string) => {
    try {
      await api.deleteAiPersona(id);
      setState(prev => {
        const newState = {
          ...prev,
          personas: prev.personas.filter(p => p.id !== id),
          deployedIds: prev.deployedIds.filter(i => i !== id)
        };
        if (prev.activePersonaId === id) {
          newState.activePersonaId = newState.personas[0]?.id || '';
        }
        return newState;
      });
      recordActivity(`Deleted Persona: ${id}`);
    } catch (err) {
      console.error('Failed to delete persona:', err);
    }
  };

  const toggleDeployment = async (id: string) => {
    try {
      const updated = await api.toggleAiPersonaDeploy(id);
      setState(prev => ({
        ...prev,
        personas: prev.personas.map(p => p.id === id ? updated : p),
        deployedIds: updated.isDeployed
          ? [...prev.deployedIds, id]
          : prev.deployedIds.filter(i => i !== id)
      }));
      recordActivity(`Deployment Toggled: ${id}`);
    } catch (err) {
      console.error('Failed to toggle deployment:', err);
    }
  };

  const setActivePersonaId = (id: string) => {
    setState(prev => ({ ...prev, activePersonaId: id }));
  };

  const setMetrics = (newMetrics: Partial<StudioMetrics>) => {
    setState(prev => ({
      ...prev,
      metrics: { ...prev.metrics, ...newMetrics }
    }));
  };

  const resetStudio = () => {
    localStorage.removeItem('studio_unified_state');
    window.location.reload();
  };

  return (
    <StudioContext.Provider value={{
      ...state,
      refreshPersonas,
      addPersona,
      updatePersona,
      deletePersona,
      toggleDeployment,
      setActivePersonaId,
      recordActivity,
      setMetrics,
      resetStudio
    }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (context === undefined) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}
