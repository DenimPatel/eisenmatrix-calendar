import { useUiStore } from '@/store/useUiStore';

const reported = new Set<string>();

export const DATABASE_UNAVAILABLE_MESSAGE =
  'The local database is unavailable — changes may not be saved.';

export const OFFLINE_UNAVAILABLE_MESSAGE = 'Offline support could not start.';

export function reportBootFailure(message: string, error: unknown): void {
  console.error(message, error);
  if (reported.has(message)) return;
  reported.add(message);
  useUiStore.getState().pushToast({
    message,
    tone: 'error',
    duration: 0,
    actionLabel: 'Reload',
    onAction: () => window.location.reload(),
  });
}
