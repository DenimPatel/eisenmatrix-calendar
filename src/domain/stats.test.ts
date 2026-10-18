import { describe, expect, it } from 'vitest';
import {
  activeDayStreak,
  completionStats,
  goalProgress,
  habitStreak,
  itemCompletionStats,
  overallCompletion,
} from './stats';
import { createItem } from './itemFactory';
import { parseLocalDate } from '@/lib/date';
import type {
  GoalData,
  GoalItem,
  HabitData,
  Item,
  ItemStatus,
  Occurrence,
  OccurrenceStatus,
  RecurrenceRule,
  TaskItem,
} from '@/types';
import { ITEM_KINDS } from '@/types';

function withoutData(item: Item): Item {
  const { data: _data, ...rest } = item;
  return rest as Item;
}

function makeHabit(start: string, per: 'day' | 'week' | 'month' = 'month', count = 1): Item {
  const item = createItem({ kind: 'habit', title: 'Read', start, allDay: true });
  item.recurrence = {
    freq: 'daily',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
  };
  (item.data as HabitData).target = { count, per };
  return item;
}

function markDone(item: Item, keys: string[]): Item {
  for (const key of keys) {
    item.occurrences[key] = { status: 'done', completedAt: Date.now() };
  }
  return item;
}

describe('habitStreak', () => {
  it('resets the best run across a fully-missed month', () => {
    const item = markDone(makeHabit('2024-01-01'), ['2024-01-10', '2024-03-10']);
    const result = habitStreak(item, new Date(2024, 2, 31));
    expect(result.best).toBe(1);
    expect(result.current).toBe(1);
  });

  it('keeps the run across adjacent completed months', () => {
    const item = markDone(makeHabit('2024-01-01'), ['2024-01-10', '2024-02-10']);
    const result = habitStreak(item, new Date(2024, 1, 15));
    expect(result.best).toBe(2);
    expect(result.current).toBe(2);
  });

  it('resets the best run across a fully-missed week', () => {
    const item = markDone(makeHabit('2024-01-01', 'week'), ['2024-01-03', '2024-01-17']);
    const result = habitStreak(item, new Date(2024, 1, 1));
    expect(result.best).toBe(1);
  });

  it('honours target.count when deciding a period is complete', () => {
    const item = markDone(makeHabit('2024-01-01', 'month', 2), ['2024-01-05']);
    const result = habitStreak(item, new Date(2024, 0, 31));
    expect(result.best).toBe(0);
  });

  it('does not break the current streak on an in-progress period', () => {
    const item = markDone(makeHabit('2024-01-01'), ['2024-01-10']);
    const result = habitStreak(item, new Date(2024, 1, 10));
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });
});

function makeGoal(metric: GoalData['metric'], status: ItemStatus = 'todo'): GoalItem {
  return createItem({
    kind: 'goal',
    title: 'Goal',
    status,
    data: { metric, horizon: 'quarter' },
  }) as GoalItem;
}

function makeChild(
  goal: GoalItem,
  title: string,
  done: 'status' | 'completedAt' | 'no' = 'no',
): TaskItem {
  const item = createItem({
    kind: 'task',
    title,
    parentId: goal.id,
    status: done === 'status' ? 'done' : 'todo',
  }) as TaskItem;
  if (done === 'completedAt') item.completedAt = Date.UTC(2024, 0, 2);
  return item;
}

function occurrence(item: Item, key: string, status: OccurrenceStatus): Occurrence {
  return {
    item,
    occKey: key,
    date: parseLocalDate(key)!,
    title: item.title,
    start: key,
    end: null,
    allDay: true,
    status,
    completedAt: status === 'done' ? Date.UTC(2024, 0, 1) : null,
    isOverride: false,
  };
}

function dailyTask(start: string, rule: Partial<RecurrenceRule> = {}): TaskItem {
  const item = createItem({
    kind: 'task',
    title: 'Task',
    start,
    allDay: true,
  }) as TaskItem;
  item.recurrence = {
    freq: 'daily',
    interval: 1,
    weekStartsOn: 1,
    exceptions: [],
    overrides: {},
    ...rule,
  };
  return item;
}

