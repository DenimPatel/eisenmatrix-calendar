import { useEffect, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Checkbox, Field, Select } from '@/components/ui/Form';
import { Tabs } from '@/components/ui/Tabs';
import { useUiStore } from '@/store/useUiStore';
import { useChildren, useLists, useSetting } from '@/hooks/useData';
import { cn } from '@/lib/cn';
import { newId } from '@/lib/id';
import { formatISODate, formatTime, hasTimeComponent, parseLocalDate } from '@/lib/date';
import { ITEM_KIND_LABELS, ITEM_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/labels';
import { createItem } from '@/domain/itemFactory';
import {
  createItemsPersisted,
  deleteItem,
  saveItem,
  toggleDone,
  updateRecurring,
} from '@/domain/itemActions';
import { itemCompletionStats } from '@/domain/stats';
import { expandOccurrences } from '@/domain/recurrence';
import { DEFAULT_SETTINGS, type AppSettings, type ChecklistEntry, type Item } from '@/types';
import { KindFields } from './KindFields';
import { RecurrenceEditor } from './RecurrenceEditor';
import { ReminderEditor } from './ReminderEditor';

type Tab = 'details' | 'schedule' | 'analytics' | 'history';

export function ItemEditorSheet() {
  const editor = useUiStore((s) => s.editor);
  const closeEditor = useUiStore((s) => s.closeEditor);
  const pushToast = useUiStore((s) => s.pushToast);
  const lists = useLists();
  const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<Item | null>(null);
  const [tab, setTab] = useState<Tab>('details');
  const [tagInput, setTagInput] = useState('');
  const [scope, setScope] = useState<'occurrence' | 'future' | 'all'>('all');
  const children = useChildren(draft?.id ?? null);

  useEffect(() => {
    if (editor.open && editor.item) {
      setDraft(structuredClone(editor.item));
      setTab('details');
      setScope(editor.item.recurrence && editor.occurrenceKey ? 'occurrence' : 'all');
    } else {
      setDraft(null);
    }
  }, [editor.open, editor.item, editor.occurrenceKey]);

  const isRecurring = !!draft?.recurrence;

  const analytics = useMemo(() => {
    if (!draft) return null;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 120);
    const stats = itemCompletionStats(draft, from, to);
    const recent = expandOccurrences(draft, from, to).reverse().slice(0, 12);
    return { stats, recent };
  }, [draft]);

  if (!editor.open || !draft) return null;

  const update = (patch: Partial<Item>) =>
    setDraft((prev) => (prev ? ({ ...prev, ...patch } as Item) : prev));
  const updateData = (patch: Record<string, unknown>) =>
    setDraft((prev) => (prev ? ({ ...prev, data: { ...prev.data, ...patch } } as Item) : prev));

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (!tag || draft.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    update({ tags: [...draft.tags, tag] });
    setTagInput('');
  };

  const handleSave = async () => {
    if (draft.recurrence && editor.occurrenceKey && scope !== 'all') {
      await updateRecurring(draft, scope, editor.occurrenceKey, {
        title: draft.title,
        notes: draft.notes,
        status: draft.status,
        urgency: draft.urgency,
        importance: draft.importance,
        tags: draft.tags,
        allDay: draft.allDay,
        start: draft.start,
        end: draft.end,
        reminders: draft.reminders,
        data: draft.data,
      });
      pushToast({
        message: scope === 'occurrence' ? 'Occurrence updated' : 'Series split',
        tone: 'success',
      });
    } else {
      await saveItem(draft);
    }
    closeEditor();
  };

  const handleDelete = async () => {
    await deleteItem(draft);
    closeEditor();
  };

  const toggleChecklist = (entryId: string) => {
    update({
      checklist: draft.checklist.map((c) => (c.id === entryId ? { ...c, done: !c.done } : c)),
    });
  };

  const addChecklistEntry = (text: string) => {
    if (!text.trim()) return;
    const entry: ChecklistEntry = { id: newId(), text: text.trim(), done: false };
    update({ checklist: [...draft.checklist, entry] });
  };

  const addChild = async (title: string) => {
    if (!title.trim()) return;
    await createItemsPersisted([
      createItem({
        kind: draft.kind === 'goal' ? 'task' : 'task',
        title: title.trim(),
        parentId: draft.id,
      }),
    ]);
  };

  const startDate = draft.start ? parseLocalDate(draft.start) : null;

  return (
    <Sheet
      open={editor.open}
      onClose={closeEditor}
      width="lg"
      title={draft.title || 'Untitled'}
      subtitle={
        <span className="flex items-center gap-2">
          <Badge tone="accent">{ITEM_KIND_LABELS[draft.kind]}</Badge>
          {editor.occurrenceKey && <span>Occurrence {editor.occurrenceKey}</span>}
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={14} /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      {isRecurring && editor.occurrenceKey && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p className="mb-2 font-medium">This is a recurring item. Apply changes to:</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['occurrence', 'This occurrence'],
                ['future', 'This and future'],
                ['all', 'All occurrences'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 font-medium',
                  scope === value
                    ? 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                    : 'border-amber-200 hover:bg-amber-100/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'details', label: 'Details' },
          { value: 'schedule', label: 'Schedule' },
          ...(isRecurring ? [{ value: 'analytics' as const, label: 'Analytics' }] : []),
          { value: 'history', label: `History (${draft.history.length})` },
        ]}
      />

      {tab === 'details' && (
        <div className="space-y-4">
          <Field label="Title">
            <input
              autoFocus
              className="input"
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="What is it?"
            />
          </Field>

          <Field label="Notes">
            <textarea
              className="input min-h-[96px]"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Details, links, context…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Status">
              <Select
                value={draft.status}
                onChange={(e) => update({ status: e.target.value as Item['status'] })}
                options={Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l,
                }))}
              />
            </Field>
            <Field label="Urgency">
              <Select
                value={draft.urgency}
                onChange={(e) => update({ urgency: e.target.value as Item['urgency'] })}
                options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
            </Field>
            <Field label="Importance">
              <Select
                value={draft.importance}
                onChange={(e) => update({ importance: e.target.value as Item['importance'] })}
                options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
            </Field>
          </div>

          <KindFields item={draft} onData={updateData} />

          <Field label="List">
            <Select
              value={draft.listId ?? ''}
              onChange={(e) => update({ listId: e.target.value || null })}
              options={[
                { value: '', label: 'No list' },
                ...lists.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </Field>

          <Field label="Tags">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-2">
              {draft.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-xs text-muted"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => update({ tags: draft.tags.filter((t) => t !== tag) })}
                    aria-label={`Remove ${tag}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none"
                value={tagInput}
                placeholder="Add tag…"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
            </div>
          </Field>

          {(draft.kind === 'task' || draft.kind === 'goal' || draft.kind === 'event') && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted">
                {draft.kind === 'goal' ? 'Milestones' : 'Subtasks'}
              </span>
              {children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2"
                >
                  <Checkbox
                    checked={child.status === 'done'}
                    onChange={() => void toggleDone(child)}
                    aria-label={child.title}
                  />
                  <span
                    className={cn(
                      'flex-1 text-sm',
                      child.status === 'done' && 'text-muted line-through',
                    )}
                  >
                    {child.title}
                  </span>
                </div>
              ))}
              <input
                className="input"
                placeholder={
                  draft.kind === 'goal'
                    ? 'Add a milestone and press Enter'
                    : 'Add a subtask and press Enter'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = e.currentTarget.value;
                    e.currentTarget.value = '';
                    void addChild(value);
                  }
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted">Checklist</span>
            {draft.checklist.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <Checkbox checked={entry.done} onChange={() => toggleChecklist(entry.id)} />
                <span className={cn('flex-1 text-sm', entry.done && 'text-muted line-through')}>
                  {entry.text}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    update({ checklist: draft.checklist.filter((c) => c.id !== entry.id) })
                  }
                  aria-label="Remove checklist item"
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
            <input
              className="input"
              placeholder="Add checklist item and press Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value;
                  e.currentTarget.value = '';
                  addChecklistEntry(value);
                }
              }}
            />
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-fg">
            <Checkbox
              checked={draft.allDay}
              onChange={(e) => {
                const allDay = e.target.checked;
                const base = (draft.start ? parseLocalDate(draft.start) : null) ?? new Date();
                const time =
                  draft.start && hasTimeComponent(draft.start) ? formatTime(draft.start) : '09:00';
                const next = allDay ? formatISODate(base) : `${formatISODate(base)}T${time}`;
                update({ allDay, start: next, dueAt: next });
              }}
            />
            All day
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Start">
              <div className="flex gap-2">
                <input
                  type="date"
                  className="input"
                  value={startDate ? formatISODate(startDate) : ''}
                  onChange={(e) => {
                    const dateKey = e.target.value;
                    const time = !draft.allDay && draft.start ? formatTime(draft.start) : '';
                    const next = time ? `${dateKey}T${time}` : dateKey;
                    update({ start: next, dueAt: next });
                  }}
                />
                {!draft.allDay && (
                  <input
                    type="time"
                    className="input w-28"
                    value={draft.start ? formatTime(draft.start) : ''}
                    onChange={(e) => {
                      const dateKey = draft.start
                        ? formatISODate(parseLocalDate(draft.start)!)
                        : formatISODate(new Date());
                      const next = `${dateKey}T${e.target.value || '09:00'}`;
                      update({ start: next, dueAt: next });
                    }}
                  />
                )}
              </div>
            </Field>

            <Field label="Due">
              <input
                type="datetime-local"
                className="input"
                value={draft.dueAt ? (draft.allDay ? `${draft.dueAt}T00:00` : draft.dueAt) : ''}
                onChange={(e) => update({ dueAt: e.target.value || null })}
              />
            </Field>
          </div>

          <Field label="End">
            <input
              type="datetime-local"
              className="input"
              value={
                draft.end && hasTimeComponent(draft.end)
                  ? draft.end
                  : draft.end
                    ? `${draft.end}T00:00`
                    : ''
              }
              onChange={(e) => update({ end: e.target.value || null })}
            />
          </Field>

          <RecurrenceEditor
            value={draft.recurrence}
            start={draft.start}
            weekStartsOn={settings.weekStartsOn}
            onChange={(rule) => update({ recurrence: rule })}
          />

          <ReminderEditor
            value={draft.reminders}
            allDay={draft.allDay}
            onChange={(reminders) => update({ reminders })}
          />
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-elevated p-4">
              <div className="text-xs text-muted">Completion rate</div>
              <div className="text-3xl font-bold text-fg">{analytics.stats.rate}%</div>
              <div className="text-xs text-muted">
                {analytics.stats.done} of {analytics.stats.total} in last 120 days
              </div>
            </div>
            <div className="rounded-xl border border-border bg-elevated p-4">
              <div className="text-xs text-muted">Tracked occurrences</div>
              <div className="text-3xl font-bold text-fg">{analytics.stats.total}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {analytics.recent.map((occ) => (
              <div
                key={occ.occKey}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <span className="font-mono text-xs text-muted">{occ.occKey}</span>
                <Badge tone={occ.status === 'done' ? 'success' : 'default'}>
                  {ITEM_STATUS_LABELS[occ.status]}
                </Badge>
              </div>
            ))}
            {analytics.recent.length === 0 && (
              <p className="text-sm text-muted">No occurrences yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {draft.history
            .slice()
            .reverse()
            .map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="text-fg">
                  <span className="font-semibold">{entry.field}</span>{' '}
                  <span className="text-muted">
                    {entry.oldValue || 'empty'} → {entry.newValue || 'empty'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          {draft.history.length === 0 && <p className="text-sm text-muted">No history yet.</p>}
        </div>
      )}
    </Sheet>
  );
}
