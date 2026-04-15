import React, { createContext, useContext, useState, useEffect } from 'react';
import { VOICE_PERSONAS as INITIAL_PERSONAS, PersonaProfile, PersonaTemplate } from '../data/personaData';
import { VOICE_RELAYS, type VoiceRelay } from '../data/voiceData';

export type { PersonaProfile, PersonaTemplate };

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
  personas: PersonaProfile[];
  deployedIds: string[];
  activePersonaId: string;
  activityLog: ActivityItem[];
  metrics: StudioMetrics;
  voiceRelays: VoiceRelay[];
}

interface StudioContextType extends StudioState {
  addPersona: (persona: any) => void;
  updatePersona: (id: string, data: any) => void;
  deletePersona: (id: string) => void;
  toggleDeployment: (id: string) => void;
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
      personas: INITIAL_PERSONAS,
      deployedIds: [],
      activePersonaId: INITIAL_PERSONAS[0]?.id || '',
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

  const addPersona = (newPersona: any) => {
    const persona: PersonaProfile = {
      ...newPersona,
      id: newPersona.id || `p-${Date.now()}`,
      language: newPersona.language || 'English',
      tone: newPersona.tone || 'Neutral',
      urgency: newPersona.urgency || 50,
      empathy: newPersona.empathy || 50,
      stability: newPersona.stability || 75,
      baseModel: newPersona.baseModel || 'Sonix-Flash-1',
      selectedVoice: newPersona.selectedVoice || 'v1'
    };
    setState(prev => ({
      ...prev,
      personas: [persona, ...prev.personas]
    }));
    recordActivity(`Forge Synthesis Complete: ${persona.name}`);
  };

  const updatePersona = (id: string, data: any) => {
    setState(prev => ({
      ...prev,
      personas: prev.personas.map(p => p.id === id ? { ...p, ...data } : p)
    }));
    recordActivity(`Updated Persona: ${data.name || id}`);
  };

  const deletePersona = (id: string) => {
    setState(prev => {
      const p = prev.personas.find(pers => pers.id === id);
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
  };

  const toggleDeployment = (id: string) => {
    setState(prev => {
      const isActive = prev.deployedIds.includes(id);
      return {
        ...prev,
        deployedIds: isActive
          ? prev.deployedIds.filter(i => i !== id)
          : [...prev.deployedIds, id]
      };
    });
    recordActivity(`Deployment Toggled: ${id}`);
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
