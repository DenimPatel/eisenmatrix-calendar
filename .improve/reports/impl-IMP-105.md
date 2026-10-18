# impl-IMP-105 — Header CTA guard, digest time width, boot failure copy

**Status:** done

Covers IMP-104, IMP-105 and IMP-107 (visual/UX items from
`.improve/reports/discover3-visual.md` V4/V5/U4).

## IMP-107 — Boot failure toast names the local database

`src/lib/bootFailure.ts`

- Added `DATABASE_UNAVAILABLE_MESSAGE = 'The local database is unavailable — changes may not be
  saved.'`. `STORAGE_UNAVAILABLE_MESSAGE` was removed: after the fix below it had no remaining
  consumers.

`src/App.tsx`

- The `ensureDbOpen()` rejection now reports `DATABASE_UNAVAILABLE_MESSAGE` instead of
  `STORAGE_UNAVAILABLE_MESSAGE`, so an unavailable IndexedDB (private mode, storage
  partitioning) no longer tells the user to fix the wrong API. The message is still shown only
  when `ensureDbOpen()` actually rejects (persistence genuinely unavailable).

`src/hooks/useTheme.ts`

- Both `settingsRepo.get/merge` catch blocks (`:20` and `:39`) now report
  `DATABASE_UNAVAILABLE_MESSAGE`. `settingsRepo` is the Dexie/IndexedDB seam, so the earlier
  `STORAGE_UNAVAILABLE_MESSAGE` was wrong here too: it was the second surviving source of the
  U4 symptom (a blocked-IndexedDB, working-localStorage user still being told to fix "local
  storage"). Corrected per `verify-IMP-105.md`.

## IMP-104 — Digest time input no longer clips AM/PM

`src/features/settings/SettingsView.tsx`

- The daily-digest `<input type="time">` moved from `w-28` (112 px) to `w-36` (144 px).
  `w-28` left ~88 px after `px-3`, so Chromium rendered `08:00 A` with the clock icon over the
  truncated `M`. The `aria-label="Daily digest time"` was already present.

## IMP-105 — Header CTAs stay on one line at 390px

`src/features/goals/GoalsView.tsx`, `src/features/bills/BillsView.tsx`,
`src/features/habits/HabitsView.tsx`, `src/features/notes/NotesView.tsx`

- Each header changed from `flex items-center justify-between` to the Today pattern
  `flex flex-wrap items-center justify-between gap-3`, so the long subtitle can no longer
  squeeze the CTA: the CTA wraps to its own row instead of shrinking below its content.
- Each primary CTA (`New goal`, `New bill`, `New habit`, `Add note`) gained
  `whitespace-nowrap`, so its label can never break across two lines. (Notes has no header CTA;
  its `Add note` control lives in the capture card and received the same guard.)

## Tests

- `src/hooks/useTheme.test.tsx` (new) — mocks `settingsRepo.get` to reject, renders a probe
  component that calls `useTheme`, and asserts the resulting toast is
  `DATABASE_UNAVAILABLE_MESSAGE` with no "local storage" text; the resolving case toasts
  nothing. This replaces the earlier tautological `bootFailure.test.ts` case (which asserted the
  constant against itself).
- `src/hooks/useThemePersist.test.tsx` (new) — mocks `settingsRepo.merge` to reject, loads the
  theme, then changes it to trigger the persist path and asserts the same database-naming toast.
- `src/test/appBootFailure.test.tsx` (new) — mocks `ensureDbOpen` to reject and mounts `App`,
  asserting the call site toasts `DATABASE_UNAVAILABLE_MESSAGE`; the resolving case toasts no
  database failure.
- `src/features/headerCta.test.tsx` (new) — mounts Goals/Bills/Habits/Notes and asserts each
  header carries `flex-wrap` + `gap-3` and each CTA carries `whitespace-nowrap`.
- `src/features/settings/SettingsView.test.tsx` — asserts the digest input keeps its accessible
  name and a width class of `w-3x` (never `w-28`).

## Gates

`npm run typecheck && npm run lint && npm run test && npm run format:check` — all pass
(56 files, 577 tests).

## Visual verification

Built `dist/`, ran `npm run preview` on 4173, unregistered the service worker, deleted all
caches, reloaded from `about:blank`, then measured at 1280×800 and 390×844 in light and dark.

IMP-104 — digest time input:

| Viewport / theme | `scrollWidth` | `clientWidth` | fits | rendered |
| ---------------- | ------------- | ------------- | ---- | -------- |
| 390 light        | 142           | 142           | yes  | `08:00 AM` + clock, no overlap |
| 1280 light       | 142           | 142           | yes  | `08:00 AM` + clock, no overlap |
| 390 dark         | 142           | 142           | yes  | `08:00 AM` + clock, no overlap |
| 1280 dark        | 142           | 142           | yes  | `08:00 AM` + clock, no overlap |

IMP-105 — header CTAs at 390px (light): every CTA label resolved to exactly **one** text line
rect (Range `getClientRects().length === 1`), button heights stayed 32 px, and
`documentElement.scrollWidth` never exceeded the viewport:

| View | Header class | CTA | Label line rects | Button box |
| ---- | ------------ | --- | ---------------- | ---------- |
| Goals  | `flex flex-wrap items-center justify-between gap-3` | New goal  | 1 | 95×32 |
| Bills  | `flex flex-wrap items-center justify-between gap-3` | New bill  | 1 | 88×32 |
| Habits | `flex flex-wrap items-center justify-between gap-3` | New habit | 1 | 100×32 |
| Notes  | `flex flex-wrap items-center justify-between gap-3` | Add note  | 1 | 94×32 |

Goals/Bills now wrap the CTA onto its own row at 390px rather than clipping it; Habits keeps it
inline (short subtitle). Screenshots in `.improve/artifacts/IMP-105/`:
`IMP-104-digest-{390,1280}-{light,dark}.png`,
`IMP-105-{goals,bills,habits,notes}-390-light.png`, `IMP-105-goals-390-dark.png`,
`IMP-105-goals-1280-light.png`. Preview server stopped afterwards.

IMP-107 — U4 scenario re-run on the rebuilt bundle (`window.indexedDB` forced to `undefined` via
an init script, `localStorage` working): the only persistence toast is now
`The local database is unavailable — changes may not be saved.`; `document.body.innerText`
contains no "local storage" text, and the theme-path toast no longer appears. Artifact:
`verify-IMP-107-indexeddb-unavailable.png`.

## Notes

- Follow-up (per `verify-IMP-105.md`): IMP-107 was PARTIAL because `useTheme.ts` still emitted
  the "Local storage is unavailable" toast for Dexie failures. Both `useTheme` call sites now use
  `DATABASE_UNAVAILABLE_MESSAGE`, `STORAGE_UNAVAILABLE_MESSAGE` is gone, and the tautological
  constant-vs-itself test was replaced by render-based tests of the `get` and `merge` failing
  paths. IMP-104/IMP-105 are unchanged.
- No changes outside the three items' files plus the new/updated tests and the report.
- Not committed or pushed.
