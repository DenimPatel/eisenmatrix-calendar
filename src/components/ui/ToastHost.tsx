import { CheckCircle2, Info, Undo2, X, AlertTriangle } from 'lucide-react';
import { useUiStore } from '@/store/useUiStore';
import { cn } from '@/lib/cn';

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2 sm:bottom-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg animate-slide-up',
          )}
        >
          <span
            className={cn(
              'shrink-0',
              toast.tone === 'success'
                ? 'text-emerald-500'
                : toast.tone === 'error'
                  ? 'text-rose-500'
                  : 'text-accent',
            )}
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 size={18} />
            ) : toast.tone === 'error' ? (
              <AlertTriangle size={18} />
            ) : (
              <Info size={18} />
            )}
          </span>
          <span className="flex-1 text-sm text-fg">{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                void toast.onAction?.();
                dismissToast(toast.id);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft"
            >
              <Undo2 size={12} />
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="text-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
