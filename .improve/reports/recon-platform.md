# Recon — PLATFORM & DATA LAYER

Area: `src/db`, `src/store/useUiStore.ts`, `src/hooks`, `src/lib`, `src/components/ui`,
`src/pwa`, `src/types`, `src/styles/index.css`, `App.tsx`, `main.tsx`, `src/test`.
Baseline: `npm run typecheck`, `npm run lint`, `npm run test` (49 tests) all pass.

1. **HIGH — `removeWithChildren` only deletes direct children, orphaning grandchildren.**
   `src/db/repository.ts:58-64` collects `i.parentId === id` once; no recursion. Deleting a
   parent task leaves nested subtasks behind (still rendered via `useItems`, no parent).
   Fix: walk descendants (BFS loop) or index `parentId` and delete transitively.

2. **HIGH — Reminder dedupe can double-fire; no unique constraint and no in-flight guard.**
   `reminderLogRepo.record` uses `add` (`src/db/repository.ts:155-157`) against a
   non-unique `[itemId+occKey]` index (`src/db/schema.ts:36`); `wasFired` is a separate
   read (`repository.ts:148-154`). `ReminderRuntime.tick` runs on a 60s interval and can
   overlap/batch, and React StrictMode double-invokes effects (`ReminderRuntime.tsx:62-85,123-124`).
   Two concurrent checks both see "not fired" → duplicate notification.
   Fix: make the compound index unique and insert-then-catch, or serialize with a `ticking` flag.

3. **HIGH — No error handling around IndexedDB; failures are unhandled rejections / blank UI.**
   `App` fires `runLegacyMigration()` and `setupPWA()` with `void` and no `.catch`
   (`src/App.tsx:27-31`); there is no error boundary anywhere (`src/main.tsx`, `App.tsx`).
   Blocked storage (Safari private mode), quota exhaustion, or a corrupt DB crash the boot.
   Fix: try/catch + a top-level error boundary and a persisted "storage unavailable" state.

4. **HIGH — Settings use read-modify-write on one `app` row from two writers; races clobber fields.**
   `useTheme` reads then writes `{...settings, theme}` (`src/hooks/useTheme.ts:30-35`) while
   `SettingsView.persist` reads `useSetting('app')` then writes `{...settings, ...patch}`
   (`src/features/settings/SettingsView.tsx:59-61,179-219`). A theme change concurrent with a
   digest/notification change can drop one side. Fix: per-key settings, or a Dexie
   `table.update`/`modify` merge instead of whole-object `put`.

5. **MED — `notificationsEnabled` setting is write-only dead config.**
   Written at `SettingsView.tsx:150`, declared/defaulted at `src/types/settings.ts:14,23`, but
   never read; `ReminderRuntime` only consults raw permission (`ReminderRuntime.tsx:11,170`,
   `notifications.ts:3-12,30`). The "Device notifications" toggle has no effect.
   Fix: gate delivery on the setting or remove the toggle/field.

6. **MED — Snooze permanently appends an `absolute` reminder and never cleans it up.**
   `ReminderRuntime.tsx:143-153` does `reminders: [...item.reminders, { absolute: ... }]`.
   Every snooze grows `item.reminders` forever and the entries show in the editor.
   Fix: store a single snooze field or prune expired absolute reminders on load.

7. **MED — Notification action buttons (Done/Snooze) are no-ops when the app is closed.**
   `src/pwa/sw.ts:39-41` calls `clients.openWindow('./')` and drops the `itemId/occKey/action`
   payload; the `OPEN_ITEM` message is only delivered when a window already exists
   (`sw.ts:34-38`, handled `ReminderRuntime.tsx:130-158`). Also only `windowClients[0]` is
   notified. Fix: encode the action in the opened URL/deep-link or persist it before opening.

8. **MED — Backup import accepts arbitrary JSON without validation.**
   `parseBackup` never checks `app`/`version` and line 43's `if (!Array.isArray(items))` is
   unreachable (items is always an array by then) (`src/lib/backup.ts:35-50`).
   Fix: validate `app === 'eisenmatrix'` and item shape; delete the dead check.

9. **MED — Duplicate-import strategy only rewrites `id`, leaving parent/child links dangling.**
   `mergeImportedItems` clones `{...item, id: newId()}` (`src/lib/backup.ts:85`) without remapping
   `parentId` (or checklist/history ids), so duplicated subtasks point at the original parent.
   Fix: build an id map and rewrite `parentId` on the clone.

