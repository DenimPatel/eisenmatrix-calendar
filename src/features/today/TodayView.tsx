import { useMemo } from 'react';
import { addDays, endOfDay, formatDisplayDate, startOfDay, todayKey } from '@/lib/date';
import { useItems } from '@/hooks/useData';
import { useOccurrences } from '@/hooks/useOccurrences';
import { useUiStore } from '@/store/useUiStore';
import { ItemCard } from '@/features/item/ItemCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { createItem } from '@/domain/itemFactory';
import { goalProgress, habitStreak } from '@/domain/stats';
import { parseLocalDate } from '@/lib/date';
import { cn } from '@/lib/cn';
import { CheckCircle2, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import type { BillItem, Item, Occurrence } from '@/types';

function isBillUnpaid(occ: Occurrence): occ is Occurrence & { item: BillItem } {
  return occ.item.kind === 'bill' && !occ.item.data.payments?.[occ.occKey];
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          {title}
          {count !== undefined && <Badge tone="muted">{count}</Badge>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TodayView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const todays = useOccurrences(items, todayStart, todayEnd);
  const overdue = useOccurrences(items, addDays(todayStart, -45), addDays(todayStart, -1)).filter(
    (occ) => occ.status !== 'done' && occ.status !== 'cancelled' && occ.item.kind !== 'habit',
  );
  const weekAhead = useOccurrences(items, todayStart, addDays(todayEnd, 7));

  const habits = useMemo(() => items.filter((i) => i.kind === 'habit' && !i.archivedAt), [items]);
  const goals = useMemo(() => items.filter((i) => i.kind === 'goal' && !i.archivedAt), [items]);
  const goalChildren = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      if (!item.parentId) continue;
      const list = map.get(item.parentId) ?? [];
      list.push(item);
      map.set(item.parentId, list);
    }
    return map;
  }, [items]);

  const billsThisWeek = weekAhead.filter(isBillUnpaid).slice(0, 6);

  const nextUp = todays
    .filter((occ) => occ.status !== 'done')
    .sort((a, b) => (a.start ?? a.occKey).localeCompare(b.start ?? b.occKey))[0];

  const completedToday = todays.filter((o) => o.status === 'done').length;
  const todayProgress = todays.length ? Math.round((completedToday / todays.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Today</h1>
          <p className="text-sm text-muted">{formatDisplayDate(now, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
            <Sparkles size={14} /> Quick add
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openEditor(createItem({ kind: 'task', start: todayKey() }))}
          >
            <Plus size={14} /> New task
          </Button>
        </div>
      </div>

      {nextUp && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            What's next
          </span>
          <span className="truncate text-sm font-medium text-fg">{nextUp.item.title}</span>
          {nextUp.start?.includes('T') && (
            <span className="text-xs text-muted">{nextUp.start.slice(11, 16)}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {overdue.length > 0 && (
            <Section title="Overdue" count={overdue.length}>
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950">
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-rose-500" />
                <div className="w-full space-y-1.5">
                  {overdue.slice(0, 6).map((occ) => (
                    <div
                      key={`${occ.item.id}-${occ.occKey}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        className="truncate text-sm text-fg hover:text-accent"
                        onClick={() => openEditor(occ.item, occ.occKey)}
                      >
                        {occ.item.title}
                      </button>
                      <span className="shrink-0 text-xs text-rose-600 dark:text-rose-300">
                        {parseLocalDate(occ.occKey)?.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          <Section
            title="Today's agenda"
            count={todays.length}
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">
                  {completedToday}/{todays.length} done
                </span>
                <ProgressRing value={todayProgress} size={28} strokeWidth={3} />
              </div>
            }
          >
            <div className="space-y-2">
              {todays.map((occ) => (
                <ItemCard
                  key={`${occ.item.id}-${occ.occKey}`}
                  item={occ.item}
                  occurrenceKey={occ.occKey}
                  status={occ.status}
                  showKind
                  onEdit={openEditor}
                />
              ))}
              {todays.length === 0 && (
                <EmptyState
                  icon={<CheckCircle2 size={20} />}
                  title="Nothing scheduled today"
                  description="Enjoy the clear runway, or add something with C."
                />
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section
            title="Habits"
            count={habits.length}
            action={
              <Button variant="ghost" size="sm" onClick={() => setQuickAddOpen(true)}>
                <Plus size={12} /> Add
              </Button>
            }
          >
            <div className="space-y-3">
              {habits.map((habit) => {
                const streak = habitStreak(habit);
                const doneToday = todays.some((o) => o.item.id === habit.id && o.status === 'done');
                return (
                  <div key={habit.id} className="flex items-center gap-3">
                    <ProgressRing
                      value={doneToday ? 100 : 0}
                      size={40}
                      strokeWidth={4}
                      tone={doneToday ? 'success' : 'accent'}
                      label={<span className="text-[10px] font-bold">{doneToday ? '✓' : '0'}</span>}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{habit.title}</div>
                      <div className="text-xs text-muted">
                        {streak.current} day streak · best {streak.best}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditor(habit)}>
                      Edit
                    </Button>
                  </div>
                );
              })}
              {habits.length === 0 && <p className="text-sm text-muted">No habits yet.</p>}
            </div>
          </Section>

          <Section title="Bills due soon" count={billsThisWeek.length}>
            <div className="space-y-2">
              {billsThisWeek.map((occ) => (
                <button
                  key={`${occ.item.id}-${occ.occKey}`}
                  type="button"
                  onClick={() => openEditor(occ.item, occ.occKey)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-elevated"
                >
                  <span className="truncate text-sm text-fg">{occ.item.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {occ.item.data.currency} {occ.item.data.amount}
                  </span>
                </button>
              ))}
              {billsThisWeek.length === 0 && (
                <p className="text-sm text-muted">No bills due this week.</p>
              )}
            </div>
          </Section>

          <Section title="Goal progress" count={goals.length}>
            <div className="space-y-3">
              {goals.slice(0, 4).map((goal) => {
                const progress = goalProgress(goal, goalChildren.get(goal.id) ?? []);
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => openEditor(goal)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <ProgressRing value={progress.percent} size={40} strokeWidth={4} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{goal.title}</div>
                      <div className="text-xs text-muted">{progress.label}</div>
                    </div>
                  </button>
                );
              })}
              {goals.length === 0 && <p className="text-sm text-muted">No goals yet.</p>}
            </div>
          </Section>
        </div>
      </div>

      <div className={cn('text-center text-xs text-muted')}>
        Data stays on this device. Export a backup any time from Settings.
      </div>
    </div>
  );
}
