import { useMemo } from 'react';
import { Flame, Plus } from 'lucide-react';
import { useItems, useSetting } from '@/hooks/useData';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { createItem } from '@/domain/itemFactory';
import { expandOccurrences } from '@/domain/recurrence';
import { habitStreak } from '@/domain/stats';
import { toggleHabitOccurrence } from '@/domain/itemActions';
import {
  addDays,
  endOfDay,
  formatDisplayDate,
  formatISODate,
  startOfWeek,
  todayKey,
} from '@/lib/date';
import { cn } from '@/lib/cn';
import { weekdayFullLabels, weekdayLabels } from '@/lib/labels';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { AppSettings, HabitItem, Item } from '@/types';

const WEEKS = 12;
const DAYS = WEEKS * 7;

/** Shared shade mapping so the legend and the heatmap can never drift apart. */
function intensityClass(intensity: number): string {
  if (intensity <= 0) return 'bg-border';
  if (intensity === 1) return 'bg-emerald-200 dark:bg-emerald-900';
  if (intensity === 2) return 'bg-emerald-300 dark:bg-emerald-800';
  if (intensity === 3) return 'bg-emerald-500 dark:bg-emerald-600';
  return 'bg-emerald-600 dark:bg-emerald-400';
}

const INTENSITY_LEVELS = [0, 1, 2, 3, 4] as const;

function HeatmapLegend() {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
      <span>Less</span>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {INTENSITY_LEVELS.map((level) => (
          <span key={level} className={cn('h-3.5 w-3.5 rounded-sm', intensityClass(level))} />
        ))}
      </div>
      <span>More</span>
      <span className="ml-1">0&ndash;4+ completions per day</span>
    </div>
  );
}

export function HabitsView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);
  const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
  const weekStartsOn = settings.weekStartsOn;

  const habits = useMemo(
    () => items.filter((i): i is HabitItem => i.kind === 'habit' && !i.archivedAt),
    [items],
  );
  const today = todayKey();

  const windowStart = useMemo(
    () => startOfWeek(addDays(new Date(), -(DAYS - 1)), weekStartsOn),
    [weekStartsOn],
  );
  const windowEnd = useMemo(() => endOfDay(new Date()), []);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < DAYS; i++) out.push(addDays(windowStart, i));
    return out;
  }, [windowStart]);

  const weekStarts = useMemo(
    () => Array.from({ length: WEEKS }, (_, week) => days[week * 7]),
    [days],
  );

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
    await toggleHabitOccurrence(habit);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Habits</h1>
          <p className="text-sm text-muted">Don't break the chain.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="whitespace-nowrap"
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
                      aria-pressed={doneToday}
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

                <div className="mt-4">
                  <div className="flex items-start gap-2 overflow-x-auto">
                    <div className="grid shrink-0 grid-rows-7 gap-1" aria-hidden="true">
                      {weekdayLabels(weekStartsOn).map((label) => (
                        <div
                          key={label}
                          className="flex h-3.5 w-5 items-center text-[10px] leading-none text-muted"
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                    <div
                      className="grid w-max grid-flow-col grid-rows-7 gap-1"
                      role="img"
                      aria-label={`${habit.title} completion heatmap`}
                    >
                      {days.map((day) => {
                        const key = formatISODate(day);
                        const count = doneByDay.get(key) ?? 0;
                        return (
                          <div
                            key={key}
                            title={`${key}: ${count}`}
                            className={cn('h-3.5 w-3.5 rounded-sm', intensityClass(count))}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <HeatmapLegend />

                  {/* Same data as the shaded grid, exposed as text so colour is never the
                      only encoding. The wrapper (not the table) is the clipped 1px box: a
                      table's used width is its min-content width, so `sr-only` on the table
                      itself would still push the document scroll width past the viewport. */}
                  <div className="sr-only overflow-hidden">
                    <table>
                      <caption>
                        {`${habit.title} completion heatmap. One column per week for the last ${WEEKS} weeks, one row per weekday. Each cell is the number of completed occurrences that day (0 to 4 or more).`}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Weekday</th>
                          {weekStarts.map((week) => (
                            <th key={formatISODate(week)} scope="col">
                              {formatDisplayDate(week, 'MMM d')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weekdayFullLabels(weekStartsOn).map((label, row) => (
                          <tr key={label}>
                            <th scope="row">{label}</th>
                            {weekStarts.map((_, week) => {
                              const key = formatISODate(days[week * 7 + row]);
                              return <td key={key}>{doneByDay.get(key) ?? 0}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