10. **MED — JSON backup lists overwrite existing lists regardless of import strategy.**
    `SettingsView.tsx:104` calls `listRepo.createMany(parsed.lists)` which upserts by id; the
    chosen skip/overwrite/duplicate strategy is ignored for lists. Fix: apply the same merge.

11. **MED — "Reset all data" leaves settings, snapshots, legacy marker and localStorage backup.**
    `SettingsView.tsx:137-141` clears only items/lists/reminderLog. `backups`, the `app`
    settings row, `migration.legacy`, and `eisenmatrix-tasks.v1.bak` survive. Misleading.
    Fix: clear backups/settings and reset the marker, or relabel the action.

12. **MED — ICS `UNTIL` is emitted as UTC date-time for all-day (DATE) events.**
    `recurrenceToRRule` always appends `T235959Z` (`src/lib/ics.ts:44-48`), but RFC 5545
    requires `UNTIL` to match the `DTSTART` value type; with `DTSTART;VALUE=DATE` this is
    invalid and, because local fields are tagged `Z`, can shift the day. Fix: emit a bare
    date for all-day rules.

13. **MED — ICS export does not fold lines at 75 octets.**
    `itemsToICS` joins raw lines (`src/lib/ics.ts:88-117`); long `SUMMARY`/`DESCRIPTION`
    (or multi-line notes) produce non-compliant content that importers may reject.
    Fix: add RFC 5545 line folding (and an all-day `DTEND`).

14. **MED — Dialog/Sheet accessibility gaps.**
    `Sheet` sets `role="dialog" aria-modal` with no accessible name (`src/components/ui/Sheet.tsx:50-59`);
    `Dialog` uses `aria-label={title}` which is `undefined` when only `description`/children are
    given (`src/components/ui/Dialog.tsx:63`). Fix: `aria-labelledby` on a real title node with a
    labelled/described fallback.

15. **MED — Body scroll lock is not refcounted across overlays.**
    Each of `Dialog` (`Dialog.tsx:43-47`) and `Sheet` (`Sheet.tsx:34-38`) sets `overflow:'hidden'`
    and restores `''` on close. Opening an editor sheet plus a confirm dialog then closing one
    re-enables background scroll while the other is still open; nested focus traps also compete.
    Fix: shared scroll-lock with a counter; allow a second trap to own focus.

16. **MED — `useFocusTrap` can focus hidden elements / container without tabindex.**
    `focusFirst` uses `focusable[0]` without the `offsetParent !== null` filter the Tab handler
    applies (`src/hooks/useFocusTrap.ts:14-17,22-24`), so focus may land on a hidden control;
    `container.focus()` is a no-op without `tabindex`. Fix: reuse the visible filter and set
    `tabindex="-1"` on the container.

17. **MED — Reminders are marked fired even when only an unseen toast is shown.**
    `deliver` records the log unconditionally after `showAppNotification` returns false
    (`ReminderRuntime.tsx:41-46`), e.g. permission denied or backgrounded tab. The user can
    permanently miss the reminder. Fix: only record when a notification was actually shown
    (or the document is visible).

18. **MED — Migration is not atomic and re-runs can overwrite user edits.**
    Backup, `bulkPut`, and marker write are sequential, not in a transaction
    (`src/db/legacyTasks.ts:228-254`); Settings exposes a re-run (`SettingsView.tsx:126-135`).
    Re-running after editing migrated items upserts the original v1 snapshot over them.
    Fix: wrap in one `db.transaction` and skip ids that already exist on re-run.

19. **LOW — `useItems` returns a fresh array each render, defeating downstream memoization.**
    `useData.ts:5-9` filters inline; `useOccurrences` memo depends on the `items` identity
    (`src/hooks/useOccurrences.ts:8-18`), so calendar/occurrence expansion recomputes every
    render. Fix: wrap the filter in `useMemo`.

20. **LOW — Backup prune runs before import completes and can drop data after a failed import.**
    `legacyTasks.ts:234-245` prunes backups to 10 before `items.bulkPut` (`:245`); a later failure
    leaves the newest backup pruned. Fix: prune after a successful import, in the transaction.

