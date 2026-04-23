import { Loader2 } from 'lucide-react';
import React from 'react';

interface LogoLoaderProps {
    text?: string;
    fullScreen?: boolean;
}

export function LogoLoader({ text, fullScreen = true }: LogoLoaderProps) {
    return (
        <div className={`${fullScreen ? 'min-h-screen' : 'h-full w-full'} flex flex-col items-center justify-center bg-surface-lowest gap-8 p-6`}>
            <div className="relative group">
                {/* Glow effect */}
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-1000 animate-pulse" />

                <img
                    src="/images/logoSonix.png"
                    alt="Sonix 2.0"
                    className="relative w-48 h-auto animate-pulse brightness-110 drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]"
                />
            </div>

            {/* {text && (
                <div className="flex-1 flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="size-12 text-primary animate-spin" />
                        <p className="text-outline font-bold uppercase tracking-widest text-sm">{text}</p>
                    </div>
                </div>
            )} */}
        </div>
    );
}

export default LogoLoader;
