# impl-IMP-051 — Remap `parentId` when duplicating imported items

## Files
- `src/lib/backup.ts` (`mergeImportedItems`, `:61-104`)
- `src/lib/backup.test.ts` (4 new cases inside a `parentId remapping on duplicate` block)

## What changed
`mergeImportedItems`' `duplicate` branch previously did `toPut.push({ ...item, id: newId() })`
and left `parentId` pointing at the original. A duplicated subtask/milestone was therefore
either orphaned or silently re-attached to the live original parent.

Now, when `strategy === 'duplicate'`, a **pre-pass** builds `idMap: original id → new id` for
every incoming item whose id collides with an existing row, and the duplicate branch rewrites
both fields:

```ts
toPut.push({
  ...item,
  id: idMap.get(item.id) ?? newId(),
  parentId: item.parentId ? (idMap.get(item.parentId) ?? item.parentId) : item.parentId,
});
```

The pre-pass is required (not just nicer): incoming order is arbitrary, so a child whose
parent appears *later* in the payload must still resolve to the parent's new id. One-pass
mutation cannot express that.

`idMap` is only populated for `duplicate`; `skip` and `overwrite` never read it, so their
code paths and outputs are byte-for-byte unchanged. The `?? newId()` / `?? item.parentId`
fallbacks keep the function total if the two passes ever disagree (defensive, currently
unreachable).

`SettingsView.tsx:102-122` needed no change — it consumes `toPut` wholesale through
`itemRepo.createMany`, so the remapped `parentId` lands in the database with no caller-side
work.

## Acceptance criteria
1. *Id map built for `duplicate`; every duplicated item's `parentId` rewritten when its parent
   is in the incoming set* — yes. Asserted by **"repoints a duplicated child at the duplicated
   parent"** (`dupChild.parentId === dupParent.id`) and **"repoints when the child precedes the
   parent in the incoming array"**, which is the case a single-pass fix would miss. Both also
   assert the new ids differ from the originals.
2. *Parent not in the incoming set ⇒ original `parentId` kept* — yes, two cases: **"keeps the
   original parentId when the parent is not in the incoming set"** (`parentId: 'live-parent'`,
   which is absent from the incoming array) and **"keeps the parentId when the incoming parent
   is not itself duplicated"** (parent present but not colliding, so its id is unchanged and
   the reference stays valid).
3. *`skip`/`overwrite` unchanged* — yes, covered by **"leaves skip and overwrite parentIds
   untouched"** (`skip.toPut` empty; `overwrite.toPut` keeps ids `['p','c']` in payload order
   and `parentId: 'p'`), plus the pre-existing *"resolves import conflicts by strategy"*.

## Commands + results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (23 files, 180 tests; +4 new, no changes to existing expectations)
- `npm run build` — not run (lib-only change; profile §2 requires it for UI features, and
  `typecheck` is the same `tsc --noEmit` gate)

**Mutation check:** restored the pre-change `backup.ts` via `git show HEAD:` and re-ran
`npx vitest run src/lib/backup.test.ts` → the two AC1 repointing tests fail, the two AC2 /
AC3 guard tests still pass (as designed — they encode behavior that was already correct).
Fix re-applied afterwards; `git diff --stat src/lib/backup.ts` confirms +14/−1.

## Verification notes
Behavior is verified entirely by unit test — `mergeImportedItems` is a pure function and needs
no browser, matching REPO_PROFILE §4 ("Data / domain logic … add/run Vitest unit tests"). No
Playwright pass: the import UI surfaces this only after a file picker + strategy choice, and
the merged output is fully determined by the function under test.

## Uncertainties
- AC1's "parent is also in the incoming set" is read as *in the map*, i.e. only a **colliding**
  parent is remapped. A parent that is in the payload but not duplicated keeps its id, so
  `parentId` needs no change — covered explicitly by the second AC2 test.
- An incoming payload containing the same id twice now collapses to a single row (the `idMap`
  key is reused) where it previously produced two. `bulkPut` makes this silent, not an error,
  and the incoming ids are incoherent anyway. Logged as D2 in
  `.improve/reports/discovered-IMP-051.md`, along with D1 (a fresh child of a duplicated parent
  still attaches to the live original) and D3 (no `parentId` existence validation on import).
- Item left **TODO** in `FEATURES.md`; nothing committed.