import { useMemo } from 'react';
import { CheckCircle2, Plus, Receipt } from 'lucide-react';
import { useItems } from '@/hooks/useData';
import { useOccurrences } from '@/hooks/useOccurrences';
import { useUiStore } from '@/store/useUiStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createItem } from '@/domain/itemFactory';
import { patchItem } from '@/domain/itemActions';
import {
  addDays,
  endOfDay,
  endOfMonthDate,
  formatISODate,
  startOfDay,
  startOfMonth,
} from '@/lib/date';
import { cn } from '@/lib/cn';
import type { BillItem, Item } from '@/types';

async function markBillPaid(item: Item, occKey: string) {
  if (item.kind !== 'bill') return;
  const payments = { ...item.data.payments };
  if (payments[occKey]) delete payments[occKey];
  else payments[occKey] = { paidAt: Date.now(), amount: item.data.amount };
  await patchItem(
    item.id,
    { data: { ...item.data, payments } },
    { silent: true, trackHistory: false },
  );
}

export function BillsView() {
  const items = useItems();
  const openEditor = useUiStore((s) => s.openEditor);
  const bills = useMemo(
    () => items.filter((i): i is BillItem => i.kind === 'bill' && !i.archivedAt),
    [items],
  );

  const now = new Date();
  const upcoming = useOccurrences(bills, startOfDay(now), addDays(endOfDay(now), 60));

  const monthOccurrences = useOccurrences(bills, startOfMonth(now), endOfMonthDate(now));
  const monthlyTotal = monthOccurrences.reduce(
    (sum, occ) => sum + (occ.item as BillItem).data.amount,
    0,
  );
  const monthlyPaid = monthOccurrences
    .filter((occ) => (occ.item as BillItem).data.payments?.[occ.occKey])
    .reduce((sum, occ) => sum + (occ.item as BillItem).data.amount, 0);

  const markPaid = (item: Item, occKey: string) => markBillPaid(item, occKey);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Bills</h1>
          <p className="text-sm text-muted">Track what's due and what's already paid.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => openEditor(createItem({ kind: 'bill', start: formatISODate(now) }))}
        >
          <Plus size={14} /> New bill
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-muted">This month</div>
          <div className="text-2xl font-bold text-fg">
            {monthlyTotal.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Paid</div>
          <div className="text-2xl font-bold text-emerald-500">
            {monthlyPaid.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">Remaining</div>
          <div className="text-2xl font-bold text-rose-500">
            {(monthlyTotal - monthlyPaid).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {bills.length === 0 ? (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No bills yet"
          description="Add a recurring bill and mark each occurrence paid as it comes due."
        />
      ) : (
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">Upcoming (60 days)</h2>
            <div className="space-y-2">
              {upcoming.map((occ) => {
                const bill = occ.item as BillItem;
                const paid = !!bill.data.payments?.[occ.occKey];
                return (
                  <div
                    key={`${bill.id}-${occ.occKey}`}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => void markPaid(bill, occ.occKey)}
                      aria-label={paid ? 'Mark unpaid' : 'Mark paid'}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
                        paid
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-border text-muted hover:border-accent',
                      )}
                    >
                      {paid && <CheckCircle2 size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(bill, occ.occKey)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div
                        className={cn(
                          'truncate text-sm font-medium text-fg',
                          paid && 'text-muted line-through',
                        )}
                      >
                        {bill.title || bill.data.payee || 'Bill'}
                      </div>
                      <div className="text-xs text-muted">
                        {occ.occKey}
                        {bill.data.autopay ? ' · autopay' : ''}
                        {bill.data.account ? ` · ${bill.data.account}` : ''}
                      </div>
                    </button>
                    <span className="text-sm font-semibold text-fg">
                      {bill.data.currency} {bill.data.amount}
                    </span>
                  </div>
                );
              })}
              {upcoming.length === 0 && (
                <p className="text-sm text-muted">Nothing due in the next 60 days.</p>
              )}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">All bills</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {bills.map((bill) => (
                <button
                  key={bill.id}
                  type="button"
                  onClick={() => openEditor(bill)}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-elevated"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg">
                      {bill.title || bill.data.payee || 'Bill'}
                    </div>
                    <div className="text-xs text-muted">
                      {bill.data.payee}
                      {bill.recurrence ? ' · recurring' : ''}
                    </div>
                  </div>
                  <Badge tone="muted">
                    {bill.data.currency} {bill.data.amount}
                  </Badge>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
