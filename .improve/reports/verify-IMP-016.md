# IMP-016 Verification Report — re-verification (retry 2)

**Item:** IMP-016 — "This occurrence" edits must not leak to the whole series
**Reviewed change:** uncommitted working-tree diff vs `HEAD` (`ab0499e`)
**Reviewed by:** independent verification (did not author the change)
**Date:** 2026-10-05
**Verdict:** **PASS** — all three previously reported issues are genuinely fixed, AC1–AC3
hold, nothing regressed, all four gates are green, mutation-checked, and browser-verified.
Three non-blocking follow-ups remain (§7).

---

## 1. Files in the change

| File | +/- | Purpose |
| --- | --- | --- |
| `src/domain/recurrence.ts` | +85 / -49 | `resolveStatus` → exported `resolveOccurrenceStatus`; `occurrenceEnd` rebuilt on the resolved start + resolved `allDay` (`deriveOccurrenceEnd`, `endFollowsStart`) |
| `src/domain/itemActions.ts` | +120 / -44 | `occurrenceStateFor()`, `withoutOverrideStatus()`; occurrence branch writes only overrides + `occurrences`; `updateRecurring` returns `boolean`; `setStatus`/`toggleDone` converge on `item.occurrences` |
| `src/features/item/ItemEditorSheet.tsx` | +330 / -136 | `SERIES_ONLY_FIELDS`, `seriesPatch`, `occurrencePatch`, `SeriesOnlyGroup`; series-only controls disabled + labelled; `end` normalised when the All-day flag flips |
| `src/features/item/ItemCard.tsx` | +5 / -2 | checkbox reads `resolveOccurrenceStatus` |
| `src/domain/recurrence.test.ts` | +172 / -6 | +7 status/range tests (1 existing case re-based on the new source of truth) |
| `src/domain/itemActions.test.ts` | +331 / -3 | +8 occurrence-scope tests |
| `src/features/item/ItemEditorSheet.test.tsx` | +200 / -0 | +3 editor tests (5 total new cases incl. the two prior ones) |
| `.improve/PROGRESS.log` | +1 / -0 | unrelated bookkeeping line for the already-committed IMP-058 (see §6) |

`git diff --stat src/` = 7 files, +1061 / -182. No schema bump needed: `end` and `allDay`
already existed on `OccurrenceOverride` (`src/types/recurrence.ts:11`).

---

## 2. Prior-issue re-verification

### 2.1 HIGH (prior §6.1) — occurrence status vs `item.occurrences[key]` → **FIXED**

`item.occurrences[occKey]` is now the only authoritative store.

- `resolveOccurrenceStatus` (`src/domain/recurrence.ts:188-197`) reads `state` **first**;
  an override `status` is consulted only when the occurrence has no state.
- The override no longer carries `status` (`src/domain/itemActions.ts:284-295`; the comment
  at `:285-286` states it explicitly).
- `toggleDone` (`:208-212`) decides from `resolveOccurrenceStatus`, not from
  `item.occurrences[...] === 'done'`.
- `ItemCard` (`:51`) resolves the same way, so the checkbox cannot disagree with the card
  status, the calendar or the stats (both `itemCompletionStats` and `deriveStreaks` read
  `expandOccurrences`).
- `updateOccurrence` (drag) no longer accepts `status` at all (`:242`), so the drag path
  cannot create a second copy.

**Independent probe** (`src/domain/__zz_review016.test.ts`, written by the reviewer,
23 cases, run then deleted) — legacy/back-compat paths:

| Legacy row | Before | After first status write |
| --- | --- | --- |
| `overrides[k] = {status:'done'}`, no state | resolved `done`, card **ticked** | `overrides[k]` **deleted**, `occurrences[k] = {status:'todo', completedAt:null}`, card **unticked**; second toggle → `done` |
| `overrides[k] = {status:'todo'}`, no state | resolved `todo`, card unticked | `overrides[k]` deleted, `occurrences[k] = {status:'done', completedAt>0}`, card ticked |
| `overrides[k] = {status:'done', start, title}`, no state | resolved `done` | only `status` stripped: `{start, title}` kept |
| `overrides[k] = {status:'done'}`, `occurrences[k] = {status:'doing'}` | resolved **`doing`** (state wins) | `setStatus(...,'todo')` → `overrides[k]` deleted, state `todo` |
| same, saved via the **editor** (`updateRecurring`) | resolved `done` | `occurrences[k] = {status:'doing'}`; resolved `doing` (correct); legacy `overrides[k].status` **left in place** — see §7.1 |

