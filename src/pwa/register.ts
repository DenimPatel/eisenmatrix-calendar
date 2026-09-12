import { registerSW } from 'virtual:pwa-register';
import { useUiStore } from '@/store/useUiStore';

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
  });
}