21. **LOW — Dead code / unused exports.**
    `backupRepo.prune` never called (`repository.ts:180-184`); `resetDbInstance` unused
    (`schema.ts:50-52`); `db` singleton export only used by tests (`schema.ts:54`);
    `sendSkipWaiting` unused (`notifications.ts:55-59`); `clearUndo` unused
    (`useUiStore.ts:130`); `defaultView` setting unread (`types/settings.ts:15,24`);
    `SettingsKey` type unused and fields wrong (`legacyCount` vs migration's `count`)
    (`types/settings.ts:27-30` vs `legacyTasks.ts:247-254`). Fix: delete or wire up.

22. **LOW — Undo stack off-by-one cap.**
    `pushUndo` slices `-24` then appends → up to 25 entries (`useUiStore.ts:116-119`).
    Fix: `slice(-23)` or slice after push.

23. **LOW — Toast timers are never cleared.**
    `pushToast` schedules `setTimeout` (`useUiStore.ts:108-110`); manual dismiss/unmount does
    not cancel it. Harmless (dismiss is idempotent) but leaks timers/tests. Fix: track and clear.

24. **LOW — `undo()` rejections are unhandled.**
    Keyboard handler does `void undo().then(...)` with no `.catch` (`useKeyboardShortcuts.ts:35-37`);
    any action closure failure becomes an unhandled rejection. Fix: catch and toast an error.

25. **LOW — `Tabs` lacks `type="button"` and keyboard support.**
    `src/components/ui/Tabs.tsx:19-34` renders bare buttons; inside a form they submit, and
    `role="tab"` has no arrow-key/roving-`tabindex` behavior or `aria-controls`/tabpanel wiring.

26. **LOW — Hardcoded colors contradict the token guidance.**
    `Toggle` knob uses `bg-white` (`src/components/ui/Form.tsx:78`); `labels.ts:58-75` hardcodes
    slate/emerald/sky. Mostly cosmetic but breaks the "semantic tokens only" rule.

27. **LOW — CSV parser accepts a quote mid-field as opening a quoted field.**
    `parseCSV` only checks `char === '"'` outside quotes (`src/lib/csv.ts:54-58`), not that the
    field is empty; `abc"def` mis-parses. `csvToItems` also casts `kind` without validation
    (`csv.ts:124-164`). Fix: only open quotes at field start; validate kind against `ITEM_KINDS`.

28. **LOW — `timestampedName` uses `toISOString()` (UTC) for the filename day.**
    `src/lib/backup.ts:127` can produce yesterday/tomorrow's date for non-UTC users; guidance
    says use local `formatISODate`. Fix: use local date formatting.

29. **LOW — PWA registration/net details.**
    `sw.ts:9-11` install listener with empty body is dead; `showAppNotification` calls
    `getRegistration()` without a scope (`notifications.ts:33`); icons are SVG-only (192/512)
    which some installers (iOS) ignore. Fix: drop the no-op listener, scope the lookup, add PNG icons.

30. **LOW — Test coverage gaps in this area.**
    No tests for `useTheme`, `useFocusTrap`, `useKeyboardShortcuts`, `useData`, `useUiStore`,
    `pwa/notifications`, `ReminderRuntime`, `components/ui`, or `repository.updateMany` /
    `setArchived` edge paths. `vitest.config.ts:12` only includes `src/**/*.test.*`; none exist
    for those modules. Fix: add unit tests for hooks/store and reminder dedupe.

## Notable strengths

- Clean repository seam (`src/db/repository.ts`) is the only Dexie consumer; UI uses `useLiveQuery`
  wrappers (`src/hooks/useData.ts`) and mutations flow through `itemActions`.
- Migration is idempotent, always backs up raw v1 payload to IndexedDB and localStorage, and is
  well covered by tests mapping all four `completionHistory` key formats.
- `src/lib/date.ts` is genuinely local-safe (no `toISOString` for keys), fixing the v1 off-by-one.
- Typed discriminated `Item` union with stable lowercase slugs; labels isolated in `labels.ts`.
- PWA uses `injectManifest` with a prompt-based update flow and a runtime notification fallback.
- Semantic CSS-variable tokens + dark mode + reduced-motion handling in `styles/index.css`.
- `typecheck`, `lint`, and all 49 tests pass from a clean checkout.
