import { useMemo, useState } from 'react';
import { Archive, ArrowUpDown, CheckCircle2, Plus, Search, Trash2 } from 'lucide-react';
import { useItems, useLists } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { Droppable } from '@/features/shell/Droppable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Checkbox, Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { createItem } from '@/domain/itemFactory';
import { archiveItem, deleteItems, patchItem, setStatus } from '@/domain/itemActions';
import { listRepo } from '@/db/repository';
import { newId } from '@/lib/id';
import { quadrantOf, priorityScore } from '@/domain/eisenhower';
import { ITEM_KIND_LABELS, ITEM_STATUS_LABELS, statusClasses } from '@/lib/labels';
import { formatISODate } from '@/lib/date';
import { cn } from '@/lib/cn';
import type { Item, ItemStatus, List } from '@/types';

type SortKey = 'date' | 'priority' | 'title' | 'created';

export function ListView() {
  const items = useItems();
  const lists = useLists();
  const openEditor = useUiStore((s) => s.openEditor);
  const filters = useUiStore((s) => s.filters);
  const setFilters = useUiStore((s) => s.setFilters);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(true);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [newListName, setNewListName] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const activeListId = filters.listId;

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase();
    let result = items.filter((item) => {
      if (showArchived ? !item.archivedAt : !!item.archivedAt) return false;
      if (activeListId === 'inbox' && item.listId) return false;
      if (activeListId && activeListId !== 'inbox' && item.listId !== activeListId) return false;
      if (filters.kinds.length && !filters.kinds.includes(item.kind)) return false;
      if (filters.statuses.length && !filters.statuses.includes(item.status)) return false;
      if (
        search &&
        !`${item.title} ${item.notes} ${item.tags.join(' ')}`.toLowerCase().includes(search)
      )
        return false;
      return true;
    });

    result = result.slice().sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'date') comparison = (a.start ?? '9999').localeCompare(b.start ?? '9999');
      else if (sortKey === 'priority') comparison = priorityScore(a) - priorityScore(b);
      else if (sortKey === 'title') comparison = a.title.localeCompare(b.title);
      else comparison = a.createdAt - b.createdAt;
      return sortAsc ? comparison : -comparison;
    });
    return result;
  }, [items, filters, activeListId, sortKey, sortAsc, showArchived]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleSelection = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = items.filter((i) => selection.has(i.id));

  const bulkComplete = async () => {
    for (const item of selectedItems) await setStatus(item, 'done');
    setSelection(new Set());
  };

  const bulkArchive = async () => {
    for (const item of selectedItems) await archiveItem(item);
    setSelection(new Set());
  };

  const bulkDelete = async () => {
    await deleteItems(selectedItems);
    setSelection(new Set());
  };

  const bulkMove = async (listId: string | null) => {
    for (const item of selectedItems) {
      await patchItem(item.id, { listId }, { silent: true, trackHistory: false });
    }
    setSelection(new Set());
  };

  const createList = async () => {
    if (!newListName.trim()) return;
    const list: List = {
      id: newId(),
      name: newListName.trim(),
      kind: 'project',
      color: 'accent',
      icon: 'list',
      order: lists.length,
      archivedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await listRepo.create(list);
    setNewListName('');
    setFilters({ listId: list.id });
  };

  const allSelected = filtered.length > 0 && filtered.every((i) => selection.has(i.id));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_1fr]">
      <aside className="card h-fit p-2">
        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Lists
        </div>
        <ListButton
          active={activeListId === null}
          onClick={() => setFilters({ listId: null })}
          label="All items"
          count={items.filter((i) => !i.archivedAt).length}
        />
        <Droppable
          id="list-inbox"
          data={{ dropType: 'list', listId: 'inbox' }}
          className="rounded-lg"
          activeClassName="ring-1 ring-accent"
        >
          <ListButton
            active={activeListId === 'inbox'}
            onClick={() => setFilters({ listId: 'inbox' })}
            label="Inbox"
            count={items.filter((i) => !i.archivedAt && !i.listId).length}
          />
        </Droppable>
        {lists.map((list) => (
          <Droppable
            key={list.id}
            id={`list-${list.id}`}
            data={{ dropType: 'list', listId: list.id }}
            className="rounded-lg"
            activeClassName="ring-1 ring-accent"
          >
            <ListButton
              active={activeListId === list.id}
              onClick={() => setFilters({ listId: list.id })}
              label={list.name}
              count={items.filter((i) => i.listId === list.id && !i.archivedAt).length}
            />
          </Droppable>
        ))}
        <div className="mt-2 flex gap-1 px-1">
          <input
            className="input h-8 text-xs"
            placeholder="New list…"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void createList()}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void createList()}
            aria-label="Create list"
          >
            <Plus size={14} />
          </Button>
        </div>
      </aside>

      <div className="card flex min-h-[30rem] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9"
              placeholder="Search items…"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
          <Select
            className="w-auto"
            value={filters.kinds.length === 1 ? filters.kinds[0] : 'all'}
            onChange={(e) =>
              setFilters({
                kinds: e.target.value === 'all' ? [] : [e.target.value as Item['kind']],
              })
            }
            options={[
              { value: 'all', label: 'All kinds' },
              ...Object.entries(ITEM_KIND_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <Select
            className="w-auto"
            value={filters.statuses.length === 1 ? filters.statuses[0] : 'all'}
            onChange={(e) =>
              setFilters({
                statuses: e.target.value === 'all' ? [] : [e.target.value as ItemStatus],
              })
            }
            options={[
              { value: 'all', label: 'All statuses' },
              ...Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <Checkbox checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Archived
          </label>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              openEditor(createItem({ kind: 'task', start: formatISODate(new Date()) }))
            }
          >
            <Plus size={14} /> Add
          </Button>
        </div>

        {selection.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent-soft px-3 py-2 text-sm">
            <span className="font-medium text-accent">{selection.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => void bulkComplete()}>
              <CheckCircle2 size={14} /> Complete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void bulkArchive()}>
              <Archive size={14} /> Archive
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void bulkDelete()}>
              <Trash2 size={14} /> Delete
            </Button>
            <Select
              className="ml-auto w-auto"
              value=""
              onChange={(e) =>
                e.target.value !== '' &&
                void bulkMove(e.target.value === 'inbox' ? null : e.target.value)
              }
              options={[
                { value: '', label: 'Move to…' },
                { value: 'inbox', label: 'Inbox' },
                ...lists.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
            <Button variant="ghost" size="sm" onClick={() => setSelection(new Set())}>
              Clear
            </Button>
          </div>
        )}

        <div className="hidden grid-cols-[2rem_1fr_7rem_7rem_6rem] gap-3 border-b border-border bg-elevated px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted md:grid">
          <span>
            <Checkbox
              checked={allSelected}
              onChange={() =>
                setSelection(allSelected ? new Set() : new Set(filtered.map((i) => i.id)))
              }
              aria-label="Select all"
            />
          </span>
          <button
            type="button"
            className="flex items-center gap-1 text-left"
            onClick={() => toggleSort('title')}
          >
            Item <ArrowUpDown size={12} />
          </button>
          <span>List</span>
          <button
            type="button"
            className="flex items-center gap-1"
            onClick={() => toggleSort('priority')}
          >
            Priority <ArrowUpDown size={12} />
          </button>
          <button
            type="button"
            className="flex items-center gap-1"
            onClick={() => toggleSort('date')}
          >
            Date <ArrowUpDown size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((item) => {
            const list = lists.find((l) => l.id === item.listId);
            const quadrant = quadrantOf(item);
            return (
              <div
                key={item.id}
                className="grid grid-cols-1 items-center gap-2 border-b border-border px-3 py-2 hover:bg-elevated md:grid-cols-[2rem_1fr_7rem_7rem_6rem] md:gap-3"
              >
                <Checkbox
                  checked={selection.has(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  aria-label={`Select ${item.title}`}
                />
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => openEditor(item)}
                >
                  <div
                    className={cn(
                      'truncate text-sm font-medium text-fg',
                      item.status === 'done' && 'text-muted line-through',
                    )}
                  >
                    {item.title || 'Untitled'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <Badge tone="muted" className="px-1 py-0 text-[10px]">
                      {ITEM_KIND_LABELS[item.kind]}
                    </Badge>
                    {item.tags.slice(0, 2).map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                </button>
                <span className="truncate text-xs text-muted">{list?.name ?? '—'}</span>
                <span className="flex items-center gap-1">
                  <Badge
                    tone={quadrant === 'q1' ? 'danger' : quadrant === 'q2' ? 'accent' : 'muted'}
                  >
                    {quadrant.toUpperCase()}
                  </Badge>
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      statusClasses(item.status),
                    )}
                  >
                    {ITEM_STATUS_LABELS[item.status]}
                  </span>
                  <span className="text-xs text-muted">{item.start?.slice(0, 10) ?? ''}</span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState
              className="m-4"
              icon={<Search size={20} />}
              title="No items match"
              description="Adjust filters or add a new item."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters({
                      search: '',
                      kinds: [],
                      statuses: [],
                      listId: null,
                      tags: [],
                    })
                  }
                >
                  Reset filters
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ListButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm',
        active ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-elevated',
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs text-muted">{count}</span>
    </button>
  );
}
