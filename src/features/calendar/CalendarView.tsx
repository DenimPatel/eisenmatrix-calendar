import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonthDate,
  endOfWeek,
  endOfYearDate,
  formatDisplayDate,
  formatISODate,
  isSameMonth,
  isToday,
  parseLocalDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
  formatTime,
} from '@/lib/date';
import { useItems, useSetting } from '@/hooks/useData';
import { useOccurrences } from '@/hooks/useOccurrences';
import { useUiStore } from '@/store/useUiStore';
import { Droppable } from '@/features/shell/Droppable';
import { ItemCard } from '@/features/item/ItemCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { createItem } from '@/domain/itemFactory';
import { cn } from '@/lib/cn';
import { weekdayLabels } from '@/lib/labels';
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { AppSettings, Occurrence } from '@/types';

type CalendarMode = 'day' | 'week' | 'month' | 'year';

const MONTH_CELL_LIMIT = 3;
const YEAR_CARD_LIMIT = 5;

export function CalendarView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);
  const settings = useSetting<AppSettings>('app', DEFAULT_SETTINGS);
  const weekStartsOn = settings.weekStartsOn;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const interval = useMemo(() => {
    switch (mode) {
      case 'day':
        return { from: currentDate, to: currentDate };
      case 'week':
        return {
          from: startOfWeek(currentDate, weekStartsOn),
          to: endOfWeek(currentDate, weekStartsOn),
        };
      case 'month': {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonthDate(currentDate);
        return {
          from: startOfWeek(monthStart, weekStartsOn),
          to: endOfWeek(monthEnd, weekStartsOn),
        };
      }
      default:
        return { from: startOfYear(currentDate), to: endOfYearDate(currentDate) };
    }
  }, [mode, currentDate, weekStartsOn]);

  const occurrences = useOccurrences(items, interval.from, interval.to);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occ of occurrences) {
      const list = map.get(occ.occKey) ?? [];
      list.push(occ);
      map.set(occ.occKey, list);
    }
    return map;
  }, [occurrences]);

  const step = (direction: 1 | -1) => {
    switch (mode) {
      case 'day':
        setCurrentDate((d) => addDays(d, direction));
        break;
      case 'week':
        setCurrentDate((d) => addWeeks(d, direction));
        break;
      case 'month':
        setCurrentDate((d) => addMonths(d, direction));
        break;
      default:
        setCurrentDate((d) => addYears(d, direction));
    }
  };

  const title = useMemo(() => {
    if (mode === 'day') return formatDisplayDate(currentDate, 'EEEE, MMM d, yyyy');
    if (mode === 'week') {
      return `${formatDisplayDate(interval.from, 'MMM d')} – ${formatDisplayDate(interval.to, 'MMM d, yyyy')}`;
    }
    if (mode === 'month') return formatDisplayDate(currentDate, 'MMMM yyyy');
    return formatDisplayDate(currentDate, 'yyyy');
  }, [mode, currentDate, interval]);

  const addOn = (date: Date) => {
    openEditor(createItem({ kind: 'task', start: formatISODate(date) }));
  };

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft size={18} />
            </Button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="min-h-6 px-2 text-xs font-medium text-muted hover:text-fg"
            >
              Today
            </button>
            <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next">
              <ChevronRight size={18} />
            </Button>
          </div>
          <h2 className="min-w-[10rem] text-base font-semibold text-fg">{title}</h2>
        </div>

        <div className="flex rounded-lg border border-border p-0.5">
          {(['day', 'week', 'month', 'year'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === 'year' ? (
        <YearView currentDate={currentDate} occurrences={occurrences} onOpen={openEditor} />
      ) : mode === 'day' ? (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Agenda</h3>
            <Button variant="outline" size="sm" onClick={() => addOn(currentDate)}>
              <Plus size={14} /> Add
            </Button>
          </div>
          <AgendaList
            occurrences={byDay.get(formatISODate(currentDate)) ?? []}
            onEdit={openEditor}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {weekdayLabels(weekStartsOn).map((day) => (
              <div
                key={day}
                className="bg-elevated py-2 text-center text-xs font-semibold text-muted"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {eachDayOfInterval({ start: interval.from, end: interval.to }).map((day) => {
              const key = formatISODate(day);
              const dayOccurrences = byDay.get(key) ?? [];
              const inMonth = mode !== 'month' || isSameMonth(day, currentDate);
              const expanded = expandedDay === key;
              const shown = expanded ? dayOccurrences : dayOccurrences.slice(0, MONTH_CELL_LIMIT);
              return (
                <Droppable
                  key={key}
                  id={`day-${key}`}
                  data={{ dropType: 'day', dateKey: key }}
                  className={cn(
                    'min-h-[6.5rem] border-b border-r border-border p-1.5 transition-colors last:border-r-0',
                    !inMonth && 'bg-elevated/50 opacity-60',
                  )}
                  activeClassName="bg-accent-soft ring-1 ring-inset ring-accent"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        isToday(day) ? 'bg-accent text-accent-fg' : 'text-muted',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <button
                      type="button"
                      onClick={() => addOn(day)}
                      aria-label={`Add item on ${key}`}
                      className="group/add -mx-3.5 -my-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded group-hover/add:bg-elevated group-hover/add:text-fg">
                        <Plus size={12} />
                      </span>
                    </button>
                  </div>
                  <div className="space-y-1">
                    {shown.map((occ) => (
                      <button
                        key={`${occ.item.id}-${occ.occKey}`}
                        type="button"
                        onClick={() => openEditor(occ.item, occ.occKey)}
                        title={occ.title}
                        className={cn(
                          'block w-full truncate rounded px-1.5 py-1 text-left text-[11px] leading-4',
                          occ.status === 'done'
                            ? 'bg-elevated text-muted line-through'
                            : 'bg-accent-soft text-accent hover:opacity-80',
                        )}
                      >
                        {formatTime(occ.start) && (
                          <span className="mr-1 font-medium">{formatTime(occ.start)}</span>
                        )}
                        {occ.title}
                      </button>
                    ))}
                    {dayOccurrences.length > MONTH_CELL_LIMIT && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedDay((prev) => (prev === key ? null : key))}
                        className="block w-full truncate rounded px-1 py-1 text-left text-[10px] leading-4 text-muted hover:bg-elevated hover:text-accent"
                      >
                        {expanded
                          ? 'Show less'
                          : `+${dayOccurrences.length - MONTH_CELL_LIMIT} more`}
                      </button>
                    )}
                  </div>
                </Droppable>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AgendaList({
  occurrences,
  onEdit,
}: {
  occurrences: Occurrence[];
  onEdit: (item: Occurrence['item'], occKey?: string | null) => void;
}) {
  if (!occurrences.length) {
    return (
      <EmptyState
        icon={<CalendarDays size={20} />}
        title="Nothing scheduled"
        description="Drag items here from other views, or add one."
      />
    );
  }
  return (
    <div className="space-y-2">
      {occurrences
        .slice()
        .sort((a, b) => (a.start ?? a.occKey).localeCompare(b.start ?? b.occKey))
        .map((occ) => (
          <ItemCard
            key={`${occ.item.id}-${occ.occKey}`}
            item={occ.item}
            occurrenceKey={occ.occKey}
            start={occ.start}
            status={occ.status}
            showKind
            onEdit={onEdit}
          />
        ))}
    </div>
  );
}

function YearView({
  currentDate,
  occurrences,
  onOpen,
}: {
  currentDate: Date;
  occurrences: Occurrence[];
  onOpen: (item: import('@/types').Item, occKey?: string | null) => void;
}) {
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const from = new Date(currentDate.getFullYear(), index, 1);
        const to = endOfMonthDate(from);
        return { from, to, label: formatDisplayDate(from, 'MMMM') };
      }),
    [currentDate],
  );

  // One expansion over the whole year, bucketed by the occurrence's local month, replaces
  // twelve per-month expansions. Bucketing by `occKey` matches the old per-month window
  // exactly: `expandOccurrences` counts `count`/`until` from the series start either way.
  const byMonth = useMemo(() => {
    const buckets: Occurrence[][] = Array.from({ length: 12 }, () => []);
    for (const occ of occurrences) {
      const index = Number(occ.occKey.slice(5, 7)) - 1;
      if (index >= 0 && index < 12) buckets[index].push(occ);
    }
    return buckets;
  }, [occurrences]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((month, index) => (
        <YearMonthCard
          key={month.label}
          label={month.label}
          occurrences={byMonth[index]}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function YearMonthCard({
  label,
  occurrences,
  onOpen,
}: {
  label: string;
  occurrences: Occurrence[];
  onOpen: (item: import('@/types').Item, occKey?: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card p-3">
      <h3 className="mb-2 text-sm font-semibold text-fg">{label}</h3>
      <div className="space-y-1">
        {(expanded ? occurrences : occurrences.slice(0, YEAR_CARD_LIMIT)).map((occ) => (
          <button
            key={`${occ.item.id}-${occ.occKey}`}
            type="button"
            onClick={() => onOpen(occ.item, occ.occKey)}
            className="block w-full truncate py-1 text-left text-xs text-muted hover:text-accent"
          >
            <span className="mr-1 font-mono text-[10px]">
              {parseLocalDate(occ.occKey)?.getDate()}
            </span>
            {occ.title}
          </button>
        ))}
        {occurrences.length === 0 && <p className="text-xs text-muted">No items</p>}
        {occurrences.length > YEAR_CARD_LIMIT && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className="block w-full truncate rounded px-1 py-1 text-left text-[10px] leading-4 text-muted hover:bg-elevated hover:text-accent"
          >
            {expanded ? 'Show less' : `+${occurrences.length - YEAR_CARD_LIMIT} more`}
          </button>
        )}
      </div>
    </div>
  );
}
