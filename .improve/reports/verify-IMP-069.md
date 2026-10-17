# Verify IMP-069 — Make editor-created items undoable

**Verdict: PASS.** All four acceptance criteria hold. The create branch of `saveItem` now
pushes the same `Create “<title>”` undo entry as `createItemPersisted`, its closure actually
removes the row from IndexedDB, the edit branch still pushes exactly one `Edit “<title>”`
entry, and `{ silent: true }` still gates only the toast. Verified through the shipped unit
tests, a full browser sequence on the production preview build (`N` → title → Save →
`⌘Z`), and an edit-then-undo sequence that proves there is no duplicate edit entry.

Reviewer: independent (did not author the change). Working tree only; branch
`improve/auto-20261017`, base `cc609a4`. The change is 3 source lines in
`src/domain/itemActions.ts` plus 38 test lines in `src/domain/itemActions.test.ts`. No
other source files are modified.

---

## 1. Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. Create branch pushes a `Create “<title>”` entry whose closure removes the new row | **met** | `src/domain/itemActions.ts:85-87`: `pushUndo(\`Create “${item.title}”\`, async () => { await itemRepo.remove(item.id); })`. Byte-for-byte the same label/closure shape as `createItemPersisted` (`:62-64`). `itemRepo.remove` is `items.delete` through the repository seam. |
| 2. Undo after an editor create removes the IndexedDB row and restores the previous stack depth | **met** | Unit test `pushes a single create entry whose undo removes the new row`: stack goes 1 → 2 → 1, top is `Create “New task”`, `itemRepo.get(id)` is `undefined` afterwards, prior entry is back on top. Browser: `N` → “Undo me” → Save → `Meta+z`; the card vanished and `indexedDB` `items` count went to **0**. |
| 3. Edit branch keeps its `Edit “<title>”` entry; `silent` suppresses only the toast | **met** | Edit branch untouched (`:89-93`); toast gate is a single trailing `if (!options?.silent) toast(...)` (`:94`), after both branches. Unit test `{ silent: true }` asserts the create entry is present **and** `toasts === []`. |
| 4. Saving an existing item does not push two entries | **met** | `existing` is a single boolean and the create/edit blocks are mutually exclusive; the create `pushUndo` lives only in the `else`. Unit test asserts the exact stack `['Edit “Renamed”']`. Browser: create → edit → one `⌘Z` restored the previous title while the row stayed; the next `⌘Z` removed it, i.e. exactly `create + edit`, no duplicate. |

No acceptance criterion is weakened or reinterpreted.

## 2. Code review

```diff
   } else {
     await itemRepo.create({ ...item, updatedAt: Date.now() });
+    pushUndo(`Create “${item.title}”`, async () => {
+      await itemRepo.remove(item.id);
+    });
   }
```

- The label uses the same Unicode quotes and exact template as `createItemPersisted`
  (`itemActions.ts:62`), so the undo entry is indistinguishable from a quick-added create —
  which is precisely the intent.
- Persistence still goes through `itemRepo`; no direct Dexie, no store internals, no new
  dependency, no schema/migration change.
- The edit path is not refactored, so its snapshot restore semantics (`itemRepo.create(existing)`,
  safe because `create` is `put`) are unchanged.
- `options.silent` remains a toast-only switch: `pushUndo` is not conditional on it in either
  branch.
- Failure ordering is unchanged: the undo entry is pushed after the write resolves, so a
  rejected `itemRepo.create` leaves no stale undo closure.

No debug leftovers (`console.`, `debugger`), no `.only`/`.skip`, no secrets, no new URLs, no
lockfile or dependency changes, no unrelated source edits. `git diff --check` is clean.

## 3. Tests and four gates

```
npm run typecheck   PASS  (tsc --noEmit, no diagnostics)
npm run lint        PASS  (eslint ., no output)
npm run test        PASS  32 files / 332 tests
npm run build       PASS  tsc + vite build; PWA injectManifest, 18 precache entries,
                          dist/sw.js emitted
```

The session baseline recorded in `.improve/STATE.md` is 329 tests; 332 = **+3**, matching the
three added cases exactly. There are no pre-existing gate failures on this branch (profile
§7: typecheck/lint/test/build all green at baseline), so there is nothing to separate. The
shipped `itemActions` file runs 36 tests green on its own. No test flakiness observed in the
full and focused runs.

