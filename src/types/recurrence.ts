export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type OccurrenceStatus = 'todo' | 'doing' | 'done' | 'cancelled';

/** A single edited/moved occurrence within a recurring series. */
export interface OccurrenceOverride {
  /** Overridden local start, `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
  start?: string;
  end?: string | null;
  allDay?: boolean;
  title?: string;
  notes?: string;
  status?: OccurrenceStatus;
}

/**
 * A pragmatic RRULE subset. All fields are optional except `freq` and `interval`
 * so rules stay serialisable and stable between versions.
 */
export interface RecurrenceRule {
  freq: Frequency;
  interval: number;
  /** 0 (Sunday) – 6 (Saturday). Only meaningful for `weekly`. */
  byWeekday?: number[];
  /** 1–31, or -1 for "last day of month". Only meaningful for `monthly`. */
  byMonthDay?: number[];
  /** 1–12. Only meaningful for `yearly`. */
  byMonth?: number[];
  /** Total number of occurrences in the series (inclusive). */
  count?: number;
  /** Inclusive local date/datetime after which the series stops. */
  until?: string | null;
  weekStartsOn: 0 | 1;
  /** occKeys that are skipped entirely. */
  exceptions: string[];
  /** occKey -> overrides for a single occurrence. */
  overrides: Record<string, OccurrenceOverride>;
}

export interface OccurrenceState {
  status: OccurrenceStatus;
  completedAt: number | null;
  notes?: string;
}
