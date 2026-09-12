import { addDays, addMonths, formatISODate, parseLocalDate, startOfDay } from '@/lib/date';
import { newId } from '@/lib/id';
import { createItem } from './itemFactory';
import type { Item, ItemKind, Priority, RecurrenceRule } from '@/types';

export interface QuickAddChip {
  field: string;
  label: string;
  value?: string;
}

export interface QuickAddResult {
  raw: string;
  kind: ItemKind;
  title: string;
  tags: string[];
  start: string | null;
  allDay: boolean;
  time: string | null;
  dueAt: string | null;
  recurrence: RecurrenceRule | null;
  urgency: Priority;
  importance: Priority;
  amount?: number;
  currency?: string;
  quantity?: number;
  unit?: string;
  listName?: string;
  chips: QuickAddChip[];
}

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const WEEKDAY_PATTERN = 'sun|mon|tue|wed|thu|fri|sat';

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function nextWeekday(from: Date, weekday: number): Date {
  const d = startOfDay(from);
  const diff = (weekday - d.getDay() + 7) % 7 || 7;
  return addDays(d, diff);
}

function baseRule(freq: RecurrenceRule['freq'], interval = 1): RecurrenceRule {
  return { freq, interval, weekStartsOn: 1, exceptions: [], overrides: {} };
}

export function describeRecurrence(rule: RecurrenceRule | null): string | null {
  if (!rule) return null;
  const n = rule.interval > 1 ? `every ${rule.interval} ` : 'every ';
  switch (rule.freq) {
    case 'daily':
      return rule.interval > 1 ? `Every ${rule.interval} days` : 'Daily';
    case 'weekly': {
      if (rule.byWeekday?.length) {
        const names = rule.byWeekday
          .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
          .join(', ');
        return `${n}week on ${names}`;
      }
      return rule.interval > 1 ? `Every ${rule.interval} weeks` : 'Weekly';
    }
    case 'monthly': {
      if (rule.byMonthDay?.length) {
        const day = rule.byMonthDay[0];
        return `${n}month on the ${day === -1 ? 'last day' : day}`;
      }
      return rule.interval > 1 ? `Every ${rule.interval} months` : 'Monthly';
    }
    case 'yearly':
      return rule.interval > 1 ? `Every ${rule.interval} years` : 'Yearly';
  }
}