describe('goalProgress', () => {
  it('rounds the numeric percent and appends the unit', () => {
    const goal = makeGoal({ type: 'numeric', current: 3, target: 8, unit: 'pages' });
    expect(goalProgress(goal)).toEqual({
      current: 3,
      target: 8,
      percent: 38,
      label: '3/8 pages',
    });
  });

  it('omits the space and unit when a numeric metric has none', () => {
    const goal = makeGoal({ type: 'numeric', current: 3, target: 4 });
    expect(goalProgress(goal).label).toBe('3/4');
    expect(goalProgress(goal).percent).toBe(75);
  });

  it('clamps an over-target numeric metric to 100 percent', () => {
    const goal = makeGoal({ type: 'numeric', current: 12, target: 8 });
    const result = goalProgress(goal);
    expect(result.percent).toBe(100);
    expect(result.label).toBe('12/8');
  });

  it('falls back to a target of 1 when a numeric metric omits it', () => {
    const goal = makeGoal({ type: 'numeric', current: 0 });
    expect(goalProgress(goal)).toEqual({ current: 0, target: 1, percent: 0, label: '0/1' });
  });

  it('does not divide by a zero numeric target', () => {
    const goal = makeGoal({ type: 'numeric', current: 0, target: 0 });
    const result = goalProgress(goal);
    expect(result.percent).toBe(0);
    expect(result.label).toBe('0/0');
  });

  it('reports a done goal as a complete binary metric', () => {
    const goal = makeGoal({ type: 'binary', current: 5, target: 10 }, 'done');
    expect(goalProgress(goal)).toEqual({ current: 1, target: 1, percent: 100, label: '1/1' });
  });

  it('ignores the numeric target of a binary metric', () => {
    const goal = makeGoal({ type: 'binary', target: 10, current: 1 });
    expect(goalProgress(goal)).toEqual({ current: 1, target: 1, percent: 100, label: '1/1' });
  });

  it('treats a completedAt without a done status as a complete binary metric', () => {
    const goal = makeGoal({ type: 'binary' });
    goal.completedAt = Date.UTC(2024, 0, 3);
    expect(goalProgress(goal).current).toBe(1);
  });

  it('reports an untouched binary metric as zero', () => {
    const goal = makeGoal({ type: 'binary' });
    expect(goalProgress(goal)).toEqual({ current: 0, target: 1, percent: 0, label: '0/1' });
  });

  it('derives a checklist target from the children length', () => {
    const goal = makeGoal({ type: 'checklist' });
    const children = [
      makeChild(goal, 'a', 'status'),
      makeChild(goal, 'b', 'completedAt'),
      makeChild(goal, 'c'),
    ];
    expect(goalProgress(goal, children)).toEqual({
      current: 2,
      target: 3,
      percent: 67,
      label: '2/3',
    });
  });

  it('appends the unit to a checklist label', () => {
    const goal = makeGoal({ type: 'checklist', unit: 'steps' });
    const children = [makeChild(goal, 'a', 'status'), makeChild(goal, 'b')];
    expect(goalProgress(goal, children).label).toBe('1/2 steps');
  });

  it('uses a target of 1 for a checklist goal with no children', () => {
    const goal = makeGoal({ type: 'checklist', current: 4, target: 9 });
    expect(goalProgress(goal)).toEqual({ current: 0, target: 1, percent: 0, label: '0/1' });
  });

  it('returns a zeroed result for a non-goal item', () => {
    const task = createItem({ kind: 'task', title: 'Task' });
    expect(goalProgress(task)).toEqual({ current: 0, target: 1, percent: 0, label: '0%' });
  });
});