The new tests are isolated correctly: the file's `beforeEach` already clears `items`, the
undo stack and toasts, so the three cases do not depend on each other or on execution order.

## 4. Browser verification (production preview)

Real build via `npm run preview` at `http://localhost:4173/eisenmatrix-calendar/`, real
IndexedDB, desktop viewport.

| step | result |
| --- | --- |
| Press `N`, type “Undo me”, click Save | editor closed, card rendered in Today's agenda |
| Press `Meta+Z` | card disappeared; IndexedDB `items` = **0 rows / `[]`** |
| Create “First title”, reopen, rename to “Second title”, Save, one `Meta+Z` | row still present with title restored to “First title” (single edit entry) |
| Second `Meta+Z` | row removed; `items` count **0** (create entry consumed exactly once) |
| Console during the whole pass | **0 errors, 0 warnings** (the single later warning was my own `deleteDatabase` call while the app held a connection) |

This is the item's stated UI verification and it passes end to end, not just in the unit
test.

## 5. Findings — none blocking

### 5.1 LOW / pre-existing UX edge — undoing a create does not collect pre-saved subtasks

Not an AC failure (AC 2 asks for the created row and the spec mandates the
`createItemPersisted` shape, which is also single-row), but worth recording because the new
undo entry makes it reachable with `⌘Z`.

The editor's `addChild` persists a subtask immediately while the parent draft is still
unsaved (`ItemEditorSheet.tsx:234-242`), and that call pushes its own create entry. After
saving the parent, the stack is `[create child, create parent]`; undoing the parent removes
only the parent, leaving a child with a dangling `parentId`.

Measured in the browser: `N` → “Parent task” → add subtask “Child task” → Save → `Meta+z`
leaves `[{ title: 'Child task', parentId: 'e368afe4-…' }]` in `items`. The second `⌘Z`
removes the child, so the stack itself is consistent. Root cause is the pre-existing
"persist children before the parent exists" behavior, not this diff; a future item could make
the create undo snapshot descendants (as `deleteItem` already does) or defer child
persistence until the parent is saved.

### 5.2 INFO — three lines duplicate `createItemPersisted`

The label/closure pair is intentionally identical to `createItemPersisted`. Extracting a
helper would remove the copy, but the diff is minimal, the spec asked for the same shape, and
a refactor would widen a low-risk change. Accept as-is.

### 5.3 NIT — `silent` + edit is argued by inspection, not a dedicated test

The silent test covers the create branch; the edit branch shares the same unconditional
`pushUndo` and the same trailing toast gate. A one-line follow-up assertion
(`saveItem(existing, { silent: true })` keeps `Edit “…”`) would pin it, but it is not an AC
gap.

## 6. Scope, conventions, hygiene

- Source diff is confined to the two files named by the item; `.improve/FEATURES.md` and
  `.improve/STATE.md` changes are orchestrator bookkeeping (status `IN-PROGRESS`), not code
  scope creep.
- Layering respected: domain → repository only; no direct Dexie, no localStorage, no store
  mutation beyond the existing `pushUndo` helper.
- IDs/labels unchanged; no persisted UI copy, dates or schema touched.
- No new dependency or lockfile edit; no generated `dist/` tracked; browser DB deleted and
  preview server stopped after verification.

## 7. Recommendation

**Ready to land** as-is. No required changes. Optional follow-ups: (1) collect or defer
subtasks so create-undo cannot orphan them (§5.1), (2) add the silent-edit assertion (§5.3).

## 8. Health deltas (suggested)

| Dimension | Current | Suggested | Rationale |
| --- | --- | --- | --- |
| Bugs/Correctness | 4 | 4 (+0.25) | One undo-integrity defect closed and covered; 19+ edge-case TODOs remain, not enough to round up. |
| UX/Interaction | 3 | 3 (+0.25) | `⌘Z` now behaves as users expect after an editor create; overlay/focus gaps untouched. |
| Tests/Tooling | 4 | 4 (+0.1) | Three write-path cases added, partially closing IMP-025's itemActions coverage gap. |
