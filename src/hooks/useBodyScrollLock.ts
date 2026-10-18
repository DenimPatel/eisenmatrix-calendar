import { useEffect } from 'react';

let lockCount = 0;
let restoreOverflow = '';

function normalizeOverflow(value: string): string {
  return value === 'hidden' ? '' : value;
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      restoreOverflow = normalizeOverflow(document.body.style.overflow);
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = restoreOverflow;
      }
    };
  }, [active]);
}