export function parseQuickAdd(input: string, now = new Date()): QuickAddResult {
  let working = ` ${input.trim()} `;
  const tags: string[] = [];
  let urgency: Priority = 'low';
  let importance: Priority = 'low';
  let explicitKind: ItemKind | null = null;
  let isBuy = false;
  let amount: number | undefined;
  let currency: string | undefined;
  let quantity: number | undefined;
  let unit: string | undefined;
  let listName: string | undefined;

  // Tags
  working = working.replace(/#([\w-]+)/g, (_m, tag: string) => {
    tags.push(tag.toLowerCase());
    return ' ';
  });

  // Flags
  if (/!(urgent|high)\b/i.test(working)) {
    urgency = 'high';
    working = working.replace(/!(urgent|high)\b/gi, ' ');
  }
  if (/!important\b/i.test(working)) {
    importance = 'high';
    working = working.replace(/!important\b/gi, ' ');
  }
  if (/!low\b/i.test(working)) {
    urgency = 'low';
    working = working.replace(/!low\b/gi, ' ');
  }

  // Quantities: 2L, 3 kg, 1 pack
  working = working.replace(
    /\b(\d+(?:\.\d+)?)\s*(l|ml|kg|g|lb|oz|pcs|pc|pack|dozen|bunch|can|bottle|box)\b/i,
    (_m, qty: string, u: string) => {
      quantity = Number(qty);
      unit = u.toLowerCase();
      return ' ';
    },
  );

  // Amounts
  working = working.replace(/\$\s?([\d,]+(?:\.\d{1,2})?)/, (_m, amt: string) => {
    amount = Number(amt.replace(/,/g, ''));
    currency = 'USD';
    return ' ';
  });
  if (amount === undefined) {
    working = working.replace(
      /\b([\d,]+(?:\.\d{1,2})?)\s*(usd|dollars?|eur|euros?|gbp|pounds?)\b/i,
      (_m, amt: string, cur: string) => {
        amount = Number(amt.replace(/,/g, ''));
        currency = /eur/i.test(cur) ? 'EUR' : /gbp|pound/i.test(cur) ? 'GBP' : 'USD';
        return ' ';
      },
    );
  }

  // Explicit kind prefix
  const kindPrefix = /^\s*(task|event|habit|goal|bill|shopping|note)\s*:\s*/i.exec(working);
  if (kindPrefix) {
    explicitKind = kindPrefix[1].toLowerCase() as ItemKind;
    working = working.replace(kindPrefix[0], ' ');
  } else if (/^\s*buy\s+/i.test(working)) {
    isBuy = true;
    working = working.replace(/^\s*buy\s+/i, ' ');
  }

  // Recurrence
  let recurrence: RecurrenceRule | null = null;
  const intervalMatch = /\bevery\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)\b/i.exec(
    working,
  );
  if (intervalMatch) {
    const n = Math.max(1, Number(intervalMatch[1]));
    const unitWord = intervalMatch[2].toLowerCase();
    const freq = unitWord.startsWith('day')
      ? 'daily'
      : unitWord.startsWith('week')
        ? 'weekly'
        : unitWord.startsWith('month')
          ? 'monthly'
          : 'yearly';
    recurrence = baseRule(freq, n);
    working = working.replace(intervalMatch[0], ' ');
  } else if (/\bevery\s+day\b|\bdaily\b/i.test(working)) {
    recurrence = baseRule('daily');
    working = working.replace(/\bevery\s+day\b|\bdaily\b/gi, ' ');
  } else if (/\bevery\s+week\b|\bweekly\b/i.test(working)) {
    recurrence = baseRule('weekly');
    working = working.replace(/\bevery\s+week\b|\bweekly\b/gi, ' ');
  } else if (/\bevery\s+month\b|\bmonthly\b/i.test(working)) {
    recurrence = baseRule('monthly');
    working = working.replace(/\bevery\s+month\b|\bmonthly\b/gi, ' ');
  } else if (/\bevery\s+year\b|\byearly\b|\bannually\b/i.test(working)) {
    recurrence = baseRule('yearly');
    working = working.replace(/\bevery\s+year\b|\byearly\b|\bannually\b/gi, ' ');
  }

  // Weekday lists: mon/wed/fri, mon, wed and fri
  const weekdayListRe = new RegExp(
    `\\b((?:${WEEKDAY_PATTERN})(?:\\s*(?:\\/|,|and)\\s*(?:${WEEKDAY_PATTERN}))*)\\b`,
    'i',
  );
  const weekdayListMatch = weekdayListRe.exec(working);
  let weekdays: number[] = [];
  if (weekdayListMatch) {
    const parts = weekdayListMatch[1].toLowerCase().split(/\s*(?:\/|,|and)\s*/);
    weekdays = parts
      .map((p) => WEEKDAYS[p.slice(0, 3)])
      .filter((d): d is number => d !== undefined);
    if (weekdays.length > 1 || /every/i.test(input)) {
      working = working.replace(weekdayListMatch[0], ' ');
    } else {
      weekdays = [];
    }
  }
  if (weekdays.length) {
    recurrence = recurrence ?? baseRule('weekly');
    recurrence.byWeekday = [...new Set(weekdays)].sort((a, b) => a - b);
  }

  // Month day: "on the 5th"
  const monthDayMatch = /\bon the (\d{1,2})(?:st|nd|rd|th)?\b/i.exec(working);
  if (monthDayMatch) {
    const day = Number(monthDayMatch[1]);
    if (recurrence?.freq === 'monthly') recurrence.byMonthDay = [day];
    working = working.replace(monthDayMatch[0], ' ');
  }

  // Time
  let time: string | null = null;
  const ampm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(working);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === 'pm') hour += 12;
    time = `${String(hour).padStart(2, '0')}:${ampm[2] ?? '00'}`;
    working = working.replace(ampm[0], ' ');
  } else {
    const hhmm = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(working);
    if (hhmm) {
      time = `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;
      working = working.replace(hhmm[0], ' ');
    }
  }

  // Dates
  let dateKey: string | null = null;
  let monthOffset = 0;
  let dayOffset = 0;

  if (/\btoday\b/i.test(working)) {
    working = working.replace(/\btoday\b/gi, ' ');
  } else if (/\btomorrow\b|\btmr\b/i.test(working)) {
    dayOffset = 1;
    working = working.replace(/\btomorrow\b|\btmr\b/gi, ' ');
  } else if (/\btonight\b/i.test(working)) {
    if (!time) time = '20:00';
    working = working.replace(/\btonight\b/gi, ' ');
  } else if (/\bnext week\b/i.test(working)) {
    dayOffset = 7;
    working = working.replace(/\bnext week\b/gi, ' ');
  } else if (/\bnext month\b/i.test(working)) {
    monthOffset = 1;
    working = working.replace(/\bnext month\b/gi, ' ');
  } else {
    const inMatch = /\bin (\d+)\s+(day|days|week|weeks|month|months)\b/i.exec(working);
    if (inMatch) {
      const n = Number(inMatch[1]);
      const u = inMatch[2].toLowerCase();
      if (u.startsWith('day')) dayOffset = n;
      else if (u.startsWith('week')) dayOffset = n * 7;
      else monthOffset = n;
      working = working.replace(inMatch[0], ' ');
    }
  }

  const isoMatch = /\b(\d{4}-\d{2}-\d{2})\b/.exec(working);
  if (isoMatch) {
    dateKey = isoMatch[1];
    working = working.replace(isoMatch[0], ' ');
  }

  if (!dateKey) {
    const nextWeekdayMatch = new RegExp(`\\bnext\\s+(${WEEKDAY_PATTERN})\\b`, 'i').exec(working);
    if (nextWeekdayMatch) {
      const target = nextWeekday(now, WEEKDAYS[nextWeekdayMatch[1].toLowerCase()]);
      dateKey = formatISODate(target);
      working = working.replace(nextWeekdayMatch[0], ' ');
    }
  }

  if (!dateKey) {
    let base = now;
    if (monthOffset) base = addMonths(base, monthOffset);
    if (dayOffset) base = addDays(base, dayOffset);
    dateKey = formatISODate(base);
  }

  // List alias: #groceries becomes a tag; derive a list name for shopping.
  if (tags.includes('groceries') || isBuy) listName = 'Groceries';

  // Kind inference
  let kind: ItemKind = explicitKind ?? 'task';
  if (!explicitKind) {
    if (isBuy || tags.includes('groceries') || tags.includes('shopping')) kind = 'shopping';
    else if (
      amount !== undefined &&
      /pay|bill|due|invoice|rent|electricity|water|internet|subscription|phone|insurance/i.test(
        input,
      )
    )
      kind = 'bill';
  }

  const titleRaw = collapse(working)
    .replace(/^[\s\-–—/]+/, '')
    .trim();
  const title = titleRaw ? titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1) : '';

  const allDay = !time;
  const start = allDay ? dateKey : `${dateKey}T${time}`;

  const chips: QuickAddChip[] = [{ field: 'kind', label: kind }];
  chips.push({ field: 'date', label: dateKey });
  if (time) chips.push({ field: 'time', label: time });
  const recurrenceLabel = describeRecurrence(recurrence);
  if (recurrenceLabel) chips.push({ field: 'recurrence', label: recurrenceLabel });
  if (amount !== undefined)
    chips.push({ field: 'amount', label: `${currency ?? 'USD'} ${amount}` });
  if (quantity !== undefined)
    chips.push({ field: 'quantity', label: `${quantity}${unit ? ` ${unit}` : ''}` });
  if (urgency === 'high') chips.push({ field: 'urgency', label: 'Urgent' });
  if (importance === 'high') chips.push({ field: 'importance', label: 'Important' });
  for (const tag of tags) chips.push({ field: 'tag', label: `#${tag}` });

  return {
    raw: input,
    kind,
    title,
    tags,
    start,
    allDay,
    time,
    dueAt: start,
    recurrence,
    urgency,
    importance,
    amount,
    currency,
    quantity,
    unit,
    listName,
    chips,
  };
}

/** Convert a parsed quick-add into a fully-formed Item. */
export function quickAddToItem(parsed: QuickAddResult): Item {
  const data: Record<string, unknown> = {};
  if (parsed.kind === 'bill') {
    data.amount = parsed.amount ?? 0;
    data.currency = parsed.currency ?? 'USD';
    data.payee = parsed.title;
    data.autopay = false;
    data.payments = {};
  }
  if (parsed.kind === 'shopping') {
    data.quantity = parsed.quantity ?? 1;
    data.unit = parsed.unit;
    data.purchased = false;
  }
  if (parsed.kind === 'habit') {
    data.target = { count: 1, per: 'day' };
    data.streak = { current: 0, best: 0, lastAt: null };
  }
  if (parsed.kind === 'goal') {
    data.metric = { type: 'binary' };
    data.horizon = 'month';
  }
  if (parsed.kind === 'note') {
    data.pinned = false;
  }

  const item = createItem({
    kind: parsed.kind,
    title: parsed.title || 'Untitled',
    start: parsed.start,
    allDay: parsed.allDay,
    dueAt: parsed.dueAt,
    tags: parsed.tags,
    urgency: parsed.urgency,
    importance: parsed.importance,
    data: data as never,
  });
  item.recurrence = parsed.recurrence;
  item.updatedAt = Date.now();
  return item;
}

/** Stable id helper so quick-add chips can be keyed in the UI. */
export function chipId(chip: QuickAddChip, index: number): string {
  return `${chip.field}-${index}-${newId().slice(0, 4)}`;
}

export function isValidParsedDate(value: string | null): boolean {
  return !!value && !!parseLocalDate(value);
}
