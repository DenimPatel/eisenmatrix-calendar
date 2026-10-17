# impl-IMP-032 — sum recorded bill payments for the "Paid" total

## Files changed
- `src/domain/bills.ts` (new) — pure `sumRecordedPayments(occurrences)`.
- `src/domain/bills.test.ts` (new) — two tests.
- `src/features/bills/BillsView.tsx` — `monthlyPaid` now uses the helper.

## Approach
- `sumRecordedPayments` walks the visible-month occurrences and adds
  `item.data.payments?.[occKey]?.amount` for bill items, defaulting to 0 when no payment is
  recorded. It never reads `data.amount`.
- The "This month" and "Remaining" totals are unchanged; Remaining still subtracts the
  recorded Paid total.
- `markBillPaid` is untouched, so new payments still snapshot the current bill amount.
- Unit tests cover two payments of different amounts (42.5 + 65 = 107.5) alongside a
  no-payment bill, and assert that editing the current amount (1000 → 1200) leaves the
  recorded 750 contribution unchanged.

## Verification
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (38 files, 404 tests; baseline 402, +2)
- `npm run build` — PASS (PWA precache 18 entries)
- Browser (preview, Playwright): existing Rent bill paid at USD 100, monthly Paid = 100.
  Edited Rent amount to 150 and saved → "This month" 142 → 192, Paid stayed 100,
  Remaining 42 → 92. Restored Rent to 100 afterwards. No console errors.