Both directions agree, and the legacy override can never resurface because
`resolveOccurrenceStatus` prefers the state and **no code path deletes
`item.occurrences[key]`** (grepped: no `delete`/`omit`/undefined assignment of
`occurrences[...]` anywhere in `src/`).

**Browser (legacy path, real app, seeded row `r2-legacy-probe` with
`overrides['2026-10-12'] = {status:'done'}`):**

```
before  card aria-label = "Mark as not done"        (ticked)
click  -> card aria-label = "Mark as done"          (cleared)
stored overrides    = {}                            (legacy entry removed)
stored occurrences  = {"2026-10-12":{status:"todo",completedAt:null}}
base status         = "todo"   (untouched)   history = ["Recurrence"]
```

Screenshots `r2-01`, `r2-02`, `r2-03`.

### 2.2 MED-HIGH (prior §6.2) — inverted occurrence ranges → **FIXED**

`occurrenceEnd` (`src/domain/recurrence.ts:163-174`) derives the end from the **resolved**
start and the **resolved** `allDay` (computed at `:204`, i.e. before `end`), never from
`item.allDay` or the canonical series day. `endFollowsStart` (`:139-146`) rejects an
override `end` that precedes the resolved start, and also rejects a bare date ending a
timed occurrence.

Reviewer probe, 11 range scenarios written end-to-end through `updateRecurring`
(scope `occurrence`) and then resolved through `expandOccurrences`. Every one is ordered
(`end >= start`) and every sibling occurrence (`2026-07-13`, `2026-07-27`) is byte-identical
before/after:

| # | Scenario | Resolved `start` | Resolved `end` | Ordered |
| --- | --- | --- | --- | --- |
| a | all-day series, no `end`, date moved | `2026-07-15` | `null` | yes |
| b | all-day series `start=end`, date moved | `2026-07-15` | `2026-07-15` | yes (was `2026-07-13`, **inverted**) |
| c | all-day series → occurrence timed | `2026-07-20T09:00` | `2026-07-20T09:00` | yes (was `2026-07-13`, **9 h inverted**) |
| d | all-day series, no `end` → occurrence timed | `2026-07-20T09:00` | `null` | yes |
| e | timed series moved to another day | `2026-07-20T14:00` | `2026-07-20T15:00` | yes |
| f | timed series, override `end` precedes start | `2026-07-20T14:00` | `2026-07-20T15:00` | yes |
| g | timed series, override `end` is a bare date | `2026-07-20T14:00` | `2026-07-20T15:00` | yes |
| h | timed series → occurrence all-day | `2026-07-20` | `2026-07-20` | yes |
| i | multi-day all-day series, date moved | `2026-07-15` | `2026-07-15` | yes |
| j | multi-day timed series, moved | `2026-07-20T23:00` | `2026-07-21T03:00` | yes |
| k | timed series, zero-length, occurrence | `2026-07-20T18:45` | `2026-07-20T18:45` | yes |

The editor side is fixed too: `ItemEditorSheet.tsx:495-507` normalises `end` into the same
shape as `start` when the All-day checkbox flips (bare date ↔ `THH:mm`, reusing the start
time), so a timed occurrence can no longer inherit the series' bare date as its end.

**Browser:** opened `Occurrence 2026-10-12` of an all-day weekly series, Schedule tab,
unchecked **All day** → Start split into `2026-10-05` + `09:00` and End became
`2026-10-05T09:00` (was `2026-10-05T00:00`). Saved with "This occurrence" →
`overrides['2026-10-12'] = {start:'2026-10-05T09:00', end:'2026-10-05T09:00', allDay:false}`
(ordered), base `start/end/allDay/status/urgency/dueAt/tags` all unchanged, one history
entry, and the agenda card re-sorted to the top showing `09:00`. Screenshot `r2-04`.

