import React from 'react';
import { cn } from '../lib/utils';

interface StudioSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  leftLabel?: string;
  rightLabel?: string;
}

export function StudioSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  leftLabel,
  rightLabel
}: StudioSliderProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <label className="studio-metadata text-on-surface/80">{label}</label>
        <span className="text-[10px] font-mono text-primary font-bold">{value}%</span>
      </div>

      <div className="relative flex items-center mb-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-1 bg-outline-variant/20 rounded-full appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-surface-lowest [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(251,140,0,0.5)] [&::-webkit-slider-thumb]:appearance-none"
        />
        {/* Glow track overlay */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full pointer-events-none"
          style={{ width: `${(value - min) / (max - min) * 100}%` }}
        />
      </div>

      {(leftLabel || rightLabel) && (
        <div className="flex justify-between">
          <span className="text-[9px] uppercase tracking-tighter text-outline/50">{leftLabel}</span>
          <span className="text-[9px] uppercase tracking-tighter text-outline/50">{rightLabel}</span>
        </div>
      )}
    </div>
  );
}
