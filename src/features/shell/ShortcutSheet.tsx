import { useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/store/useUiStore';
import { SHORTCUTS } from './helpContent';

export function ShortcutSheet() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      size="sm"
      titleRef={headingRef}
      initialFocusRef={headingRef}
      footer={
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setHelpOpen(true);
            }}
          >
            Quick-add syntax & help
          </Button>
        </div>
      }
    >
      <dl className="divide-y divide-border">
        {SHORTCUTS.map(({ keys, label }) => (
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
