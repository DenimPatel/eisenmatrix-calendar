import React from 'react';
import { cn } from '@/lib/cn';

export interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: React.ReactNode;
  tone?: 'accent' | 'success' | 'warning';
}

const toneVar: Record<NonNullable<ProgressRingProps['tone']>, string> = {
  accent: 'rgb(var(--accent))',
  success: 'rgb(16 185 129)',
  warning: 'rgb(245 158 11)',
};

export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  className,
  label,
  tone = 'accent',
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneVar[tone]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {label ?? <span className="text-xs font-semibold text-fg">{Math.round(clamped)}%</span>}
      </div>
    </div>
  );
}
