import { useRef, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { useUiStore } from '@/store/useUiStore';
import { EXPORT_FORMATS, QUICK_ADD_EXAMPLES, QUICK_ADD_SYNTAX, SHORTCUTS } from './helpContent';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

export function HelpDialog() {
  const open = useUiStore((s) => s.helpOpen);
  const setOpen = useUiStore((s) => s.setHelpOpen);
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Help & syntax"
      description="Quick-add syntax, keyboard shortcuts and export formats."
      size="lg"
      titleRef={headingRef}
      initialFocusRef={headingRef}
    >
      <div className="space-y-6">
        <Section title="Quick add — examples">
          <ul className="space-y-2">
            {QUICK_ADD_EXAMPLES.map((example) => (
              <li key={example.input} className="rounded-lg border border-border bg-elevated p-2.5">
                <code className="block break-words text-xs font-medium text-accent">
                  {example.input}
                </code>
                <span className="mt-0.5 block text-xs text-muted">{example.summary}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Type one of these into Quick add (
            <kbd className="rounded border border-border bg-elevated px-1">C</kbd>) and the chips
            preview exactly what will be created.
          </p>
        </Section>

        <Section title="Quick add — syntax">
          <dl className="divide-y divide-border rounded-lg border border-border">
            {QUICK_ADD_SYNTAX.map((row) => (
              <div key={row.syntax} className="grid gap-1 p-2.5 sm:grid-cols-[1fr_auto] sm:gap-3">
                <dt>
                  <code className="break-words text-xs text-fg">{row.syntax}</code>
                </dt>
                <dd className="text-xs text-muted sm:text-right">{row.label}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Keyboard shortcuts">
          <dl className="divide-y divide-border rounded-lg border border-border">
            {SHORTCUTS.map((row) => (
              <div key={row.keys} className="flex items-center justify-between gap-3 p-2.5">
                <dt className="text-sm text-fg">{row.label}</dt>
                <dd>
                  <kbd className="rounded border border-border bg-elevated px-2 py-0.5 text-xs font-medium text-muted">
                    {row.keys}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Export formats">
          <dl className="space-y-2">
            {EXPORT_FORMATS.map((format) => (
              <div key={format.name} className="rounded-lg border border-border bg-elevated p-2.5">
                <dt className="text-xs font-semibold text-fg">{format.name}</dt>
                <dd className="mt-0.5 text-xs text-muted">{format.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">Exports live in Settings → Data.</p>
        </Section>
      </div>
    </Dialog>
  );
}