describe('completionStats', () => {
  const item = createItem({ kind: 'task', title: 'Task' });

  it('returns a zero rate for an empty occurrence list', () => {
    expect(completionStats([])).toEqual({ total: 0, done: 0, rate: 0 });
  });

  it('rounds the rate to the nearest whole percent', () => {
    const twoOfThree = completionStats([
      occurrence(item, '2024-01-01', 'done'),
      occurrence(item, '2024-01-02', 'done'),
      occurrence(item, '2024-01-03', 'todo'),
    ]);
    expect(twoOfThree).toEqual({ total: 3, done: 2, rate: 67 });

    const oneOfSix = completionStats([
      occurrence(item, '2024-01-01', 'done'),
      ...['02', '03', '04', '05', '06'].map((d) => occurrence(item, `2024-01-${d}`, 'todo')),
    ]);
    expect(oneOfSix.rate).toBe(17);

    const fiveOfSix = completionStats([
      ...['01', '02', '03', '04', '05'].map((d) => occurrence(item, `2024-01-${d}`, 'done')),
      occurrence(item, '2024-01-06', 'todo'),
    ]);
    expect(fiveOfSix.rate).toBe(83);
  });

  it('counts only done occurrences', () => {
    const result = completionStats([
      occurrence(item, '2024-01-01', 'done'),
      occurrence(item, '2024-01-02', 'doing'),
      occurrence(item, '2024-01-03', 'cancelled'),
      occurrence(item, '2024-01-04', 'todo'),
    ]);
    expect(result).toEqual({ total: 4, done: 1, rate: 25 });
  });

  it('reports 100 when every occurrence is done', () => {
    const result = completionStats([
      occurrence(item, '2024-01-01', 'done'),
      occurrence(item, '2024-01-02', 'done'),
    ]);
    expect(result.rate).toBe(100);
  });
});

describe('itemCompletionStats', () => {
  it('counts a one-off item that falls inside the window', () => {
    const item = createItem({
      kind: 'task',
      title: 'One-off',
      start: '2024-03-06',
      status: 'done',
    });
    item.completedAt = Date.UTC(2024, 2, 6);
    const result = itemCompletionStats(item, new Date(2024, 2, 5), new Date(2024, 2, 10));
    expect(result).toEqual({ total: 1, done: 1, rate: 100 });
  });

  it('ignores a one-off item outside the window', () => {
    const item = createItem({ kind: 'task', title: 'One-off', start: '2024-01-01' });
    const result = itemCompletionStats(item, new Date(2024, 2, 5), new Date(2024, 2, 10));
    expect(result).toEqual({ total: 0, done: 0, rate: 0 });
  });

  it('counts occurrences inside the inclusive window bounds', () => {
    const item = dailyTask('2024-03-01');
    const result = itemCompletionStats(item, new Date(2024, 2, 5), new Date(2024, 2, 10));
    expect(result.total).toBe(6);
  });

  it('reports the done share of a recurring item inside the window', () => {
    const item = markDone(dailyTask('2024-03-01'), ['2024-03-05', '2024-03-06', '2024-03-07']);
    const result = itemCompletionStats(item, new Date(2024, 2, 5), new Date(2024, 2, 10));
    expect(result).toEqual({ total: 6, done: 3, rate: 50 });
  });

  it('drops window occurrences listed as recurrence exceptions', () => {
    const item = dailyTask('2024-03-01', { exceptions: ['2024-03-07'] });
    const result = itemCompletionStats(item, new Date(2024, 2, 5), new Date(2024, 2, 10));
    expect(result.total).toBe(5);
  });

  it('stops at the recurrence until bound', () => {
    const item = dailyTask('2024-03-01', { until: '2024-03-06' });
    const result = itemCompletionStats(item, new Date(2024, 2, 1), new Date(2024, 2, 31));
    expect(result.total).toBe(6);
  });

  it('honours a recurrence interval', () => {
    const item = dailyTask('2024-03-01', { interval: 3 });
    const result = itemCompletionStats(item, new Date(2024, 2, 1), new Date(2024, 2, 10));
    expect(result.total).toBe(4);
  });
});

