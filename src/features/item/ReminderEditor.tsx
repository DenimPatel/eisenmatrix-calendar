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

      {value.map((reminder) => (
        <div key={reminder.id} className="flex items-center gap-2">
          {allDay ? (
            <Field className="flex-1">
              <input
                type="time"
                className="input"
                value={reminder.timeOfDay ?? '09:00'}
                onChange={(e) =>
                  update(reminder.id, { timeOfDay: e.target.value, offsetMinutes: undefined })
                }
              />
            </Field>
          ) : (
            <Field className="flex-1">
              <Select
                value={String(reminder.offsetMinutes ?? -10)}
                onChange={(e) => update(reminder.id, { offsetMinutes: Number(e.target.value) })}
                options={OFFSET_PRESETS}
              />
            </Field>
          )}
          <span className="hidden text-xs text-muted sm:block">
            {formatReminderLabel(reminder)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove(reminder.id)}
            aria-label="Remove reminder"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}
