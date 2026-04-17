import React, { forwardRef } from 'react';
import { AgentPulseCarousel } from '../AgentPulseCarousel';

interface HomeTeamProps {
  isDemoMode: boolean;
  selectedAgentId?: string;
  onTryDemo: (agent: any) => void;
}

export const HomeTeam = forwardRef<HTMLElement, HomeTeamProps>(({ isDemoMode, selectedAgentId, onTryDemo }, ref) => {
  return (
    <section 
      ref={ref}
      className="absolute inset-0 h-screen flex flex-col justify-center px-6 pt-20"
    >
      <div className="text-center mb-8 reveal-item">
        <h2 className="font-headline text-5xl font-black md:text-7xl mb-4 text-white">
          Meet Your <span className="text-orange-500">Digital Team.</span>
        </h2>
        <p className="mx-auto max-w-2xl text-[13px] md:text-sm text-zinc-400 font-medium">
          Pick an assistant to handle your calls, book your appointments, or grow your sales—24/7.
        </p>
      </div>

      <AgentPulseCarousel 
        isDemoMode={isDemoMode}
        selectedAgentId={selectedAgentId}
        onSelectAgent={onTryDemo} 
      />
    </section>
  );
});

HomeTeam.displayName = 'HomeTeam';
