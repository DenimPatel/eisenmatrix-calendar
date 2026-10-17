# Verify IMP-054 — Preserve parsed quick-add data when the kind is changed

**Verdict: PASS.** All three acceptance criteria hold. The new pure helper
`quickAddDataFor(kind, parsed)` derives a fresh payload from `defaultDataFor(kind)` and overlays
only the parsed fields the target kind understands; `QuickAdd` uses it whenever the effective
kind differs from the parsed kind. Reviewed independently; I did not author the change. Branch
`improve/auto-20261017`, base `ecf419f`, working tree only.

---

## 1. Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. Changing kind carries compatible parsed fields (`quantity`/`unit` shopping, `amount`/`currency` bill) | **met** | `src/domain/quickadd.ts:399-415` overlays `quantity`/`unit` for `shopping` and `amount`/`currency` (+`payee`) for `bill`, all from the original parse. Browser: parsed task `gift 2L` → kind `shopping` → stored `{ quantity: 2, unit: 'l', purchased: false }`; parsed task `gift $120` → kind `bill` → stored `{ amount: 120, currency: 'USD', payee: 'Gift', autopay: false, payments: {} }`. |
| 2. Incompatible fields are dropped | **met** | The helper starts from the target kind's full defaults and only writes compatible keys. Browser: `buy milk 2L #groceries` committed as `bill` stored `{ amount: 0, currency: 'USD', payee: 'Milk', autopay: false, payments: {} }` with **no** `quantity`/`unit`. Unit test asserts shopping data has no `amount`/`currency` and a task payload is exactly `{}`. |
| 3. Switching back to the parsed kind restores parsed values | **met** | Payload is always rebuilt from `parsed`, never from the previous kind's data, so the round-trip is stateless. Domain test round-trips `buy milk 2L` shopping → bill → shopping and asserts `quantity === 2`, `unit === 'l'`; browser: change kind to `bill`, back to `shopping`, commit → stored shopping `{ quantity: 2, unit: 'l' }`. |

No criterion is weakened or reinterpreted.

## 2. Code review / scope

- Diff is limited to the named files: `src/domain/quickadd.ts` (+19/−1),
  `src/domain/quickadd.test.ts` (+36/−1), `src/features/quickadd/QuickAdd.tsx` (+2/−3),
  `src/features/quickadd/QuickAdd.test.tsx` (+42). `.improve/*` changes are orchestrator
  bookkeeping, not implementation.
- `quickAddToItem` is unchanged; `defaultDataFor` is unchanged; no schema, migration, repository,
  route, or other kind logic is touched. No new dependency and no lockfile change.
- `quickAddDataFor` is pure: it calls `defaultDataFor`, which allocates fresh objects, spreads
  them, overlays only from `parsed`, and returns a new object. It does no I/O, reads no clock,
  mutates neither `parsed` nor the defaults, and is deterministic.
- Caller audit (`grep` over `src`): production caller is only
  `src/features/quickadd/QuickAdd.tsx:50`; the other references are the definition and tests.
- `defaultDataFor` defaults remain the source of truth for autopay/payments/purchased, so a
  bill produced by the helper is structurally identical to `quickAddToItem`'s bill.
- Hygiene: no `console.`/`debugger`, no `.only`/`.skip`, no TODO/debug leftovers; one JSDoc
  comment explains non-obvious intent (allowed). `git diff --check` clean; Prettier check
  passes on all four changed source files. Cast to `Item['data']` mirrors the existing
  `quickAddToItem` pattern, not a new type-safety risk.

## 3. Commands / gates

```
npm run typecheck  PASS  (tsc --noEmit, no diagnostics)
npm run lint       PASS  (eslint ., no output)
npm run test       PASS  33 files / 341 tests (baseline 337; +4 new)
npm run build      PASS  tsc + vite build; PWA injectManifest; 18 precache entries;
                         dist/sw.js generated
npx prettier --check <4 changed files>  PASS
```

No new failures; no pre-existing command failures were observed. Test count matches the
implementer's report.

## 4. Browser verification (Playwright, preview :4173)

