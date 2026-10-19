import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SkipForward, Trash2, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Checkbox, Field, Select } from '@/components/ui/Form';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { useUiStore } from '@/store/useUiStore';
import { useChildren, useLists, useSetting } from '@/hooks/useData';
import { cn } from '@/lib/cn';
import { newId } from '@/lib/id';
import type { ItemPatch } from '@/db/repository';
import { dateKeyOf, formatISODate, formatTime, hasTimeComponent, parseLocalDate } from '@/lib/date';
import { ITEM_KIND_LABELS, ITEM_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/labels';
import { createItem } from '@/domain/itemFactory';
import {
  createItemsPersisted,
  deleteItem,
  saveItem,
  skipOccurrence,
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

/** Fields a single occurrence cannot own; a scope of `occurrence` leaves them untouched. */
const SERIES_ONLY_FIELDS = new Set([
  'urgency',
  'importance',
  'tags',
  'reminders',
  'listId',
  'checklist',
  'data',
  'dueAt',
  'recurrence',
]);

const SERIES_ONLY_HINT = 'Applies to the whole series';

function seedDraft(item: Item, occKey: string | null): Item {
  const draft = structuredClone(item);
  if (!item.recurrence || !occKey) return draft;
  const day = parseLocalDate(occKey);
  if (!day) return draft;
  const occurrence = expandOccurrences(item, day, day).find((occ) => occ.occKey === occKey);
  if (!occurrence) return draft;
  draft.start = occurrence.start;
  draft.end = occurrence.end;
  draft.allDay = occurrence.allDay;
  return draft;
}

/** Every field an edit re-applies to the whole series. */
function seriesPatch(draft: Item): ItemPatch {
  return {
    title: draft.title,
    notes: draft.notes,
    status: draft.status,
    urgency: draft.urgency,
    importance: draft.importance,
    tags: draft.tags,
    listId: draft.listId,
    checklist: draft.checklist,
    allDay: draft.allDay,
    start: draft.start,
    end: draft.end,
    dueAt: draft.dueAt,
    reminders: draft.reminders,
    data: draft.data,
    recurrence: draft.recurrence,
  };
}

/**
 * Only per-occurrence fields, and only when the user actually changed them, so that
 * saving one occurrence cannot rewrite the series. Status is included: it is stored per
 * occurrence in `item.occurrences`, not on the series.
 */
function occurrencePatch(draft: Item, base: Item): ItemPatch {
  const patch: ItemPatch = {};
  if (draft.title !== base.title) patch.title = draft.title;
  if (draft.notes !== base.notes) patch.notes = draft.notes;
  if (draft.status !== base.status) patch.status = draft.status;
  if (draft.allDay !== base.allDay) patch.allDay = draft.allDay;
  if (draft.start !== base.start) patch.start = draft.start;
  if (draft.end !== base.end) patch.end = draft.end;
  return patch;
}

function SeriesOnlyGroup({
  locked,
  label,
  children,
}: {
  locked: boolean;
  label?: string;
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <fieldset disabled className="min-w-0 space-y-4 opacity-60">
      {label && <legend className="text-xs font-medium text-muted">{label}</legend>}
      {children}
    </fieldset>
  );
}

export function ItemEditorSheet() {
  const editor = useUiStore((s) => s.editor);
  const closeEditor = useUiStore((s) => s.closeEditor);
  const pushToast = useUiStore((s) => s.pushToast);
  const lists = useLists();
  const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<Item | null>(null);
  const [seed, setSeed] = useState<Item | null>(null);
  const [tab, setTab] = useState<Tab>('details');
  const [tagInput, setTagInput] = useState('');
  const [scope, setScope] = useState<'occurrence' | 'future' | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const children = useChildren(draft?.id ?? null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editor.open && editor.item) {
      const seeded = seedDraft(editor.item, editor.occurrenceKey);
      setDraft(seeded);
      setSeed(structuredClone(seeded));
      setTab('details');
      setScope(editor.item.recurrence && editor.occurrenceKey ? 'occurrence' : 'all');
      setConfirmDelete(false);
    } else {
      setDraft(null);
      setSeed(null);
    }
  }, [editor.open, editor.item, editor.occurrenceKey]);

  const isRecurring = !!draft?.recurrence;

  // Analytics run `itemCompletionStats` plus a 120-day `expandOccurrences`. `draft` changes on
  // every keystroke, so the window is only computed while the Analytics tab is actually open
  // (its `TabPanel` renders nothing otherwise). Output is unchanged for the open tab.
  const analytics = useMemo(() => {
    if (tab !== 'analytics' || !draft) return null;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 120);
    const stats = itemCompletionStats(draft, from, to);
    const recent = expandOccurrences(draft, from, to).reverse().slice(0, 12);
    return { stats, recent };
  }, [draft, tab]);

  if (!editor.open || !draft) return null;

  // A single occurrence owns title, notes, status, start and end only. Everything else is
  // shown read-only rather than quietly dropped on save.
  const occurrenceScoped = !!draft.recurrence && !!editor.occurrenceKey && scope === 'occurrence';

  // The destructive control follows the scope: one occurrence can only be skipped, and a
  // "this and future" delete has no series split to back it, so it stays unavailable there.
  const scopedToOccurrence = !!draft.recurrence && !!editor.occurrenceKey && scope !== 'all';
  const skipOnly = scopedToOccurrence && scope === 'occurrence';
  const deleteUnavailable = scopedToOccurrence && scope === 'future';

  const changeScope = (next: 'occurrence' | 'future' | 'all') => {
    setConfirmDelete(false);
    if (next === scope) return;
    setScope(next);
    if (!editor.item || !seed) return;
    // Only a series-wide switch restores the schedule: `occurrence` reseeds from the resolved
    // occurrence and `all` from the series row. `future` keeps whatever the user has edited so
    // far, otherwise a time/day change made before the switch is silently discarded.
    if (next === 'future') return;
    const range =
      next === 'occurrence'
        ? { start: seed.start, end: seed.end, allDay: seed.allDay }
        : { start: editor.item.start, end: editor.item.end, allDay: editor.item.allDay };
    setDraft((prev) => (prev ? { ...prev, ...range } : prev));
  };

  const update = (patch: Partial<Item>) =>
    setDraft((prev) => {
      if (!prev) return prev;
      if (!occurrenceScoped) return { ...prev, ...patch } as Item;
      const next = { ...patch } as Record<string, unknown>;
      for (const key of Object.keys(next)) {
        if (SERIES_ONLY_FIELDS.has(key)) delete next[key];
      }
      return Object.keys(next).length ? ({ ...prev, ...next } as Item) : prev;
    });
  const updateData = (patch: Record<string, unknown>) =>
    setDraft((prev) => {
      if (!prev || occurrenceScoped) return prev;
      return { ...prev, data: { ...prev.data, ...patch } } as Item;
    });

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
    const occKey = editor.occurrenceKey;
    if (draft.recurrence && occKey && scope !== 'all') {
      const written = await updateRecurring(
        draft,
        scope,
        occKey,
        scope === 'occurrence'
          ? occurrencePatch(draft, seed ?? editor.item ?? draft)
          : seriesPatch(draft),
      );
      if (scope === 'occurrence') {
        pushToast({
          message: written ? 'Occurrence updated' : 'Nothing to update for this occurrence',
          tone: 'success',
        });
      }
    } else {
      await saveItem(draft);
    }
    closeEditor();
  };

  const handleDelete = async () => {
    const occKey = editor.occurrenceKey;
    // Skipping is the only per-occurrence removal: `deleteItem` would drop the whole series.
    if (draft.recurrence && occKey && skipOnly) {
      await skipOccurrence(draft, occKey);
    } else {
      await deleteItem(draft);
    }
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
    if (occurrenceScoped || !title.trim()) return;
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
      initialFocusRef={titleRef}
      title={draft.title || 'Untitled'}
      subtitle={
        <span className="flex items-center gap-2">
          <Badge tone="accent">{ITEM_KIND_LABELS[draft.kind]}</Badge>
          {editor.occurrenceKey && <span>Occurrence {editor.occurrenceKey}</span>}
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="danger"
            size="sm"
            disabled={deleteUnavailable}
            onClick={() => setConfirmDelete(true)}
          >
            {skipOnly ? <SkipForward size={14} /> : <Trash2 size={14} />}
            {skipOnly ? 'Skip this occurrence' : 'Delete'}
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
                onClick={() => changeScope(value)}
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
          {occurrenceScoped && (
            <p className="mt-2">
              One occurrence can only change its title, notes, status, start, end and all-day
              setting. Fields marked “{SERIES_ONLY_HINT}” are disabled for this scope, and Delete
              skips this occurrence only.
            </p>
          )}
          {deleteUnavailable && (
            <p className="mt-2">
              Delete is unavailable for “This and future”. Choose “All occurrences” to delete the
              whole series, or “This occurrence” to skip just this one.
            </p>
          )}
        </div>
      )}

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label={skipOnly ? 'Skip this occurrence' : 'Delete the whole series'}
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          <p className="font-medium">
            {skipOnly ? 'Skip this occurrence?' : 'Delete the whole series?'}
          </p>
          <p className="mt-1">
            {skipOnly
              ? `Only the occurrence on ${editor.occurrenceKey} is skipped. Every other occurrence of “${draft.title}” stays, and this can be undone.`
              : `This deletes “${draft.title}” and its subtasks, including every other occurrence. It can be undone afterwards.`}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              {skipOnly ? 'Skip occurrence' : 'Delete series'}
            </Button>
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
      >
        <TabPanel value="details">
          <div className="space-y-4">
            <Field label="Title">
              <input
                ref={titleRef}
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
              <Field label="Urgency" hint={occurrenceScoped ? SERIES_ONLY_HINT : undefined}>
                <Select
                  value={draft.urgency}
                  disabled={occurrenceScoped}
                  onChange={(e) => update({ urgency: e.target.value as Item['urgency'] })}
                  options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />
              </Field>
              <Field label="Importance" hint={occurrenceScoped ? SERIES_ONLY_HINT : undefined}>
                <Select
                  value={draft.importance}
                  disabled={occurrenceScoped}
                  onChange={(e) => update({ importance: e.target.value as Item['importance'] })}
                  options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />
              </Field>
            </div>

            <SeriesOnlyGroup locked={occurrenceScoped}>
              <KindFields item={draft} onData={updateData} />
            </SeriesOnlyGroup>

            <Field label="List" hint={occurrenceScoped ? SERIES_ONLY_HINT : undefined}>
              <Select
                value={draft.listId ?? ''}
                disabled={occurrenceScoped}
                onChange={(e) => update({ listId: e.target.value || null })}
                options={[
                  { value: '', label: 'No list' },
                  ...lists.map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
            </Field>

            <Field label="Tags" hint={occurrenceScoped ? SERIES_ONLY_HINT : undefined}>
              <fieldset disabled={occurrenceScoped} className="min-w-0 opacity-60">
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
                    aria-label="Add tag"
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                </div>
              </fieldset>
            </Field>

            {(draft.kind === 'task' || draft.kind === 'goal' || draft.kind === 'event') && (
              <SeriesOnlyGroup locked={occurrenceScoped}>
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted">
                    {draft.kind === 'goal' ? 'Milestones' : 'Subtasks'}
                    {occurrenceScoped ? ` · ${SERIES_ONLY_HINT}` : ''}
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
                    aria-label={draft.kind === 'goal' ? 'Add milestone' : 'Add subtask'}
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
              </SeriesOnlyGroup>
            )}

            <SeriesOnlyGroup locked={occurrenceScoped}>
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted">
                  Checklist {occurrenceScoped ? `· ${SERIES_ONLY_HINT}` : ''}
                </span>
                {draft.checklist.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={entry.done}
                      aria-label={entry.text}
                      onChange={() => toggleChecklist(entry.id)}
                    />
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
                  aria-label="Add checklist item"
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
            </SeriesOnlyGroup>
          </div>
        </TabPanel>

        <TabPanel value="schedule">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-fg">
              <Checkbox
                checked={draft.allDay}
                onChange={(e) => {
                  const allDay = e.target.checked;
                  const base = (draft.start ? parseLocalDate(draft.start) : null) ?? new Date();
                  const time =
                    draft.start && hasTimeComponent(draft.start)
                      ? formatTime(draft.start)
                      : '09:00';
                  const next = allDay ? formatISODate(base) : `${formatISODate(base)}T${time}`;
                  // Keep `end` in the same shape as `start`, otherwise flipping the flag leaves
                  // a bare date ending a timed occurrence (or an instant ending an all-day one).
                  const end = draft.end
                    ? allDay
                      ? formatISODate(parseLocalDate(draft.end)!)
                      : hasTimeComponent(draft.end)
                        ? draft.end
                        : `${formatISODate(parseLocalDate(draft.end)!)}T${time}`
                    : null;
                  update({ allDay, start: next, dueAt: next, end });
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
                    aria-label="Start date"
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
                      className="input w-36"
                      aria-label="Start time"
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

              <Field label="Due" hint={occurrenceScoped ? SERIES_ONLY_HINT : undefined}>
                <input
                  type="datetime-local"
                  className="input"
                  disabled={occurrenceScoped}
                  // A date-only value needs a time to satisfy the input, even when the item is
                  // timed and the due date is left at the series value.
                  value={
                    draft.dueAt
                      ? hasTimeComponent(draft.dueAt) && !draft.allDay
                        ? draft.dueAt
                        : `${dateKeyOf(draft.dueAt)}T00:00`
                      : ''
                  }
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

            <SeriesOnlyGroup locked={occurrenceScoped} label={`Series · ${SERIES_ONLY_HINT}`}>
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
            </SeriesOnlyGroup>
          </div>
        </TabPanel>

        <TabPanel value="analytics">
          {analytics && (
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
        </TabPanel>

        <TabPanel value="history">
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
        </TabPanel>
      </Tabs>
    </Sheet>
  );
}
