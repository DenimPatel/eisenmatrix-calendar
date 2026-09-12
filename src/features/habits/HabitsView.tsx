import { useMemo } from 'react';
import { Flame, Plus } from 'lucide-react';
import { useItems } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { createItem } from '@/domain/itemFactory';
import { expandOccurrences } from '@/domain/recurrence';
import { habitStreak } from '@/domain/stats';
import { toggleDone } from '@/domain/itemActions';
import { addDays, endOfDay, formatISODate, startOfDay, startOfWeek, todayKey } from '@/lib/date';
import { cn } from '@/lib/cn';
import type { HabitItem, Item } from '@/types';

const WEEKS = 12;
const DAYS = WEEKS * 7;

export function HabitsView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);

  const habits = useMemo(
    () => items.filter((i): i is HabitItem => i.kind === 'habit' && !i.archivedAt),
    [items],
  );
  const today = todayKey();

  const windowStart = useMemo(() => startOfWeek(addDays(new Date(), -(DAYS - 1)), 1), []);
  const windowEnd = useMemo(() => endOfDay(new Date()), []);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < DAYS; i++) out.push(addDays(windowStart, i));
    return out;
  }, [windowStart]);

  const habitData = useMemo(
    () =>
      habits.map((habit) => {
        const occurrences = expandOccurrences(habit, windowStart, windowEnd);
        const doneByDay = new Map<string, number>();
        for (const occ of occurrences) {
          if (occ.status === 'done') {
            doneByDay.set(occ.occKey, (doneByDay.get(occ.occKey) ?? 0) + 1);
          }
        }
        return { habit, doneByDay, streak: habitStreak(habit) };
      }),
    [habits, windowStart, windowEnd],
  );

  const markToday = async (habit: Item) => {
    const occ = expandOccurrences(habit, startOfDay(new Date()), endOfDay(new Date()))[0];
    await toggleDone(habit, occ?.occKey ?? today);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Habits</h1>
          <p className="text-sm text-muted">Don't break the chain.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => openEditor(createItem({ kind: 'habit', start: today }))}
        >
          <Plus size={14} /> New habit
        </Button>
      </div>

      {habits.length === 0 ? (
        <EmptyState
          icon={<Flame size={20} />}
          title="No habits yet"
          description="Create a habit with a target per day, week, or month."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditor(createItem({ kind: 'habit', start: today }))}
            >
              <Plus size={14} /> New habit
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {habitData.map(({ habit, doneByDay, streak }) => {
            const doneToday = (doneByDay.get(today) ?? 0) >= Math.max(1, habit.data.target.count);
            return (
              <div key={habit.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void markToday(habit)}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-colors',
                        doneToday
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-border text-muted hover:border-accent',
                      )}
                      aria-label={doneToday ? 'Undo today' : 'Complete today'}
                    >
                      {doneToday ? '✓' : '○'}
                    </button>
                    <div>
                      <button
                        type="button"
                        onClick={() => openEditor(habit)}
                        className="text-left text-sm font-semibold text-fg hover:text-accent"
                      >
                        {habit.title || 'Untitled habit'}
                      </button>
                      <div className="text-xs text-muted">
                        {habit.data.target.count}× per {habit.data.target.per}
                        {habit.data.unit ? ` · ${habit.data.unit}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="warning">
                      <Flame size={11} /> {streak.current} day streak
                    </Badge>
                    <Badge tone="muted">Best {streak.best}</Badge>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <div
                    className="grid w-max grid-flow-col grid-rows-7 gap-1"
                    role="img"
                    aria-label={`${habit.title} completion heatmap`}
                  >
                    {days.map((day) => {
                      const key = formatISODate(day);
                      const count = doneByDay.get(key) ?? 0;
                      const intensity = Math.min(4, count);
                      return (
                        <div
                          key={key}
                          title={`${key}: ${count}`}
                          className={cn(
                            'h-3.5 w-3.5 rounded-sm',
                            intensity === 0 && 'bg-elevated',
                            intensity === 1 && 'bg-emerald-200 dark:bg-emerald-900',
                            intensity === 2 && 'bg-emerald-300 dark:bg-emerald-800',
                            intensity === 3 && 'bg-emerald-500 dark:bg-emerald-600',
                            intensity >= 4 && 'bg-emerald-600 dark:bg-emerald-400',
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