### 2.3 MED (prior §6.3) — series-only fields silently dropped → **FIXED (presentation)**

Nothing is dropped while claiming success any more:

- `SERIES_ONLY_FIELDS` (`ItemEditorSheet.tsx:38-47`) = urgency, importance, tags,
  reminders, listId, checklist, data, dueAt, recurrence.
- `occurrenceScoped` (`:146`) gates both `update()` and `updateData()` (`:148-162`), so
  even a forced change cannot reach the series — defence in depth, not just `disabled`.
- Presentation: `Urgency`, `Importance`, `List`, `Tags`, `Due` render `disabled` with a
  `hint` of **"Applies to the whole series"**; `KindFields`, `Checklist`, and the
  `RecurrenceEditor` + `ReminderEditor` group sit inside `<fieldset disabled>` with a
  `legend` **"Series · Applies to the whole series"**. The scope banner enumerates what
  *is* editable.
- The prior §6.5 (no-op save toasting success) is also fixed: `updateRecurring` returns
  `boolean` and the toast reads **"Nothing to update for this occurrence"**. Verified in
  the browser (screenshot `r2-05`) and in `ItemEditorSheet.test.tsx`.
- Bonus fix in the same family: `seriesPatch` now also carries `dueAt`, `listId` and
  `checklist`, so "All occurrences" / "This and future" no longer silently ignore those.

**Browser a11y snapshot of `Occurrence 2026-10-12` (details + schedule tabs):**
Urgency/Importance combobox `[disabled]`, `KindFields` (Location / Travel time /
Attendees, or Estimate / Energy) `[disabled]`, List `[disabled]`, Tags fieldset `[disabled]`,
Checklist input `[disabled]`, Due `[disabled]`, entire recurrence + reminders group
`[disabled]`; Status / Title / Notes / Start / End / All day editable. Zero new console
errors or warnings.

---

## 3. Acceptance criteria (`.improve/FEATURES.md` → `### IMP-016`)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| AC1 | Occurrence scope writes only `overrides[occKey]`; base `start/end/allDay/status/urgency/importance/tags/reminders/data` unchanged | **MET** | §4.1 |
| AC2 | Override captures what a single occurrence may change (min. `start`, `title`, `notes`, `allDay`, per-occurrence status) | **MET** | §4.2 |
| AC3 | Editing occurrence N changes no other occurrence's displayed values | **MET** | §4.3 |
| — | Overrides survive reload; a no-op edit writes nothing | **MET** | §4.4 |
| — | `series` / `future` scopes unchanged | **MET** (no regression) | §4.5 |
| — | History records one entry; undo restores; tests cover the above | **MET** | §4.6 |

---

## 4. Detail

### 4.1 AC1 — base item untouched

Fixture: weekly timed task `2026-07-13T09:00`–`10:00`, `tags:['work']`,
`reminders:[{id:'r1',offsetMinutes:-10}]`, `data:{estimateMinutes:15}`.

Probe "AC1: a full editor-shaped occurrence patch leaves the base byte-identical" applies
**every** field the editor can edit (title, notes, status, urgency, importance, tags, allDay,
start, end, dueAt, listId, checklist, reminders, data **and a draft `recurrence` rule**):

```
updateRecurring(before, 'occurrence', '2026-07-20', <all of the above>)
strip({recurrence, occurrences, history, updatedAt}) after  ===  before   -> deep-equal
after.recurrence.freq        -> "weekly"   (draft's "yearly" rejected)
after.recurrence.overrides   -> {"2026-07-20": {start:"…T11:00", end:"…T12:00",
                                               allDay:true, title:"T", notes:"N"}}
after.occurrences            -> {"2026-07-20": {status:"done", completedAt:>0}}
```

