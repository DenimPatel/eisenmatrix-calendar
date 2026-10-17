# Verify IMP-070 — Habits created outside quick add must still get the daily default

**Verdict: PASS.** All four acceptance criteria hold. `createItem({ kind: 'habit' })`
now yields a daily `interval: 1` rule, an explicit caller rule wins, every other kind
stays `null`, and `normalizeItem` still forces `partial.recurrence ?? null`, so stored
rule-less habits are not rewritten. No schema or migration change exists.

Reviewer: independent (did not author the change). Branch `improve/auto-20261017`,
base `8c5ffab`. Working tree only. The source diff is 8 lines in
`src/domain/itemFactory.ts` plus tests; quick-add, schema, and migrations are untouched.

---

## 1. Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. `createItem({ kind: 'habit' })` with no rule yields daily `interval: 1`; a supplied rule wins | **met** | `itemFactory.ts:26-29` returns `{ freq: 'daily', interval: 1, weekStartsOn: 1, exceptions: [], overrides: {} }` only for `habit`; `:66` uses `options.recurrence ?? defaultRecurrenceFor(kind)`. Test `gives habits a daily recurrence when none is supplied` asserts the exact rule and the seven keys `2026-10-16…2026-10-22` via the real `expandOccurrences`; `keeps a caller-supplied recurrence for habits` asserts a weekly `interval: 2` rule survives verbatim. |
| 2. Both "New habit" buttons produce a habit that expands for the next 7 days | **met** | Both `HabitsView.tsx:75` and `:90` call `createItem({ kind: 'habit', start: today })`, i.e. the fixed factory path. New jsdom test clicks the real header button, reads the editor draft (`kind === 'habit'`, `freq === 'daily'`), and asserts `expandOccurrences(draft, today, +6d)` has exactly 7 occurrences. Browser: New habit → Save stored `{ freq: 'daily', interval: 1, … }` in IndexedDB; Complete today produced a `1 day streak`. |
| 3. `quickAddToItem` keeps its own default and output is unchanged; no other kind gains a rule | **met** | `src/domain/quickadd.ts` is byte-identical to HEAD and still unconditionally overwrites `item.recurrence = parsed.recurrence ?? (habit ? baseRule('daily') : null)` after `createItem`, so the new factory default cannot leak into its output. Three existing quick-add tests (default daily, explicit interval, week expansion) pass unmodified. `does not add a recurrence default to any other kind` sweeps `task/event/goal/bill/shopping/note` and asserts `null`. |
| 4. Pre-existing single-occurrence habits are not rewritten; no migration added | **met** | `normalizeItem` (`itemFactory.ts:119`) still forces `recurrence: partial.recurrence ?? null` after the spread, so the factory default is discarded for rule-less stored items. Test `does not rewrite habits normalized without a rule` covers it. Browser: inserted a `recurrence: null` habit, reloaded; it still rendered and IndexedDB still held `recurrence: null`. `git diff` touches no `src/db/**`; `schema.ts` still has only `version(1)`. |

No criterion is weakened or reinterpreted.

## 2. Code review

```diff
+function defaultRecurrenceFor(kind: ItemKind): BaseItem['recurrence'] {
+  if (kind !== 'habit') return null;
+  return { freq: 'daily', interval: 1, weekStartsOn: 1, exceptions: [], overrides: {} };
+}
...
+  recurrence?: BaseItem['recurrence'];
...
-    recurrence: null,
+    recurrence: options.recurrence ?? defaultRecurrenceFor(options.kind),
```

- Minimum viable change: the defect was the single hardcoded `null`; widening
  `CreateItemOptions` with the already-typed recurrence field is required for AC1's
  precedence rule, not scope creep.
- The rule shape matches `baseRule('daily')` in `quickadd.ts`, so habits are now created
  consistently from the Habits header, the empty state, the command palette (`New habit`
  builds through the same factory), and quick add.
- `normalizeItem` deliberately bypasses the new default; this is the guard that keeps the
  change from becoming an implicit migration. Verified in code, unit test, and browser.
- Call-site audit: no production caller passes `recurrence` to `createItem`, and no caller
  passes an explicit `null`. One nuance: because `??` is used, `recurrence: null` is treated
  as "not supplied" and a habit still gets the daily rule. That is arguably the intended
  semantics ("a habit only makes sense as a series"), it matches the quick-add path, and
  `normalizeItem` is the supported way to represent legacy rule-less habits. Not an AC gap.
- No direct Dexie/localStorage, no new IDs, no persisted UI copy, no debug leftovers
  (`console.`, `debugger`), no `.only`/`.skip`, no new dependency or lockfile change.
  `git diff --check` clean.
