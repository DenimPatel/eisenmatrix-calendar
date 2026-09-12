import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/features/shell/nav';
import { useUiStore } from '@/store/useUiStore';
import { createItem } from '@/domain/itemFactory';
import { formatISODate } from '@/lib/date';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const openEditor = useUiStore((s) => s.openEditor);
  const undo = useUiStore((s) => s.undo);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (meta && event.key.toLowerCase() === 'z') {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        void undo().then((did) => {
          if (did) pushToast({ message: 'Undone', tone: 'info' });
        });
        return;
      }
      if (isTypingTarget(event.target)) return;

      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (event.key.toLowerCase() === 'c' && !meta) {
        event.preventDefault();
        setQuickAddOpen(true);
        return;
      }
      if (event.key.toLowerCase() === 'n' && !meta) {
        event.preventDefault();
        openEditor(createItem({ kind: 'task', start: formatISODate(new Date()) }));
        return;
      }
      const navItem = NAV_ITEMS.find((item) => item.shortcut === event.key);
      if (navItem) {
        event.preventDefault();
        navigate(navItem.to);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate, setCommandOpen, setQuickAddOpen, setShortcutsOpen, openEditor, undo, pushToast]);
}