The branch also re-reads the persisted row (`itemActions.ts:281`,
`(await itemRepo.get(item.id)) ?? item`) so a stale draft rule cannot reach storage.

### 4.2 AC2 — override shape matches what `expandOccurrences` reads

`buildOccurrence` (`:199-218`) reads `override.start`, `override.end`, `override.allDay`
and the resolved status; `occurrencePatch` writes exactly `start`, `end`, `allDay`,
`title`, `notes` (+ `status` → `occurrences`). No dead keys, no name drift.
An override left with no fields is not stored at all (`:300-303`).

### 4.3 AC3 — sibling isolation

Probe "leaves every other occurrence of the series displaying the same values" compares a
projection of what a card renders (title, notes, start, end, allDay, status, isOverride)
for `2026-07-13`, `2026-07-27` and `2026-07-20` before/after: siblings identical, the
edited one changed. Browser: after editing `2026-10-12` of the all-day series, the base row
and every other occurrence were unchanged (`base start/end/allDay/status/urgency/dueAt/tags`
verified byte-for-byte through IndexedDB after each save).

### 4.4 Persistence + no-op

- A no-op occurrence save returns `false`, writes no row, leaves `updatedAt`/`history`/
  `overrides` untouched, and pushes no undo entry. Browser toast: "Nothing to update for
  this occurrence".
- A repeat save of the *same* status also returns `false` and the stored row JSON is
  byte-identical (probe "no-op write of the same status").

### 4.5 `future` / `series` — no regression

Reviewer probe "scope `future` still splits and applies the whole patch to the tail":
head keeps `title "Standup"`, `urgency low`, `freq weekly`, and its **existing override is
preserved**; the new tail gets `title "From here"`, `urgency high`, `allDay true`,
`tags ["tail"]`, `dueAt`, `data`. `seriesPatch` carries the full field set (title, notes,
status, urgency, importance, tags, listId, checklist, allDay, start, end, dueAt, reminders,
data) — a superset of the literal it replaced, so nothing that used to apply stopped
applying. `scope === 'all'` probe asserts every field lands on the base and `overrides`
stays `{}`. `isOverride` was redefined ("carries any override") but has **no consumer**
outside `src/types` + `src/domain/recurrence.ts`, so the redefinition is inert.

### 4.6 History / undo

- Occurrence save: exactly **one** history entry, `field: 'Recurrence'`
  (`buildHistory` deliberately skips `occurrences`, `itemActions.ts:39` — pre-existing).
- Undo stack depth 1 → 0 after `undo()`, row restored **byte-identical**
  (probe "restores the series on undo").
- Browser: card checkbox → `⌘Z` → checkbox cleared, toast "Undone", and the stored row was
  fully restored (`overrides {}`, `occurrences {}`, `history []`, base untouched).
  Screenshot `r2-03`.

---

## 5. Gates, mutation checks, no-regression

### 5.1 Gates (400 s budget, final state, probe file deleted)

```
npm run typecheck   PASS
npm run lint        PASS   (0 errors, 0 warnings)
npm run test        PASS   26 files / 218 tests  (baseline 192 -> +26)
npm run build       PASS   dist/sw.js, 18 precache entries, 607.31 KiB
```

`shasum` of `itemActions.ts` / `recurrence.ts` matches the pre-mutation state
(`5e205f8a…`, `e23536ef…`).

### 5.2 Mutation checks — the tests genuinely bite

| Mutation | Result |
| --- | --- |
| Reintroduce the old base-patch call `patchItem(item.id, { ...patch, recurrence: { ...rule, overrides } }, {silent:true})` | **23 failed** — 8 authored (3 `ItemEditorSheet.test.tsx`, 5 `itemActions.test.ts`) + 15 reviewer probes |
| Break the end derivation (re-key `deriveOccurrenceEnd` off `item.allDay` + the series day) | **11 failed** — 6 authored (3 `recurrence.test.ts`, 2 `itemActions.test.ts`, 1 `ItemEditorSheet.test.tsx`) + 5 reviewer probes |
| Revert the status precedence (override `status` again shadows `item.occurrences`) | **4 failed** — 2 `recurrence.test.ts` + 2 reviewer probes |