describe('activeDayStreak', () => {
  const today = new Date(2024, 2, 10);

  it('counts consecutive done days ending today', () => {
    const item = markDone(dailyTask('2024-03-08'), ['2024-03-08', '2024-03-09', '2024-03-10']);
    expect(activeDayStreak([item], today)).toBe(3);
  });

  it('stops at a day with no completed occurrence', () => {
    const item = markDone(dailyTask('2024-03-01'), ['2024-03-09', '2024-03-10']);
    expect(activeDayStreak([item], today)).toBe(2);
  });

  it('returns zero when today has nothing completed', () => {
    const item = markDone(dailyTask('2024-03-01'), ['2024-03-09']);
    expect(activeDayStreak([item], today)).toBe(0);
  });

  it('counts a one-off item completed on the day', () => {
    const item = createItem({ kind: 'task', title: 'Done', start: '2024-03-10' });
    item.completedAt = new Date(2024, 2, 10, 9).getTime();
    expect(activeDayStreak([item], today)).toBe(1);
  });

  it('is zero for an empty item list', () => {
    expect(activeDayStreak([], today)).toBe(0);
  });
});

describe('overallCompletion', () => {
  it('pools occurrences across items in the window', () => {
    const daily = markDone(dailyTask('2024-03-01'), ['2024-03-01', '2024-03-02', '2024-03-03']);
    const oneOff = createItem({
      kind: 'task',
      title: 'One-off',
      start: '2024-03-04',
      status: 'done',
    });
    oneOff.completedAt = Date.UTC(2024, 2, 4);
    const result = overallCompletion([daily, oneOff], new Date(2024, 2, 1), new Date(2024, 2, 5));
    expect(result).toEqual({ total: 6, done: 4, rate: 67 });
  });

  it('is zero when no item has an occurrence in the window', () => {
    const item = createItem({ kind: 'task', title: 'Later', start: '2024-05-01' });
    expect(overallCompletion([item], new Date(2024, 2, 1), new Date(2024, 2, 5))).toEqual({
      total: 0,
      done: 0,
      rate: 0,
    });
  });
});

describe('missing data', () => {
  it('uses kind defaults for a habit stored without data', () => {
    const habit = withoutData(makeHabit('2024-01-01'));
    expect(habitStreak(habit, new Date(2024, 0, 31))).toEqual({
      current: 0,
      best: 0,
      lastAt: null,
    });
  });

  it('uses kind defaults for a goal stored without data', () => {
    const goal = withoutData(makeGoal({ type: 'numeric', current: 3, target: 8 }));
    expect(goalProgress(goal)).toEqual({ current: 0, target: 1, percent: 0, label: '0/1' });
  });

  it('falls back to a binary metric for a goal with an empty payload', () => {
    const goal = { ...makeGoal({ type: 'numeric' }), data: {} } as GoalItem;
    expect(goalProgress(goal)).toEqual({ current: 0, target: 1, percent: 0, label: '0/1' });
  });

  it('does not throw for any kind stored without data', () => {
    const items = ITEM_KINDS.map((kind) =>
      withoutData(createItem({ kind, title: kind, start: '2024-01-01' })),
    );
    expect(() =>
      overallCompletion(items, new Date(2024, 0, 1), new Date(2024, 0, 31)),
    ).not.toThrow();
    expect(() => activeDayStreak(items, new Date(2024, 0, 31))).not.toThrow();
  });

  it('tolerates a habit with a null or partial target', () => {
    const base = makeHabit('2024-01-01');
    const nullTarget = { ...base, data: { target: null } } as unknown as Item;
    const partialTarget = { ...base, data: { target: { count: 2 } } } as unknown as Item;

    expect(() => habitStreak(nullTarget, new Date(2024, 0, 31))).not.toThrow();
    expect(habitStreak(partialTarget, new Date(2024, 0, 31))).toEqual({
      current: 0,
      best: 0,
      lastAt: null,
    });
  });

  it('tolerates a goal with a null or partial metric', () => {
    const base = makeGoal({ type: 'numeric', current: 3, target: 8 });
    const nullMetric = { ...base, data: { metric: null } } as unknown as Item;
    const partialMetric = {
      ...base,
      data: { metric: { type: 'numeric', current: 4 } },
    } as unknown as Item;

    expect(goalProgress(nullMetric)).toEqual({ current: 0, target: 1, percent: 0, label: '0/1' });
    expect(goalProgress(partialMetric)).toEqual({
      current: 4,
      target: 1,
      percent: 100,
      label: '4/1',
    });
  });
});
