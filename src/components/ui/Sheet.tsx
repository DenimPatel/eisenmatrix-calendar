import React, { useEffect, useId, type RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Button } from './Button';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Accessible name used when `title` is empty; ignored otherwise. */
  ariaLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'md' | 'lg';
  /** Focused on open instead of the first focusable element (the Close button). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  ariaLabel,
  children,
  footer,
  width = 'md',
  initialFocusRef,
}: SheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open, initialFocusRef);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel || 'Panel'}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={cn(
          'flex h-full w-full flex-col border-border bg-surface shadow-2xl animate-slide-up',
          'sm:animate-slide-in-right sm:border-l',
          width === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-fg">
              {title}
            </h2>
            {subtitle && (
              <div id={subtitleId} className="mt-0.5 text-xs text-muted">
                {subtitle}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-border bg-elevated p-4">{footer}</div>}
      </div>
    </div>
  );
}
