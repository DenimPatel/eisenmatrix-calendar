import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { useUiStore } from '@/store/useUiStore';
import { parseQuickAdd, quickAddToItem } from '@/domain/quickadd';
import { createItemPersisted } from '@/domain/itemActions';
import { defaultDataFor } from '@/domain/itemFactory';
import { listRepo } from '@/db/repository';
import { useLists } from '@/hooks/useData';
import { ITEM_KIND_LABELS } from '@/lib/labels';
import { formatISODate } from '@/lib/date';
import { newId } from '@/lib/id';
import type { ItemKind } from '@/types';

const EXAMPLES = [
  'pay electricity $120 every month on the 5th !urgent',
  'buy milk 2L #groceries',
  'gym mon/wed/fri 7am',
];

export function QuickAdd() {
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  const pushToast = useUiStore((s) => s.pushToast);
  const lists = useLists();
  const [input, setInput] = useState('');
  const [kindOverride, setKindOverride] = useState<ItemKind | ''>('');
  const [dateOverride, setDateOverride] = useState('');
  const [timeOverride, setTimeOverride] = useState('');

  const parsed = useMemo(() => parseQuickAdd(input), [input]);
  const effectiveKind = (kindOverride || parsed.kind) as ItemKind;

  const reset = () => {
    setInput('');
    setKindOverride('');
    setDateOverride('');
    setTimeOverride('');
  };

  const commit = async () => {
    if (!input.trim()) return;
    const item = quickAddToItem(parsed);

    if (effectiveKind !== item.kind) {
      item.kind = effectiveKind;
      item.data = defaultDataFor(effectiveKind);
    }

    const dateKey = dateOverride || parsed.start?.slice(0, 10) || formatISODate(new Date());
    const time = timeOverride || parsed.time;
    item.allDay = !time;
    item.start = time ? `${dateKey}T${time}` : dateKey;
    item.dueAt = item.start;

    if (parsed.listName) {
      const existing = lists.find((l) => l.name.toLowerCase() === parsed.listName!.toLowerCase());
      if (existing) item.listId = existing.id;
      else {
        await listRepo.create({
          id: newId(),
          name: parsed.listName,
          kind: parsed.kind === 'shopping' ? 'shopping' : 'project',
          color: 'accent',
          icon: 'list',
          order: lists.length,
          archivedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    await createItemPersisted(item);
    pushToast({ message: `Added “${item.title}”`, tone: 'success' });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        setOpen(false);
      }}
      title="Quick add"
      description="Type naturally. Chips show what will be created — edit before committing."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="hidden text-xs text-muted sm:block">
            Press Enter to add · Esc to close
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void commit()} disabled={!input.trim()}>
              <Sparkles size={16} /> Add
            </Button>
          </div>
        </div>
      }
    >
      <input
        autoFocus
        className="input text-base"
        placeholder={EXAMPLES[0]}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
        }}
      />

      {!input.trim() && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-accent"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {input.trim() && (
        <div className="mt-4 space-y-4 rounded-xl border border-border bg-elevated p-3">
          <div>
            <div className="text-xs text-muted">Title</div>
            <div className="text-lg font-semibold text-fg">{parsed.title || '—'}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {parsed.chips.map((chip, index) => (
              <Badge
                key={`${chip.field}-${index}`}
                tone={chip.field === 'kind' ? 'accent' : 'default'}
              >
                {chip.label}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs text-muted">Kind</span>
              <Select
                value={effectiveKind}
                onChange={(e) => setKindOverride(e.target.value as ItemKind)}
                options={Object.entries(ITEM_KIND_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Date</span>
              <input
                type="date"
                className="input"
                value={dateOverride || parsed.start?.slice(0, 10) || ''}
                onChange={(e) => setDateOverride(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Time</span>
              <input
                type="time"
                className="input"
                value={timeOverride || parsed.time || ''}
                onChange={(e) => setTimeOverride(e.target.value)}
              />
            </label>
          </div>
        </div>
      )}
    </Dialog>
  );
}
