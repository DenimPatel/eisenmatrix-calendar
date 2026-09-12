import { useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { useItems } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { createItem } from '@/domain/itemFactory';
import { goalProgress } from '@/domain/stats';
import { createItemsPersisted, toggleDone } from '@/domain/itemActions';
import { HORIZON_LABELS } from '@/lib/labels';
import { Checkbox } from '@/components/ui/Form';
import { cn } from '@/lib/cn';
import type { GoalItem, Item } from '@/types';

export function GoalsView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);
  const [milestoneDraft, setMilestoneDraft] = useState<Record<string, string>>({});

  const goals = useMemo(
    () =>
      items
        .filter((i): i is GoalItem => i.kind === 'goal' && !i.archivedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [items],
  );
  const childrenByGoal = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (!item.parentId) continue;
      const list = map.get(item.parentId) ?? [];
      list.push(item);
      map.set(item.parentId, list);
    }
    return map;
  }, [items]);

  const addMilestone = async (goalId: string) => {
    const title = milestoneDraft[goalId]?.trim();
    if (!title) return;
    await createItemsPersisted([createItem({ kind: 'task', title, parentId: goalId })]);
    setMilestoneDraft((prev) => ({ ...prev, [goalId]: '' }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Goals</h1>
          <p className="text-sm text-muted">
            Break big outcomes into milestones and track progress.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => openEditor(createItem({ kind: 'goal' }))}
        >
          <Plus size={14} /> New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={20} />}
          title="No goals yet"
          description="Create a goal with a metric and horizon, then add milestones."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditor(createItem({ kind: 'goal' }))}
            >
              <Plus size={14} /> New goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const children = childrenByGoal.get(goal.id) ?? [];
            const progress = goalProgress(goal, children);
            return (
              <div key={goal.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <ProgressRing value={progress.percent} size={56} strokeWidth={5} />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openEditor(goal)}
                      className="truncate text-left text-sm font-semibold text-fg hover:text-accent"
                    >
                      {goal.title || 'Untitled goal'}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="accent">{HORIZON_LABELS[goal.data.horizon]}</Badge>
                      <span className="text-xs text-muted">{progress.label}</span>
                    </div>
                    {goal.data.why && (
                      <p className="mt-1 line-clamp-2 text-xs italic text-muted">
                        “{goal.data.why}”
                      </p>
                    )}
                  </div>
                </div>

                {goal.data.metric.type === 'checklist' && (
                  <div className="space-y-1">
                    {children.map((child) => (
                      <label key={child.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={child.status === 'done'}
                          onChange={() => void toggleDone(child)}
                        />
                        <span
                          className={cn(
                            'flex-1',
                            child.status === 'done' && 'text-muted line-through',
                          )}
                        >
                          {child.title}
                        </span>
                      </label>
                    ))}
                    <div className="flex gap-1">
                      <input
                        className="input h-8 text-xs"
                        placeholder="Add milestone…"
                        value={milestoneDraft[goal.id] ?? ''}
                        onChange={(e) =>
                          setMilestoneDraft((prev) => ({ ...prev, [goal.id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && void addMilestone(goal.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void addMilestone(goal.id)}
                        aria-label="Add milestone"
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </div>
                )}

                {goal.data.metric.type === 'numeric' && (
                  <div className="h-2 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
