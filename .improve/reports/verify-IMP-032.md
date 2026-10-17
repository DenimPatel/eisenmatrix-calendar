# verify-IMP-032 — Sum recorded bill payments for the "Paid" total

**Verdict: PASS**

**Reviewer:** independent verifier (did not write the change)
**Branch:** `improve/auto-20261017` (IMP-032 is uncommitted on top of `8a164e1`)
**Review date:** 2026-10-17

---

## 1. Change reviewed

Working-tree diff for IMP-032 (not the full branch diff):

| File | Change |
|---|---|
| `src/features/bills/BillsView.tsx` | `monthlyPaid` now calls `sumRecordedPayments(monthOccurrences)` instead of filtering paid occurrences and summing `item.data.amount`. Two lines replaced; imports one helper. |
| `src/domain/bills.ts` (new) | Pure `sumRecordedPayments(occurrences)` reduces `item.data.payments?.[occKey]?.amount ?? 0` for `kind === 'bill'`. |
| `src/domain/bills.test.ts` (new) | 2 tests: mixed recorded amounts + no-payment bill; editing current `amount` leaves the recorded contribution. |
| `.improve/reports/impl-IMP-032.md` (new) | Implementer report. |
| `.improve/FEATURES.md` | IMP-032 status `TODO → IN-PROGRESS`. |

The rest of the uncommitted `.improve/` state (IMP-033 CHANGELOG/PROGRESS lines and the
IMP-091 backlog addition) predates this item and is unrelated to IMP-032; see §6.

## 2. Acceptance criteria

### AC1 — Paid total sums `payments[occKey].amount` for the visible month — MET

- `src/features/bills/BillsView.tsx:46` builds `monthOccurrences` with
  `useOccurrences(bills, startOfMonth(now), endOfMonthDate(now))`.
- `useOccurrences` (`src/hooks/useOccurrences.ts:12`) delegates to
  `expandOccurrences(item, from, to)`, which filters canonical occurrence dates to the
  inclusive window (`src/domain/recurrence.ts:230-239`).
- `sumRecordedPayments` (`src/domain/bills.ts:6-9`) only iterates the occurrences passed
  to it and reads `payments[occKey].amount`, so a payment recorded against an occurrence
  outside the visible month is not counted, and every counted occurrence uses its own
  month-specific key.
- Each occurrence is keyed independently, so a recurring bill paid twice in one month is
  summed twice; a bill whose current-month occurrence is unpaid contributes nothing.

### AC2 — Editing `amount` does not change prior payments — MET

- The helper never reads `item.data.amount`; it reads only the snapshot stored on the
  payment record.
- `markBillPaid` (`BillsView.tsx:23-33`) is untouched and still snapshots
  `item.data.amount` at payment time.
- Browser proof: paid Verify bill at USD 42 (Paid 100 → 142). Edited the bill to USD 60
  and saved: Paid stayed **142**, "This month" 142 → **160**, Remaining 0 → **18**.
  Pre-change semantics would have shown Paid 160.

### AC3 — Unpaid bills contribute 0 — MET

- Unit test 1 includes `water` (amount 30, no `payments`) and still expects `107.5`
  (42.5 + 65); including its current amount would fail at 137.5.
- Manual probe (Node type-stripping, no files modified): a missing `payments` map, an
  empty `{}` record, and a record lacking `amount` each return **0**; a payment recorded
  only for another month returns **0**; a valid payment returns its recorded amount.
  Nothing in these shapes throws.

### Other totals — unchanged

- `monthlyTotal` (`BillsView.tsx:47-50`) and the `Remaining` expression
  (`BillsView.tsx:93`, `monthlyTotal - monthlyPaid`) are untouched. Browser showed
  "This month" moving only when the bill amount changed, and Remaining tracking the new
  Paid value.

### Missing / partial records

`payments?.[occKey]?.amount ?? 0` handles a missing payments map, a missing occurrence
key, and a payment record without `amount` without throwing. A wholly missing `item.data`
would still throw, but that is normalized at the repository read seam (IMP-088) and by
the `BillItem` type; the live preview's raw no-data bill rendered as "USD 0" and did not
affect the total. This is not a blocker; `item.data?.payments` would be optional
defensive hardening only.

## 3. Gates

Run from the working tree (IMP-032 applied):

```
npm run typecheck  → PASS
npm run lint       → PASS
npm run test       → PASS: 38 files, 404 tests (baseline 402, +2)
npm run build      → PASS: tsc + vite; PWA precache 18 entries; dist/sw.js generated
```

`git diff --check` reports no whitespace errors.

## 4. Test quality (non-vacuous)

Both tests would fail against the old `data.amount` logic:

- Test 1: old total for paid occurrences = 100 + 60 = **160**; assertion is **107.5**
  (recorded 42.5 + 65). Fails old code.
- Test 2: current amount 1200, recorded 750; old logic returns **1200**, assertion is
  **750**. Fails old code.

Test 2 is a direct regression guard for the reported bug. Test 1 covers AC1 and AC3.
The tests call the extracted helper rather than mounting `BillsView`; the browser pass
covers the wiring.

## 5. Browser verification (preview, Playwright)

Preview at `http://localhost:4173/eisenmatrix-calendar/#/bills`, production build.

1. Baseline: This month 142, Paid 100, Remaining 42.
2. Marked "Verify bill" (USD 42) paid → Paid 142, Remaining 0.
3. Edited the bill amount 42 → 60 and saved → This month 160, Paid **142**,
   Remaining 18.
4. Console: 0 errors, 0 warnings.
5. Restored the bill to USD 42 and marked it unpaid; totals returned to
   142 / 100 / 42.

Screenshot (step 3): `.improve/artifacts/IMP-032/bills-paid-after-edit.png`.

## 6. Scope, style, leftovers

- Source scope is exactly the three files the report claims; nothing else was touched.
- No debug logging, TODOs, dead code, hardcoded colors, or new comments.
- Helper is a small pure domain function with correct layering (feature → domain) and
  the import style matches its neighbours.

Pre-existing working-tree noise, not caused by IMP-032: `.improve/CHANGELOG.md` and
`.improve/PROGRESS.log` carry uncommitted IMP-033 entries, and `.improve/FEATURES.md`
also contains the unrelated IMP-091 addition (backlog count 86 → 87). If IMP-032 is
committed, stage only `BillsView.tsx`, `src/domain/bills.ts`, `src/domain/bills.test.ts`,
the IMP-032 report, and the IMP-032 status line; do not `git add -A`. IMP-032 should also
be flipped `IN-PROGRESS → DONE` on acceptance (coordinator state).

## 7. Health deltas (suggested)

| Dimension | Delta | Why |
|---|---|---|
| Bugs/Correctness | **+1** | Fixes a real retroactive-history defect: editing a bill used to rewrite the Paid total for already-recorded payments. Narrow, regression-guarded. |
| Tests/Tooling | 0 | Two focused tests; no new harness or broader coverage. |
| Maintainability | 0 | One small pure helper replaces an inline reduce; no structural change. |
| Risk | low | Read-path totals only; persistence and `markBillPaid` untouched. |

No follow-up item required. Optional (non-blocking): `item.data?.payments` for absolute
defensive safety, and flipping the status to `DONE` on acceptance.
