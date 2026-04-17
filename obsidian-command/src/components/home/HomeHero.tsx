import React, { forwardRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HomeHero = forwardRef<HTMLElement, {}>(({}, ref) => {
  return (
    <section 
      ref={ref}
      className="absolute inset-0 h-screen flex flex-col justify-center px-6 md:px-20"
    >
      <div className="max-w-4xl space-y-8">
        <h1 className="hero-reveal font-headline text-6xl font-black leading-[1.1] tracking-tight md:text-8xl lg:text-9xl text-on-surface">
          Voice Agents <br />
          <span className="bg-linear-to-r from-primary via-tertiary to-primary bg-clip-text text-transparent">
            That Reason.
          </span>
        </h1>
        <p className="hero-reveal max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl">
          The first sovereign voice core built for complex logic. 
          Zero form-fills. Pure conversation.
        </p>
        <div className="hero-reveal flex flex-wrap gap-4 pt-4">
          <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-on-surface px-10 py-5 text-sm font-black uppercase tracking-widest text-background transition-all hover:bg-primary hover:text-on-primary-fixed shadow-2xl shadow-primary/20">
            Launch Console
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </div>
    </section>
  );
});

HomeHero.displayName = 'HomeHero';
