import { Button } from '@/components/ui/Button';
import { Field, Select, Toggle } from '@/components/ui/Form';
import { FREQUENCY_LABELS, WEEKDAY_SHORT } from '@/lib/labels';
import { cn } from '@/lib/cn';
import { parseLocalDate } from '@/lib/date';
import type { Frequency, RecurrenceRule } from '@/types';

export interface RecurrenceEditorProps {
  value: RecurrenceRule | null;
  start: string | null;
  weekStartsOn: 0 | 1;
  onChange: (rule: RecurrenceRule | null) => void;
}

function baseRule(freq: Frequency, weekStartsOn: 0 | 1): RecurrenceRule {
  return { freq, interval: 1, weekStartsOn, exceptions: [], overrides: {} };
}

export function RecurrenceEditor({ value, start, weekStartsOn, onChange }: RecurrenceEditorProps) {
  const startDate = parseLocalDate(start) ?? new Date();
  const enabled = !!value;

  const update = (patch: Partial<RecurrenceRule>) => {
    if (!value) return;
    onChange({ ...value, ...patch });
  };

  const enable = () => onChange(baseRule('daily', weekStartsOn));

  const toggleWeekday = (day: number) => {
    if (!value) return;
    const current = new Set(value.byWeekday ?? [startDate.getDay()]);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    update({ byWeekday: [...current].sort((a, b) => a - b) });
  };

  const endMode = value?.until ? 'until' : value?.count ? 'count' : 'never';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-fg">Repeats</span>
        <Toggle
          checked={enabled}
          label="Repeat"
          onChange={(on) => (on ? enable() : onChange(null))}
        />
      </div>

      {value && (
        <div className="space-y-3 rounded-lg border border-border bg-elevated p-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Every" className="w-20">
              <input
                type="number"
                min={1}
                className="input"
                value={value.interval}
                onChange={(e) => update({ interval: Math.max(1, Number(e.target.value) || 1) })}
              />
            </Field>
            <Field label="Frequency" className="flex-1">
              <Select
                value={value.freq}
                onChange={(e) => update({ freq: e.target.value as Frequency })}
                options={Object.entries(FREQUENCY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
            </Field>
          </div>

          {value.freq === 'weekly' && (
            <Field label="On days">
              <div className="flex gap-1">
                {WEEKDAY_SHORT.map((label, day) => {
                  const active = (value.byWeekday ?? [startDate.getDay()]).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        'h-8 w-8 rounded-full text-xs font-semibold transition-colors',
                        active
                          ? 'bg-accent text-accent-fg'
                          : 'bg-surface text-muted hover:bg-border',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {value.freq === 'monthly' && (
            <div className="flex items-end gap-3">
              <Field label="On day" className="w-24">
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="input"
                  disabled={value.byMonthDay?.[0] === -1}
                  value={
                    value.byMonthDay?.[0] === -1
                      ? ''
                      : (value.byMonthDay?.[0] ?? startDate.getDate())
                  }
                  onChange={(e) => update({ byMonthDay: [Number(e.target.value) || 1] })}
                />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={value.byMonthDay?.[0] === -1}
                  onChange={(e) =>
                    update({ byMonthDay: [e.target.checked ? -1 : startDate.getDate()] })
                  }
                />
                Last day of month
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Ends" className="flex-1">
              <Select
                value={endMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  if (mode === 'never') update({ until: null, count: undefined });
                  if (mode === 'until') update({ until: start ?? null, count: undefined });
                  if (mode === 'count') update({ count: 10, until: null });
                }}
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'until', label: 'On date' },
                  { value: 'count', label: 'After N times' },
                ]}
              />
            </Field>
            {endMode === 'until' && (
              <Field label="Until" className="flex-1">
                <input
                  type="date"
                  className="input"
                  value={value.until ?? ''}
                  onChange={(e) => update({ until: e.target.value || null })}
                />
              </Field>
            )}
            {endMode === 'count' && (
              <Field label="Occurrences" className="w-28">
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={value.count ?? 10}
                  onChange={(e) => update({ count: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
            )}
          </div>

          {value.exceptions.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{value.exceptions.length} skipped occurrence(s)</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update({ exceptions: [], overrides: {} })}
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