**Important environment caveat.** The first page load was controlled by a stale service worker
and served `assets/index-DMstTC61.js`, an older bundle whose `QuickAdd` still called
`data = defaultDataFor(kind)`. That reproduced the original bug (`gift $120` → bill stored
`amount: 0`) and, notably, the new jsdom test's scenario still produced `quantity: 2, unit: 'l'`
on that pre-fix bundle. I unregistered the SW, deleted the `workbox-precache-v2-…` cache,
reloaded, and confirmed the page then loaded the freshly built `assets/index-D5YR1EH_.js`
whose helper is `function i1(kind, parsed){ … u.payee = parsed.title }`. All results below are
from that fresh bundle. (This stale-SW step is already a known docs gap, IMP-065.)

| Scenario (typed input) | Kind flow at commit | Stored item (IndexedDB `items`) |
| --- | --- | --- |
| `buy milk 2L #groceries` | shopping → bill → shopping | `{ kind: 'shopping', title: 'Milk', data: { quantity: 2, unit: 'l', purchased: false } }` |
| `buy milk 2L #groceries` | shopping → bill | `{ kind: 'bill', data: { amount: 0, currency: 'USD', payee: 'Milk', autopay: false, payments: {} } }` — no `quantity`/`unit` |
| `gift $120` (parses as task) | task → bill | `{ kind: 'bill', data: { amount: 120, currency: 'USD', payee: 'Gift', autopay: false, payments: {} } }` |
| `gift 2L` (parses as task) | task → shopping | `{ kind: 'shopping', data: { quantity: 2, unit: 'l', purchased: false } }` |

Console: **0 errors, 0 warnings** across the session. Preview server stopped and Playwright
artifacts removed afterward. Pre-existing seeded habit rows remained in IndexedDB from earlier
sessions; test rows were identified by title, and the misleading stale-bundle rows were deleted
before the fresh run.

## 5. Issues / nits (non-blocking)

- **NOTE — the jsdom regression test does not guard the wiring.** In
  `QuickAdd.test.tsx:63` the final commit has `effectiveKind === parsed.kind` (shopping), so
  `QuickAdd` takes the `quickAddToItem` path and never calls `quickAddDataFor`. The test passes
  on pre-fix code (observed directly on the stale bundle). The helper unit tests do fail
  pre-fix, so the core logic is covered, but a future revert of `QuickAdd.tsx:50` to
  `defaultDataFor` would not be caught. Suggested: commit while on `bill` (e.g. `gift $120`)
  and assert the bill payload, or use the verified `gift 2L` → shopping path.
- **NOTE — bill assertions are `toMatchObject`.** They would not catch accidentally retained
  `quantity`/`unit`; add `expect(bill).not.toHaveProperty('quantity')` (browser behaviour is
  already correct).
- **RESIDUAL (pre-existing, outside AC scope) — base fields are not reconciled.** Switching a
  parsed `#groceries` shopping item to `bill` still assigns the shopping `listId` and keeps the
  tag; only `data` fields are normalised. Likewise the implementer-disclosed D1: recurrence
  still comes from the parsed kind (a parsed habit switched to task keeps daily). Both are
  pre-existing and not required by IMP-054, but worth separate items if "incompatible" is meant
  to include base fields.

## 6. Recommendation

**Ready to land as-is.** No required changes. Optional follow-ups: strengthen the jsdom test
so it exercises the changed commit branch, add negative assertions for dropped bill fields, and
consider reconciling `listId`/default recurrence on kind switch (D1 + residual above).

## 7. Health deltas (suggested)

| Dimension | Current | Suggested | Rationale |
| --- | --- | --- | --- |
| Bugs/Correctness | 4 | 4 (+0.2) | Removes a silent data-loss path on kind switch; narrow, well-contained change. |
| Tests/Tooling | 4 | 4 (+0.1) | +4 tests, but the integration test does not exercise the fixed branch; helper tests do. |
| UX/Interaction | 3 | 3 (+0.1) | Users no longer lose parsed quantity/amount when correcting the inferred kind. |
| Format/Structure | 3 | 3 (0) | Style/format clean; no structural change. |