All three mutations were reverted; the file hashes above confirm it.

### 5.3 No regression on other paths

Reviewer probes, all green:

- **Ordinary (non-recurring) task completion** — `toggleDone` with no `occKey` still writes
  `item.status`; done → todo → done; the card still reads `item.status`.
- **Habit toggling (IMP-050)** — `toggleDone(habit, todayOccKey)` still writes
  `data.streak = {current: 1, …}` and pushes an undo entry; the existing
  `describe('toggleDone (habit)')` block (3 cases) and IMP-050's own suite are unchanged
  and green.
- **Drag path** — `updateOccurrence` narrowed its patch type; the only caller
  (`AppShell.tsx:81`) passes `{start}` only, so `tsc` proves it still compiles.
- **`future` / `all` scopes** — §4.5.
- No other file in `src/` changed behaviour: the only consumers of the changed exports are
  `ItemCard`, `AppShell` (unchanged call shape), `ItemEditorSheet` and `stats.ts`
  (reads `expandOccurrences`, whose signature is unchanged).

---

## 6. Diff hygiene

- No `console.*`, `debugger`, `.only(`, `TODO`, `FIXME`, `eslint-disable`, hardcoded
  hex/slate colours, secrets (scanned for key/token/password/bearer), no new
  `localStorage`, no direct Dexie outside `src/db/`.
- New comments are all non-obvious-intent explanations (the recurrence/status precedence
  rules, why `end` is normalised, why `status` is not on the override), which AGENTS.md
  permits. They are the load-bearing part of this change.
- Imports match existing conventions (`type ItemPatch` from `@/db/repository`, same as the
  file already used; `dateKeyOf` added to the existing `@/lib/date` import).
- **Unrelated change (unchanged from the prior report):** `.improve/PROGRESS.log` gains one
  line for `IMP-058 done | ab0499e`. IMP-058 is already committed as `HEAD`, so this is
  legitimate bookkeeping — but it is not part of IMP-016 and should be committed separately
  or dropped.
- **Housekeeping risk (unchanged):** `.kilo/` is untracked and **not** in `.gitignore`;
  `git add -A` would commit an Agent Manager worktree copy. Add `.kilo/` to `.gitignore`
  before committing.
- No scope creep: the two files the item names (`itemActions.ts`, `ItemEditorSheet.tsx`)
  plus the three collaborators required to make the fix coherent
  (`recurrence.ts` — the status precedence and end derivation live there;
  `ItemCard.tsx` — 5 lines, so the checkbox agrees with the resolver).

---

## 7. Remaining findings (non-blocking)

### 7.1 LOW — a legacy `overrides[key].status` is shadowed, not erased, by the editor path
`src/domain/itemActions.ts:287-295` builds the new override from `rule.overrides[occKey]`
and does **not** strip `status`; only `setStatus` (`:170-181`) calls
`withoutOverrideStatus`. So an occurrence-scoped **status** save over an attempt-1 row
leaves the stale `overrides[key].status` in place. It is harmless — `resolveOccurrenceStatus`
prefers the state, so the resolved status, the card and the stats all agree, and the next
checkbox toggle erases it — and it can never resurface. But the impl report's §1 claim that
"the first status write … deletes the legacy override status" is only true of
`setStatus`/`toggleDone`, not of `updateRecurring`. Either call `withoutOverrideStatus` in
the occurrence branch too, or correct the report.

### 7.2 LOW — the editor draft is the series item, so an occurrence's own overrides are not shown
`ItemEditorSheet.tsx:122` does `setDraft(structuredClone(editor.item))` — the **series** row.
Observed in the browser: with
`overrides['2026-10-12'] = {start:'…T09:00', end:'…T09:00', allDay:false}`, reopening the
occurrence shows **All day checked**, Start `2026-10-05`, End `2026-10-05T00:00` (the series
values). Consequences: (a) the editor misreports the occurrence; (b) a later
occurrence-scoped save that touches Start or All day silently resets that occurrence's own
override to the series value (observed: a moved `start: 2026-10-15` was overwritten to
`2026-10-05` when All day was toggled). AC1/AC3 are unaffected (the base is still never
touched and the range stays ordered), and this is the same root cause as the already-tracked
`discovered-IMP-016.md` "title/notes overrides are stored but never rendered" — the editor
never sees the resolved occurrence. Non-blocking; belongs with that follow-up.

