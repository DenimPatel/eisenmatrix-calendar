import { Checkbox, Field, Select } from '@/components/ui/Form';
import { HORIZON_LABELS } from '@/lib/labels';
import type { Item } from '@/types';

export interface KindFieldsProps {
  item: Item;
  onData: (patch: Record<string, unknown>) => void;
}

export function KindFields({ item, onData }: KindFieldsProps) {
  switch (item.kind) {
    case 'task':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Estimate (minutes)">
            <input
              type="number"
              min={0}
              className="input"
              value={item.data.estimateMinutes ?? ''}
              onChange={(e) =>
                onData({ estimateMinutes: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
          <Field label="Energy">
            <Select
              value={item.data.energy ?? ''}
              onChange={(e) => onData({ energy: e.target.value || undefined })}
              options={[
                { value: '', label: 'Any' },
                { value: 'low', label: 'Low' },
                { value: 'med', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
          </Field>
        </div>
      );

    case 'event':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Location">
            <input
              className="input"
              value={item.data.location ?? ''}
              onChange={(e) => onData({ location: e.target.value })}
              placeholder="Where?"
            />
          </Field>
          <Field label="Travel time (minutes)">
            <input
              type="number"
              min={0}
              className="input"
              value={item.data.travelMinutes ?? ''}
              onChange={(e) =>
                onData({ travelMinutes: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
          <Field label="Attendees" className="sm:col-span-2">
            <input
              className="input"
              value={(item.data.attendees ?? []).join(', ')}
              onChange={(e) =>
                onData({
                  attendees: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Comma separated"
            />
          </Field>
        </div>
      );

    case 'habit':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Target count">
            <input
              type="number"
              min={1}
              className="input"
              value={item.data.target.count}
              onChange={(e) =>
                onData({
                  target: { ...item.data.target, count: Math.max(1, Number(e.target.value) || 1) },
                })
              }
            />
          </Field>
          <Field label="Per">
            <Select
              value={item.data.target.per}
              onChange={(e) => onData({ target: { ...item.data.target, per: e.target.value } })}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </Field>
          <Field label="Unit">
            <input
              className="input"
              value={item.data.unit ?? ''}
              onChange={(e) => onData({ unit: e.target.value || undefined })}
              placeholder="e.g. glasses"
            />
          </Field>
        </div>
      );

    case 'goal':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Metric">
            <Select
              value={item.data.metric.type}
              onChange={(e) => onData({ metric: { ...item.data.metric, type: e.target.value } })}
              options={[
                { value: 'binary', label: 'Done / not done' },
                { value: 'numeric', label: 'Numeric' },
                { value: 'checklist', label: 'Milestones' },
              ]}
            />
          </Field>
          <Field label="Horizon">
            <Select
              value={item.data.horizon}
              onChange={(e) => onData({ horizon: e.target.value })}
              options={Object.entries(HORIZON_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Field>
          {item.data.metric.type === 'numeric' && (
            <>
              <Field label="Current">
                <input
                  type="number"
                  className="input"
                  value={item.data.metric.current ?? 0}
                  onChange={(e) =>
                    onData({
                      metric: { ...item.data.metric, current: Number(e.target.value) || 0 },
                    })
                  }
                />
              </Field>
              <Field label="Target">
                <input
                  type="number"
                  className="input"
                  value={item.data.metric.target ?? 0}
                  onChange={(e) =>
                    onData({ metric: { ...item.data.metric, target: Number(e.target.value) || 0 } })
                  }
                />
              </Field>
              <Field label="Unit">
                <input
                  className="input"
                  value={item.data.metric.unit ?? ''}
                  onChange={(e) =>
                    onData({ metric: { ...item.data.metric, unit: e.target.value } })
                  }
                />
              </Field>
            </>
          )}
          <Field label="Why (motivation)" className="sm:col-span-2">
            <textarea
              className="input min-h-[72px]"
              value={item.data.why ?? ''}
              onChange={(e) => onData({ why: e.target.value })}
            />
          </Field>
        </div>
      );

    case 'bill':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount">
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={item.data.amount}
              onChange={(e) => onData({ amount: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Currency">
            <Select
              value={item.data.currency}
              onChange={(e) => onData({ currency: e.target.value })}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'EUR', label: 'EUR' },
                { value: 'GBP', label: 'GBP' },
                { value: 'CAD', label: 'CAD' },
                { value: 'AUD', label: 'AUD' },
                { value: 'INR', label: 'INR' },
              ]}
            />
          </Field>
          <Field label="Payee">
            <input
              className="input"
              value={item.data.payee}
              onChange={(e) => onData({ payee: e.target.value })}
            />
          </Field>
          <Field label="Account">
            <input
              className="input"
              value={item.data.account ?? ''}
              onChange={(e) => onData({ account: e.target.value || undefined })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-fg">
            <Checkbox
              checked={item.data.autopay}
              onChange={(e) => onData({ autopay: e.target.checked })}
            />
            Autopay enabled
          </label>
        </div>
      );

    case 'shopping':
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Quantity">
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={item.data.quantity}
              onChange={(e) => onData({ quantity: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Unit">
            <input
              className="input"
              value={item.data.unit ?? ''}
              onChange={(e) => onData({ unit: e.target.value || undefined })}
            />
          </Field>
          <Field label="Aisle">
            <input
              className="input"
              value={item.data.aisle ?? ''}
              onChange={(e) => onData({ aisle: e.target.value || undefined })}
            />
          </Field>
          <Field label="Estimated price">
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={item.data.estPrice ?? ''}
              onChange={(e) =>
                onData({ estPrice: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-fg">
            <Checkbox
              checked={item.data.purchased}
              onChange={(e) => onData({ purchased: e.target.checked })}
            />
            Purchased
          </label>
        </div>
      );

    case 'note':
      return (
        <label className="flex items-center gap-2 text-sm text-fg">
          <Checkbox
            checked={item.data.pinned}
            onChange={(e) => onData({ pinned: e.target.checked })}
          />
          Pin this note
        </label>
      );
  }
}
