import { Bell, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Form';
import { newId } from '@/lib/id';
import { formatReminderLabel } from '@/domain/reminders';
import type { Reminder } from '@/types';

const OFFSET_PRESETS = [
  { value: '0', label: 'At start' },
  { value: '-5', label: '5 min before' },
  { value: '-10', label: '10 min before' },
  { value: '-30', label: '30 min before' },
  { value: '-60', label: '1 hour before' },
  { value: '-180', label: '3 hours before' },
  { value: '-1440', label: '1 day before' },
];

/**
 * The preset list plus the row's own offset when it is not one of them (a cross-day offset
 * kept by `reconcileReminderMode`). Without the extra option the select would silently display
 * the first preset while the label showed the real offset.
 */
function offsetOptions(reminder: Reminder) {
  const offset = reminder.offsetMinutes ?? -10;
  const values = new Set(OFFSET_PRESETS.map((option) => Number(option.value)));
  values.add(offset);
  return [...values]
    .sort((a, b) => a - b)
    .map((value) => ({
      value: String(value),
      label:
        OFFSET_PRESETS.find((option) => Number(option.value) === value)?.label ??
        formatReminderLabel({ id: reminder.id, offsetMinutes: value }),
    }));
}

export interface ReminderEditorProps {
  value: Reminder[];
  allDay: boolean;
  onChange: (reminders: Reminder[]) => void;
}

export function ReminderEditor({ value, allDay, onChange }: ReminderEditorProps) {
  const add = () => {
    const reminder: Reminder = allDay
      ? { id: newId(), timeOfDay: '09:00' }
      : { id: newId(), offsetMinutes: -10 };
    onChange([...value, reminder]);
  };

  const update = (id: string, patch: Partial<Reminder>) => {
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => onChange(value.filter((r) => r.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Bell size={12} /> Reminders
        </span>
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus size={14} /> Add
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted">No reminders. In-app banners always work offline.</p>
      )}

      {value.map((reminder) => {
        const label = formatReminderLabel(reminder);
        // The control follows the reminder's own stored shape, never the current `allDay`, so
        // the rendered value and `formatReminderLabel` can never describe different instants.
        const editable = !!reminder.timeOfDay || typeof reminder.offsetMinutes === 'number';
        return (
          <div key={reminder.id} className="flex items-center gap-2">
            {reminder.timeOfDay ? (
              <Field className="flex-1">
                <input
                  type="time"
                  className="input"
                  aria-label="Reminder time"
                  value={reminder.timeOfDay}
                  onChange={(e) =>
                    update(reminder.id, { timeOfDay: e.target.value, offsetMinutes: undefined })
                  }
                />
              </Field>
            ) : typeof reminder.offsetMinutes === 'number' ? (
              <Field className="flex-1">
                <Select
                  aria-label="Reminder offset"
                  value={String(reminder.offsetMinutes)}
                  onChange={(e) => update(reminder.id, { offsetMinutes: Number(e.target.value) })}
                  options={offsetOptions(reminder)}
                />
              </Field>
            ) : (
              <Field className="flex-1">
                <input
                  type="text"
                  readOnly
                  className="input"
                  aria-label="Reminder time"
                  value={label}
                />
              </Field>
            )}
            {editable && <span className="hidden text-xs text-muted sm:block">{label}</span>}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(reminder.id)}
              aria-label="Remove reminder"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
