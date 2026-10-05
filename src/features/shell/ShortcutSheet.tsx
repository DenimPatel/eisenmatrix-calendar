import { useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { useUiStore } from '@/store/useUiStore';

const SHORTCUTS: Array<[string, string]> = [
  ['⌘/Ctrl + K', 'Open command palette'],
  ['C', 'Quick add'],
  ['N', 'New task'],
  ['/', 'Search everything'],
  ['1 – 9', 'Jump to a view'],
  ['⌘/Ctrl + Z', 'Undo last action'],
  ['?', 'Show this sheet'],
  ['Esc', 'Close panels'],
];

export function ShortcutSheet() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      size="sm"
      titleRef={headingRef}
      initialFocusRef={headingRef}
    >
      <dl className="divide-y divide-border">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={keys} className="flex items-center justify-between py-2">
            <dt className="text-sm text-fg">{label}</dt>
            <dd>
              <kbd className="rounded border border-border bg-elevated px-2 py-0.5 text-xs font-medium text-muted">
                {keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
