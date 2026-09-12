import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { useUiStore } from '@/store/useUiStore';
import { useItems } from '@/hooks/useData';
import { NAV_ITEMS } from '@/features/shell/nav';
import { createItem } from '@/domain/itemFactory';
import { ITEM_KIND_LABELS } from '@/lib/labels';
import { cn } from '@/lib/cn';
import { formatISODate } from '@/lib/date';
import type { ItemKind } from '@/types';

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const openEditor = useUiStore((s) => s.openEditor);
  const setTheme = useUiStore((s) => s.setTheme);
  const navigate = useNavigate();
  const items = useItems();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const navCommands: Command[] = NAV_ITEMS.map((item) => ({
      id: `nav-${item.to}`,
      label: `Go to ${item.label}`,
      hint: item.shortcut ? `⌘ ${item.shortcut}` : undefined,
      run: () => navigate(item.to),
    }));
    const createCommands: Command[] = (Object.keys(ITEM_KIND_LABELS) as ItemKind[]).map((kind) => ({
      id: `new-${kind}`,
      label: `New ${ITEM_KIND_LABELS[kind]}`,
      run: () => openEditor(createItem({ kind, start: formatISODate(new Date()) })),
    }));
    const themeCommands: Command[] = [
      { id: 'theme-light', label: 'Theme: light', run: () => setTheme('light') },
      { id: 'theme-dark', label: 'Theme: dark', run: () => setTheme('dark') },
      { id: 'theme-system', label: 'Theme: system', run: () => setTheme('system') },
    ];
    const itemCommands: Command[] = items.slice(0, 200).map((item) => ({
      id: `item-${item.id}`,
      label: item.title || 'Untitled',
      hint: ITEM_KIND_LABELS[item.kind],
      run: () => openEditor(item),
    }));
    return [...navCommands, ...createCommands, ...themeCommands, ...itemCommands];
  }, [items, navigate, openEditor, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 40);
    return commands
      .filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q))
      .slice(0, 40);
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const runCommand = (command: Command | undefined) => {
    if (!command) return;
    command.run();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Command palette"
      size="lg"
      className="self-start sm:mt-[10vh]"
    >
      <input
        autoFocus
        className="input mb-3 text-base"
        placeholder="Search items, jump to a view, or run an action…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            runCommand(filtered[active]);
          }
        }}
        role="combobox"
        aria-expanded="true"
        aria-controls="command-list"
        aria-activedescendant={filtered[active]?.id}
      />
      <div
        ref={listRef}
        id="command-list"
        role="listbox"
        className="max-h-[50vh] space-y-0.5 overflow-y-auto"
      >
        {filtered.map((command, index) => (
          <button
            key={command.id}
            id={command.id}
            role="option"
            aria-selected={index === active}
            onMouseEnter={() => setActive(index)}
            onClick={() => runCommand(command)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm',
              index === active ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-elevated',
            )}
          >
            <span className="truncate">{command.label}</span>
            <span className="flex items-center gap-2">
              {command.hint && <span className="text-xs text-muted">{command.hint}</span>}
              {index === active && <CornerDownLeft size={12} className="text-muted" />}
            </span>
          </button>
        ))}
        {filtered.length === 0 && <p className="p-3 text-sm text-muted">No matches.</p>}
      </div>
    </Dialog>
  );
}
