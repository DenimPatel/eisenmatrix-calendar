import { useCallback, useEffect, useId } from 'react';
import { useUiStore } from '@/store/useUiStore';

export function useOverlayLayer(active: boolean) {
  const id = useId();
  const registerOverlay = useUiStore((s) => s.registerOverlay);
  const unregisterOverlay = useUiStore((s) => s.unregisterOverlay);

  useEffect(() => {
    if (!active) return;
    registerOverlay(id);
    return () => unregisterOverlay(id);
  }, [active, id, registerOverlay, unregisterOverlay]);

  return useCallback(() => useUiStore.getState().isTopOverlay(id), [id]);
}