### 7.3 INFO — coverage gap: the `future` scope lost its test
Retry 1 had `it('applies every field to this and future')`; retry 2 renamed/kept only the
`all` case, and `grep` finds **no** `future` test in the repo (IMP-025 AC4 asks for one).
I verified the behaviour by probe and in the browser (§4.5) and it is correct, but a
regression there would now be silent. Suggest re-adding the case. (The mutation checks in
§5.2 confirm the *occurrence* and *end-derivation* logic are pinned regardless.)

### 7.4 INFO — pre-existing, unchanged
- `title` / `notes` overrides are still stored but never rendered (prior §6.4; tracked in
  `discovered-IMP-016.md`). The banner now says an occurrence "can only change its title,
  notes, …", which slightly over-promises — the change lands in storage but is invisible
  on the card.
- Multi-day all-day recurring events still resolve to single-day occurrences
  (`deriveOccurrenceEnd` returns `formatISODate(start)`), same as before the diff.

---

## 8. Artifacts

`.improve/artifacts/IMP-016/` (retry-2 set added alongside the retry-1 shots):

| File | Contents |
| --- | --- |
| `r2-01-legacy-override-ticked.png` | day agenda, `Occurrence 2026-10-12`: seeded legacy `overrides[k].status='done'` renders the card checkbox **ticked** ("Mark as not done") |
| `r2-02-occurrence-done-ticked.png` | after clicking: checkbox cleared; card flipped back to "Mark as done" |
| `r2-03-occurrence-undo-cleared.png` | `R2 weekly probe` ticked, then `⌘Z` → unticked, toast "Undone" |
| `r2-04-allday-occurrence-timed-ordered-range.png` | Schedule tab of the all-day occurrence with **All day** unchecked: Start `2026-10-05` + `09:00`, End `2026-10-05T09:00` (same shape, ordered) |
| `r2-05-noop-save-nothing-to-update.png` | re-saving an occurrence with no edits → toast **"Nothing to update for this occurrence"** |

Playwright against `npm run preview` (:4173) of a clean `npm run build`.
**Console messages: 0** (no errors, no warnings) for the whole session. Three probe rows
(`r2-weekly-probe`, `r2-allday-probe`, `r2-legacy-probe`) were written into the browser's
IndexedDB for the run and **deleted** afterwards; the demo seed data was left untouched
(13 rows remain, as before).

---

## 9. Commands run

```
npm run typecheck && npm run lint && npm run test && npm run build     # 218 tests, all green
npx vitest run src/domain/__zz_review016.test.ts                       # reviewer probes: 23 passed
# mutation 1: old base-patch call reintroduced                    -> 23 failed
# mutation 2: end derivation re-keyed off item.allDay + series day -> 11 failed
# mutation 3: override status again shadows item.occurrences      ->  4 failed
shasum src/domain/itemActions.ts src/domain/recurrence.ts             # hashes restored
```

## 10. Recommendation

**Merge.** HIGH (prior §6.1), MED-HIGH (prior §6.2) and MED (prior §6.3) are genuinely
fixed — not papered over — with the dead checkbox, the inverted ranges and the silent
field drops each independently reproduced and closed, in both the domain layer and the real
UI. AC1–AC3 hold, the `future`/`all` scopes, ordinary completion and IMP-050 habit
toggling are unregressed, and the suite grew from 192 to 218 tests with three mutations all
caught.

Before committing: add `.kilo/` to `.gitignore` (§6), and either apply §7.1 or correct
`impl-IMP-016.md` §1. §7.2 and §7.3 are worthwhile follow-ups but do not block.