- The new HabitsView test's `useUiStore.getState().closeEditor()` in `beforeEach` prevents
  editor state leaking between mounts; the test unmounts the React root it creates.

## 3. Commands / gates

```
npm run typecheck   PASS  (tsc --noEmit, no diagnostics)
npm run lint        PASS  (eslint ., no output)
npm run test        PASS  33 files / 337 tests  (baseline 332; +5 new)
npm run build       PASS  tsc + vite build; PWA injectManifest; 18 precache entries;
                          dist/sw.js generated
```

No new failures. The only stderr noise is the pre-existing
`The current testing environment is not configured to support act(...)` warning from
`HabitsView.test.tsx`; the new test emits it too but passes. It is not introduced by this
diff's assertions (the existing tests already emit it).

Targeted run: `npx vitest run src/domain/itemFactory.test.ts src/domain/quickadd.test.ts
src/features/habits/HabitsView.test.tsx` → 3 files / 32 tests passed.

## 4. Browser verification

Preview at `http://localhost:4173/eisenmatrix-calendar/` against `npm run preview`.

1. First load served the **previous** build from the service-worker precache (banner
   "A new version is available"), so the Schedule tab showed Repeat off. That was a stale
   cache, not a regression. Unregistered the SW, deleted
   `workbox-precache-v2-…`, reloaded.
2. Fresh build: Habits → New habit → Schedule shows the repeat switch `aria-checked=true`
   with Frequency `Daily`.
3. Saved "Verify daily habit"; IndexedDB `items` record has
   `recurrence: { freq: 'daily', interval: 1, weekStartsOn: 1, exceptions: [], overrides: {} }`
   and `start: 2026-10-16`.
4. Clicked `Complete today` → badge changed to `1 day streak` / `Best 1`.
5. Inserted a `recurrence: null` habit directly into IndexedDB, reloaded: the card still
   rendered and the stored rule stayed `null` (AC4).
6. Console: **0 errors, 0 warnings** across the session.

**Verification-method caveat:** the spec's "Habits grid shows filled cells for the next
7 days" is not achievable as written. `HabitsView`'s heatmap only fills a cell when an
occurrence is *completed*, and its 84-cell window currently ends before today (pre-existing
anchoring: it starts at `startOfWeek(today - 83d)` and adds 83 days). So the grid shows
neither future days nor a today cell. Expansion is instead proven by the real
`expandOccurrences` assertions (unit + clicked New habit draft) and by the stored daily
rule that makes today's occurrence completable. The heatmap window is a separate,
pre-existing defect and is not caused by this change.

## 5. Issues / nits (non-blocking)

- **NOTE — explicit `null` cannot disable the habit default.** `options.recurrence ?? …`
  coalesces `null` to the daily rule. No caller relies on null today and legacy data goes
  through `normalizeItem`, but if an API-level "one-off habit" is ever wanted,
  `options.recurrence !== undefined ? options.recurrence : defaultRecurrenceFor(kind)`
  would make AC1 literally true. Optional.
- **NOTE — the jsdom test inspects the draft, not the persisted row.** Browser evidence
  closes that gap (saved recurrence read back from IndexedDB), so no action needed.
- **PRE-EXISTING — heatmap window ends before today** (see §4). Worth a separate backlog
  item: anchor to `startOfWeek(today) - (WEEKS - 1) * 7` so the current week is visible.

## 6. Scope, conventions, hygiene

- Code diff confined to `src/domain/itemFactory.ts` (named by the item) and tests.
  `.improve/FEATURES.md`, `STATE.md`, `PROGRESS.log` are orchestrator bookkeeping.
- Domain-only change; no direct Dexie, no migration, no quick-add edit, no settings or
  route changes.
- No generated `dist/` tracked. Preview server stopped and Playwright artifacts removed
  after verification.

## 7. Recommendation

**Ready to land** as-is. No required changes. Optional follow-ups: explicit-null
precedence (§5) and the separate heatmap window bug (§5, pre-existing).

## 8. Health deltas (suggested)

| Dimension | Current | Suggested | Rationale |
| --- | --- | --- | --- |
| Bugs/Correctness | 4 | 4 (+0.3) | Removes the last split between two habit-creation paths; no data migration risk. |
| Tests/Tooling | 4 | 4 (+0.2) | +5 focused tests, including a real-button HabitsView regression and a legacy-preservation guard. |
| Consistency/Architecture | 4 | 4 (+0.2) | One factory default now serves every habit entry point; quick add keeps its local copy, so the duplication remains a small follow-up. |
| UX/Interaction | 3 | 3 (+0.15) | New habits now have working streaks/"done today" without a quick-add detour; no visual changes. |
