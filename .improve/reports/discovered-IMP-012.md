# Discovered findings while implementing IMP-012

Out-of-scope observations from the IMP-012 work. Not fixed; not in scope of the item.

## 1. Editor writes the *series* date into an occurrence override (pre-existing)

Reproduction (preview, seeded daily task, series start `2026-09-28T09:00`, scope "This
occurrence", Schedule tab, time changed to `14:45`, Save):

```
item.start:                          2026-09-28T09:00  -> 2026-09-28T14:45
recurrence.overrides['2026-10-04']:  { start: '2026-10-04T16:30' }
                                     -> { start: '2026-09-28T14:45', title, notes }
```

The override `start` keeps the **series** date `2026-09-28` instead of the edited
occurrence date `2026-10-04`, and the series `item.start` is mutated as well (the known
"this occurrence edits leak to the series" defect listed in REPO_PROFILE §7). A moved
occurrence therefore resolves to a start on the wrong calendar day; `expandOccurrences`
still files it under `occKey = '2026-10-04'`, so it renders in the right day cell with
the wrong date/time semantics.

Suggested fix: in `ItemEditorSheet`, seed the schedule fields from the resolved
occurrence (`occurrence.start`) rather than `item.start`, and when scope is `occurrence`
write the override with the occurrence's own date (`occurrenceKey`) instead of the
series date. Related: the Schedule tab shows the series start/time even when the editor
was opened from a moved occurrence, so a moved occurrence looks un-moved while editing.

## 2. `ItemEditorSheet` crashes on items whose `data` payload is missing

Opening the editor for a hand-written/legacy row without `data` throws
`TypeError: Cannot read properties of undefined (reading 'estimateMinutes')` from
`KindFields` (`item.data.estimateMinutes`). `createItem`/`normalizeItem` always set
`data`, so this only shows for rows that bypassed them (import/backup edge cases).
`normalizeItem` should backfill `data` via `defaultDataFor(kind)`, or the fields should
use optional chaining. Found while seeding Playwright fixtures by hand; a crash there
takes down the whole React tree, so it is worth a defensive fix.

## 3. Preview serves a stale service-worker bundle after a rebuild

`npm run build` while `npm run preview` is running: the already-open tab keeps executing
the **previous** bundle from the `workbox-precache-v2-*` cache and shows old UI (the
"new version is available" toast appears). The fix looked broken until the service worker
was unregistered and the cache cleared. Verifiers should hard-reset the SW (or use a
fresh browser context) after every rebuild, otherwise UI-only fixes appear to fail.
