import React from 'react';
import { cn } from '@/lib/cn';

export interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: React.ReactNode;
  tone?: 'accent' | 'success' | 'warning';
  /** Accessible name for the progressbar. Ignored when `decorative` is set. */
  ariaLabel?: string;
  /**
   * Renders the ring as a purely visual decoration. Use it inside content that is already
   * labelled (e.g. a button with its own name) so the value is not announced twice.
   */
  decorative?: boolean;
}

const toneVar: Record<NonNullable<ProgressRingProps['tone']>, string> = {
  accent: 'rgb(var(--accent))',
  success: 'rgb(16 185 129)',
  warning: 'rgb(245 158 11)',
};

const COMPACT_MAX_SIZE = 40;

export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  className,
  label,
  tone = 'accent',
  ariaLabel,
  decorative = false,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const percent = Math.round(clamped);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const compact = size < COMPACT_MAX_SIZE;

  const semantics: React.HTMLAttributes<HTMLDivElement> = decorative
    ? { 'aria-hidden': true }
    : {
        role: 'progressbar',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': percent,
        'aria-label': ariaLabel ?? `${percent}%`,
      };

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      {...semantics}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true" focusable="false">
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
        {label ??
          (compact ? (
            <span data-compact="true" className="text-[10px] font-semibold leading-none text-fg">
              {percent}
            </span>
          ) : (
            <span className="text-xs font-semibold text-fg">{percent}%</span>
          ))}
      </div>
    </div>
  );
}
