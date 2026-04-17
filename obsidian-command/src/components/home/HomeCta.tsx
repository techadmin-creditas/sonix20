import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const HomeCta = forwardRef<HTMLElement, {}>(({}, ref) => {
  return (
    <section 
      ref={ref}
      className="absolute inset-0 h-screen flex flex-col justify-center px-6 text-center"
    >
      <div className="space-y-10">
        <h2 className="reveal-item font-headline text-6xl font-black md:text-8xl lg:text-9xl">
          Start Your <br /> <span className="text-orange-400">Journey.</span>
        </h2>
        <Link to="/login" className="studio-glow-amber inline-flex items-center gap-4 rounded-full bg-orange-500 px-12 py-6 text-sm font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-110 active:scale-95">
          Launch Now
          <ArrowRight className="size-5" />
        </Link>
      </div>
    </section>
  );
});

HomeCta.displayName = 'HomeCta';
