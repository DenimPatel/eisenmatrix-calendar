export interface ShortcutRow {
  keys: string;
  label: string;
}

export const SHORTCUTS: ShortcutRow[] = [
  { keys: '⌘/Ctrl + K', label: 'Open command palette' },
  { keys: 'C', label: 'Quick add' },
  { keys: 'N', label: 'New task' },
  { keys: '/', label: 'Search everything' },
  { keys: '1 – 9', label: 'Jump to a view' },
  { keys: '⌘/Ctrl + Z', label: 'Undo last action' },
  { keys: '?', label: 'Show this sheet' },
  { keys: 'Esc', label: 'Close panels' },
];

/**
 * Documented quick-add examples. `expected` is asserted against the real parser
 * (`parseQuickAdd`) by `helpContent.test.ts`, so every example here is guaranteed
 * to parse exactly as described. Keep assertions to fields the parser sets.
 */
export interface QuickAddExample {
  input: string;
  summary: string;
  /** Fixed "now" for date-relative examples so the documented date is deterministic. */
  now?: string;
  expected: Record<string, unknown>;
}

export const QUICK_ADD_EXAMPLES: QuickAddExample[] = [
  {
    input: 'pay electricity $120 every month on the 5th !urgent',
    summary: 'Bill, $120, monthly on the 5th, marked urgent',
    expected: {
      kind: 'bill',
      title: 'Pay electricity',
      amount: 120,
      currency: 'USD',
      urgency: 'high',
      recurrence: { freq: 'monthly', byMonthDay: [5] },
    },
  },
  {
    input: 'buy milk 2L #groceries',
    summary: 'Shopping item, 2 litres, filed under Groceries',
    expected: {
      kind: 'shopping',
      title: 'Milk',
      quantity: 2,
      unit: 'l',
      tags: ['groceries'],
      listName: 'Groceries',
    },
  },
  {
    input: 'gym mon/wed/fri 7am',
    summary: 'Weekly on Mon, Wed and Fri at 07:00',
    expected: {
      title: 'Gym',
      time: '07:00',
      allDay: false,
      recurrence: { freq: 'weekly', byWeekday: [1, 3, 5] },
    },
  },
  {
    input: 'standup tue and thu',
    summary: 'Weekly on Tuesday and Thursday',
    now: '2024-06-10T12:00:00',
    expected: {
      title: 'Standup',
      recurrence: { freq: 'weekly', byWeekday: [2, 4] },
    },
  },
  {
    input: 'call mom tomorrow',
    summary: 'Task due tomorrow (all day)',
    now: '2024-06-10T12:00:00',
    expected: { kind: 'task', title: 'Call mom', start: '2024-06-11', allDay: true },
  },
  {
    input: 'submit report on the 5th',
    summary: 'Task on the next 5th of the month',
    now: '2024-06-10T12:00:00',
    expected: { kind: 'task', title: 'Submit report', start: '2024-07-05', allDay: true },
  },
  {
    input: 'meeting 2024-03-04 2:30pm',
    summary: 'Task with an explicit date and 14:30 time',
    expected: { kind: 'task', title: 'Meeting', start: '2024-03-04T14:30', allDay: false },
  },
  {
    input: 'habit: meditate every 3 days',
    summary: 'Habit recurring every 3 days',
    expected: {
      kind: 'habit',
      title: 'Meditate',
      recurrence: { freq: 'daily', interval: 3 },
    },
  },
  {
    input: 'plan trip !important #travel',
    summary: 'Task tagged #travel and flagged important',
    expected: { kind: 'task', title: 'Plan trip', importance: 'high', tags: ['travel'] },
  },
];

export interface SyntaxRow {
  syntax: string;
  label: string;
}

/** Token reference derived from the parser in `src/domain/quickadd.ts`. */
export const QUICK_ADD_SYNTAX: SyntaxRow[] = [
  { syntax: 'task: event: habit: goal: bill: shopping: note:', label: 'Force the item kind' },
  { syntax: 'buy milk', label: '“buy …” becomes a shopping item' },
  { syntax: '#groceries', label: 'Add a tag' },
  { syntax: '!urgent  !high  !important  !low', label: 'Set urgency / importance' },
  { syntax: '$120  ·  120 usd  ·  50 eur  ·  40 gbp', label: 'Amount and currency' },
  { syntax: '2L  ·  3 kg  ·  1 pack  ·  1 can', label: 'Quantity and unit' },
  {
    syntax: 'every day  ·  every 3 weeks  ·  monthly  ·  annually',
    label: 'Recurrence interval',
  },
  { syntax: 'mon/wed/fri  ·  tue and thu', label: 'Repeat on specific weekdays' },
  { syntax: 'every month on the 5th', label: 'Monthly on a day of the month' },
  {
    syntax:
      'today  ·  tomorrow  ·  tonight  ·  next week  ·  in 3 days  ·  next fri  ·  2024-03-04',
    label: 'Date',
  },
  { syntax: '7am  ·  2:30pm  ·  14:30', label: 'Time of day' },
];

export interface ExportFormatRow {
  name: string;
  detail: string;
}

export const EXPORT_FORMATS: ExportFormatRow[] = [
  {
    name: 'JSON',
    detail: 'Canonical backup: every item and list. Restore it to replace or merge your data.',
  },
  {
    name: 'CSV',
    detail: 'Spreadsheet-friendly items table. Re-importable to bring rows back into the app.',
  },
  {
    name: 'ICS',
    detail: 'Calendar feed for Apple/Google Calendar. Export only — use JSON to restore.',
  },
];
