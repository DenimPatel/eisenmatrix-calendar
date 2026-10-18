# impl-IMP-084 — Remap `parentId` for every incoming item under the duplicate strategy

## Files
- `src/lib/backup.ts` (`mergeImportedItems`, +4 lines)
- `src/lib/backup.test.ts` (+2 cases in the existing `parentId remapping on duplicate` block)

## What changed
The `duplicate` strategy's non-colliding branch pushed the incoming item verbatim
(`toPut.push(item)`), so a **fresh-id** child whose `parentId` pointed at a **colliding**
parent kept the original id and silently re-attached to the live original parent instead of
the freshly duplicated one — the residual gap IMP-051 left (D1 of `discovered-IMP-051.md`).

The fall-through now widens the existing map lookup:

```ts
if (strategy === 'duplicate' && item.parentId && idMap.has(item.parentId)) {
  toPut.push({ ...item, parentId: idMap.get(item.parentId) ?? item.parentId });
  continue;
}
toPut.push(item);
```

The guard is `strategy === 'duplicate'`, so `skip`/`overwrite` still push the input object
**by reference** and are byte-identical (AC3). The `?? item.parentId` fallback mirrors the
colliding branch's defensive style (the `idMap.has` check makes it unreachable). `idMap` is
still built only for colliding ids (`!idMap.has` policy untouched), so a parent whose id
appears twice in one payload resolves to a single canonical target (AC4) and a parent that
is in the payload but not colliding keeps its id (AC2). No caller changes needed:
`SettingsView` consumes `toPut` wholesale through `itemRepo.createMany`.

## Acceptance criteria
1. *`parentId` rewritten for every incoming item whose `parentId` resolves in `idMap`* — yes.
   New test **"repoints a fresh-id child at the duplicated parent"**: existing `[p]`, incoming
   `[p, new-c(parentId:'p')]`, `duplicated === 1`; the fresh child keeps id `new-c` while its
   `parentId` equals the duplicated parent's new id and is `!== 'p'`.
2. *Fresh-id child whose parent is not in the incoming set keeps its `parentId`* — unchanged;
   pre-existing **"keeps the original parentId when the parent is not in the incoming set"**
   and **"keeps the parentId when the incoming parent is not itself duplicated"** still pass
   (`idMap.has` is false in both).
3. *`skip`/`overwrite` byte-identical* — unchanged code path; pre-existing
   **"leaves skip and overwrite parentIds untouched"** plus the fuzz identity/serialization
   oracle below.
4. *A twice-present parent id still resolves to one canonical target* — new test
   **"resolves a parent that appears twice in the payload to one canonical target"**: incoming
   `[p, p-again, new-c]` with `p` colliding; `duplicated === 2`, the fresh child's `parentId`
   is the single shared new id, and no output `parentId` equals `'p'`.

## Verification
- **Differential fuzz (60 000 cases, seeded PRNG, temp harness removed afterwards).** Old
  (`git show HEAD:src/lib/backup.ts`, `newId` stubbed) vs new over 20 000 randomized
  `(existing, incoming, strategy)` triples × 3 strategies, generating colliding/fresh/ghost
  ids, null/in-set/out-of-set/self-referencing `parentId`, and duplicate ids per payload.
  Oracles: counters + `toPut.length` equal; `skip`/`overwrite` `JSON.stringify` equal **and**
  element object identity preserved; `duplicate` id remapped iff colliding, `parentId` equal
  to the referenced colliding parent's real new id when in `idMap` else unchanged, and all
  other fields identical (spread fidelity). **Result: 0 problems.**
- **Mutation check:** restored HEAD `src/lib/backup.ts` and ran `src/lib/backup.test.ts` →
  exactly the 2 new tests fail (20 pass); fix re-applied.
- **Gates (all PASS):** `npm run typecheck`, `npm run lint`, `npm run test` (43 files / 486
  tests, +2), `npm run format:check`. Prettier reported no reformat of `backup.ts`.

No Playwright pass: `mergeImportedItems` is a pure function and the merged output is fully
determined by it (REPO_PROFILE §4 — data/domain logic needs Vitest only). No `build` run:
lib-only change; `typecheck` is the same `tsc --noEmit` gate, and the profile only requires
`build` for UI features.

## Uncertainties
- Read AC1's "resolves in `idMap`" exactly as the spec states: only a **colliding** parent is
  remapped. A parent present in the payload but not colliding keeps its id, so the reference
  is already valid.
- `idMap.get(...) ?? item.parentId` is typed as `string | null` only because `Map.get`
  returns `string | undefined`; the `??` is unreachable given the `idMap.has` guard.
- Item status left `TODO` in `FEATURES.md` (precedent: `impl-IMP-051.md`), nothing committed.
