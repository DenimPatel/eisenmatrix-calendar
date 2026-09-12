import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useItems } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { QUADRANT_IDS, QUADRANTS, itemsInQuadrant, priorityScore } from '@/domain/eisenhower';
import { Droppable } from '@/features/shell/Droppable';
import { ItemCard } from '@/features/item/ItemCard';
import { Button } from '@/components/ui/Button';
import { createItem } from '@/domain/itemFactory';
import { cn } from '@/lib/cn';
import type { QuadrantId } from '@/domain/eisenhower';

const QUADRANT_TEXT: Record<QuadrantId, string> = {
  q1: 'text-q1',
  q2: 'text-q2',
  q3: 'text-q3',
  q4: 'text-q4',
};

export function MatrixView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);
  const [hideDone, setHideDone] = useState(true);

  const matrixItems = useMemo(
    () =>
      items
        .filter((i) => ['task', 'event', 'bill'].includes(i.kind))
        .filter((i) => (hideDone ? i.status !== 'done' && i.status !== 'cancelled' : true))
        .sort((a, b) => priorityScore(b) - priorityScore(a) || b.updatedAt - a.updatedAt),
    [items, hideDone],
  );

  const addToQuadrant = (quadrant: QuadrantId) => {
    const meta = QUADRANTS[quadrant];
    openEditor(createItem({ kind: 'task', urgency: meta.urgency, importance: meta.importance }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-fg">Eisenhower Matrix</h1>
          <p className="text-sm text-muted">Drag items between quadrants to reprioritise.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          Hide completed
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {QUADRANT_IDS.map((id) => {
          const meta = QUADRANTS[id];
          const quadrantItems = itemsInQuadrant(matrixItems, id);
          return (
            <Droppable
              key={id}
              id={id}
              data={{ dropType: 'quadrant', quadrantId: id }}
              className="card flex min-h-[16rem] flex-col overflow-hidden"
              activeClassName={cn('ring-2 ring-inset ring-accent')}
            >
              <div className="flex items-center justify-between border-b border-border bg-elevated px-3 py-2">
                <div>
                  <h2
                    className={cn('text-sm font-bold uppercase tracking-wide', QUADRANT_TEXT[id])}
                  >
                    {meta.title}
                  </h2>
                  <p className="text-[11px] text-muted">{meta.subtitle}</p>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-muted">
                  {quadrantItems.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {quadrantItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    status={item.status}
                    onEdit={(it) => openEditor(it)}
                  />
                ))}
                {quadrantItems.length === 0 && (
                  <p className="py-6 text-center text-xs italic text-muted">Drop items here</p>
                )}
              </div>
              <div className="border-t border-border p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full border border-dashed border-border"
                  onClick={() => addToQuadrant(id)}
                >
                  <Plus size={14} /> Add
                </Button>
              </div>
            </Droppable>
          );
        })}
      </div>
    </div>
  );
}
