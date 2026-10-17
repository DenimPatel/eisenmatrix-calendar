import { registerSW } from 'virtual:pwa-register';
import { useUiStore } from '@/store/useUiStore';
import { reportBootFailure, OFFLINE_UNAVAILABLE_MESSAGE } from '@/lib/bootFailure';

/** Register the service worker and surface update/offline readiness via toasts. */
export function setupPWA(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useUiStore.getState().pushToast({
        message: 'A new version is available',
        tone: 'info',
        duration: 0,
        actionLabel: 'Reload',
        onAction: () => void updateSW(true),
      });
    },
    onOfflineReady() {
      useUiStore.getState().pushToast({
        message: 'Ready to work offline',
        tone: 'success',
      });
    },
    onRegisterError(error) {
      reportBootFailure(OFFLINE_UNAVAILABLE_MESSAGE, error);
    },
  });
}
