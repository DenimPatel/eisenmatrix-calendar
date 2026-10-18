# Independent verification — IMP-040 & IMP-041

**Verdict: PASS** (non-blocking issues noted below)

Reviewed the uncommitted working tree (`git diff`): `src/domain/itemActions.ts`,
`src/domain/stats.ts`, `src/domain/itemActions.test.ts`, `src/domain/stats.test.ts`.
No other source changed; `FEATURES.md` was untouched by the implementer.

## Acceptance criteria

### IMP-040 — non-recurring `updateOccurrence`

`src/domain/itemActions.ts:314-323`: the `!rule` branch builds an `ItemPatch` from every
provided field (`start`, `end`, `notes`), omitting `undefined` and treating `end: null` as a
clear. `patchItem` remains the single write path, so history/undo are unchanged.

1. **PASS (as scoped) — all provided fields persist.** `start`/`end`/`notes` are written;
   `end: null` clears. The AC's `status` is **obsolete**: IMP-016 removed it from the patch
   type because per-occurrence status is occurrence state, not an override — it is handled by
   `updateRecurring`→`occurrenceStateFor`/`setStatus`. The current signature is exactly
   `{ start?, end?, notes? }`, so "all supported fields" is met.
2. **PASS — `undefined` unchanged.** Omitted fields are not written; probe confirmed `end`
   and `notes` survive a start-only patch.
3. **PASS — recurring unchanged.** The override branch (`:325-329`) is untouched; probe and
   the existing suite confirm an override is written, not the series.

### IMP-041 — null-guard `parseLocalDate`

1. **PASS — `splitSeries` safe no-op.** Pre-existing guard `recurrence.ts:434-435` returns
   `{ head: item, tail: item }` for an unparseable `fromKey`; covered by
   `recurrence.test.ts:544-548`. Probe confirmed for `''`/`'not-a-date'`.
2. **PASS (literal) — `habitStreak` fallback.** `stats.ts:54-55` null-checks `item.start` and
   falls back to `addMonths(today, -12)`; the best-streak loop (`:95-110`) parses the first/last
   period keys without `!` and skips the scan if either is null. See caveat below.
3. **PASS — no remaining `!`.** `grep 'parseLocalDate\([^)]*\)\s*!'` finds matches only in
   `*.test.ts`; neither `recurrence.ts` nor `stats.ts` has one.

## Regression checks

- **Editor `occurrence` scope, non-recurring items.** The editor never calls
  `updateOccurrence`: `scope` initialises to `'all'` when `editor.item.recurrence` is null
  (`ItemEditorSheet.tsx:137`) and `handleSave` routes non-recurring drafts to `saveItem`
  (`:231-233`). The only production caller of `updateOccurrence` is the AppShell drag
  (`AppShell.tsx:84`, `{ start: nextStart }`). `ItemEditorSheet.test.tsx:315-345`
  ("keeps a non-recurring multi-day range…", `history == []`) passes unchanged.
- **History / undo.** Probes confirmed a non-recurring occurrence edit records one entry per
  changed field (`Start`, `End`, `Notes`), pushes a single `Change “…”` undo, and undo restores
  the original row. A start-only patch records only `Start`. An empty patch is a no-op with no
  history.
- **Stats for valid inputs.** `parsedStart` is non-null for a valid start, so `earliest` is
  unchanged; the loop's guards are no-ops for the always-valid `formatISODate` keys. Probe
  reproduced a normal current/best/lastAt streak identically.

## Gates (independent)

- `npm run typecheck` PASS · `npm run lint` PASS · `npm run format:check` PASS.
- `npm run test` PASS: **69 files / 693 tests** (baseline 689; +4 as reported).
- `npm run build` PASS: `dist/sw.js`, 28 precache entries, 654.34 KiB.

## Non-vacuity and caveat

- IMP-040's new tests are non-vacuous: the pre-change one-liner wrote only `start`, so the
  `end`/`notes`/`null`-clear assertions fail against it.
- **IMP-041 stats half is behaviour-preserving, not a crash fix.** A probe replicating the
  pre-fix logic shows `addDays(null, -7)` does **not** throw (date-fns coerces `null` to the
  epoch) and `expandOccurrences` returns `[]` when `seriesStartOf` is null, so the old
  `habitStreak` already returned `{ current: 0, best: 0, lastAt: null }` for a malformed
  `start`. The three `!` on `keys[…]` were never reachable-null (keys are `formatISODate`
  output). The new test therefore passes against the pre-fix code too; AC2/AC3 are satisfied
  literally (the code now falls back and has no `!`), but the item's "can crash a view"
  premise is not reproducible through `habitStreak`.

## Non-blocking issues

1. IMP-041 AC2's stated hazard is unreachable; the stats edit is defensive cleanup. No harm,
   but the added test provides no fail-before/pass-after evidence.
2. `updateOccurrence`'s non-recurring branch can now persist an inverted range (an `end`
   before the new `start`); the recurring `future` branch guards this
   (`itemActions.ts:452-456`), the non-recurring branch does not. No production caller passes
   `end`, so it is latent only.
3. FEATURES.md IMP-040/041 still read `Status: TODO`; marked DONE by this verification.

No scope creep, no new dependencies, no direct Dexie outside `src/db/`, no new comments
beyond the two intent notes. Working tree is clean of verifier scratch files.
