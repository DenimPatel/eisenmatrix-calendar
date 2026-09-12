import { useMemo, useState } from 'react';
import { Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useItems, useLists } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Checkbox, Select } from '@/components/ui/Form';
import { createItem } from '@/domain/itemFactory';
import { createItemPersisted, deleteItems, patchItem } from '@/domain/itemActions';
import { listRepo } from '@/db/repository';
import { newId } from '@/lib/id';
import { cn } from '@/lib/cn';
import type { Item } from '@/types';

export function ShoppingView() {
  const items = useItems();
  const lists = useLists();
  const openEditor = useUiStore((s) => s.openEditor);
  const [activeListId, setActiveListId] = useState<string>('all');
  const [draft, setDraft] = useState('');

  const shoppingLists = useMemo(() => lists.filter((l) => l.kind === 'shopping'), [lists]);

  const shoppingItems = useMemo(
    () =>
      items
        .filter((i) => i.kind === 'shopping' && !i.archivedAt)
        .filter((i) => activeListId === 'all' || i.listId === activeListId),
    [items, activeListId],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of shoppingItems) {
      const aisle = (item as Item & { kind: 'shopping' }).data.aisle || 'Uncategorised';
      const list = map.get(aisle) ?? [];
      list.push(item);
      map.set(aisle, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [shoppingItems]);

  const estimatedTotal = shoppingItems.reduce((sum, item) => {
    const data = (item as Item & { kind: 'shopping' }).data;
    return sum + (data.purchased ? 0 : (data.estPrice ?? 0) * (data.quantity || 1));
  }, 0);
  const purchasedCount = shoppingItems.filter(
    (i) => (i as Item & { kind: 'shopping' }).data.purchased,
  ).length;

  const togglePurchased = async (item: Item) => {
    if (item.kind !== 'shopping') return;
    await patchItem(
      item.id,
      { data: { ...item.data, purchased: !item.data.purchased } },
      { silent: true, trackHistory: false },
    );
  };

  const addItem = async () => {
    const title = draft.trim();
    if (!title) return;
    const listId =
      activeListId !== 'all' ? activeListId : (shoppingLists[0]?.id ?? (await ensureDefaultList()));
    await createItemPersisted(createItem({ kind: 'shopping', title, listId }));
    setDraft('');
  };

  const ensureDefaultList = async (): Promise<string | null> => {
    const existing = shoppingLists[0];
    if (existing) return existing.id;
    const id = newId();
    await listRepo.create({
      id,
      name: 'Groceries',
      kind: 'shopping',
      color: 'accent',
      icon: 'cart',
      order: lists.length,
      archivedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  };

  const clearPurchased = async () => {
    const purchased = shoppingItems.filter(
      (i) => (i as Item & { kind: 'shopping' }).data.purchased,
    );
    await deleteItems(purchased);
  };

  const addList = async () => {
    const name = window.prompt('New shopping list name');
    if (!name?.trim()) return;
    const id = newId();
    await listRepo.create({
      id,
      name: name.trim(),
      kind: 'shopping',
      color: 'accent',
      icon: 'cart',
      order: lists.length,
      archivedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setActiveListId(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-fg">Shopping</h1>
          <p className="text-sm text-muted">
            {purchasedCount}/{shoppingItems.length} purchased · est. {estimatedTotal.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="w-auto"
            value={activeListId}
            onChange={(e) => setActiveListId(e.target.value)}
            options={[
              { value: 'all', label: 'All lists' },
              ...shoppingLists.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
          <Button variant="outline" size="sm" onClick={() => void addList()}>
            <Plus size={14} /> List
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void clearPurchased()}
            disabled={!purchasedCount}
          >
            <Trash2 size={14} /> Clear purchased
          </Button>
        </div>
      </div>

      <div className="card flex gap-2 p-3">
        <input
          className="input"
          placeholder="Add item and press Enter (e.g. milk 2L)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void addItem()}
        />
        <Button variant="primary" onClick={() => void addItem()}>
          <Plus size={14} /> Add
        </Button>
      </div>

      {shoppingItems.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={20} />}
          title="Your list is empty"
          description="Add groceries with quantity and aisle, or use quick add with #groceries."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map(([aisle, aisleItems]) => (
            <section key={aisle} className="card p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {aisle}
              </h2>
              <div className="space-y-1">
                {aisleItems.map((item) => {
                  const data = (item as Item & { kind: 'shopping' }).data;
                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                      <Checkbox
                        checked={data.purchased}
                        onChange={() => void togglePurchased(item)}
                        aria-label={`Mark ${item.title} purchased`}
                      />
                      <button
                        type="button"
                        onClick={() => openEditor(item)}
                        className={cn(
                          'min-w-0 flex-1 truncate text-left text-sm',
                          data.purchased ? 'text-muted line-through' : 'text-fg',
                        )}
                      >
                        {item.title}
                        {data.quantity ? (
                          <span className="ml-1 text-xs text-muted">
                            {data.quantity}
                            {data.unit ? ` ${data.unit}` : ''}
                          </span>
                        ) : null}
                      </button>
                      {data.estPrice != null && (
                        <span className="text-xs text-muted">${data.estPrice.toFixed(2)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
