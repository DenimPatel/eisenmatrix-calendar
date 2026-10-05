# discovered-IMP-051

Findings noticed while implementing IMP-051 (remap `parentId` when duplicating imported
items). None are regressions introduced by that change; all were either pre-existing or are
semantic gaps the item's acceptance criteria did not cover.

## D1 — A non-duplicated incoming child does not follow its duplicated parent

**Severity:** low · **Type:** residual gap (pre-existing)

Under `duplicate`, only *colliding* items get a new id. An incoming child with a **fresh**
id whose `parentId` points at a **colliding** parent is written unchanged, so it attaches to
the *live original* parent instead of the freshly duplicated one.

Repro shape:
- existing DB: `p` ("Parent")
- incoming: `p` ("Parent v2") + `new-c` ("Child", `parentId: 'p'`)
- `mergeImportedItems(existing, incoming, 'duplicate')` →
  - `p` → new id `P'`
  - `new-c` → written verbatim with `parentId: 'p'` (the live original)

This is unchanged from before IMP-051 (the old code also only reassigned `id`), so it is not
a regression. IMP-051 AC1 scoped the rewrite to "every duplicated item", so I left it alone
rather than widen the change. A future item could remap `parentId` for **all** incoming items
whenever `parentId` resolves in `idMap`, which would make the whole imported subtree
self-consistent regardless of which members collided.

## D2 — An incoming set containing the same id twice collapses to one row

**Severity:** low · **Type:** behavior change for malformed input

The new `idMap` is keyed by original id with a `!idMap.has` guard, so two incoming entries
sharing one id both resolve to the **same** new id. `itemRepo.createMany` is `bulkPut`, so the
second write silently overwrites the first — one row instead of two.

Before IMP-051 each of the two entries got its own `newId()` and produced two rows. The
collapse is arguably the better answer (two rows claiming one identity is incoherent, and a
single canonical target is what `parentId` remapping needs), and nothing throws. But it is a
deliberate, unstated policy choice that belongs to whoever owns import semantics: the spec
never says which of two same-id rows should win, nor which id its children should point at.
`parseBackup` does not dedupe incoming ids, so a hand-edited or concurrently-written backup
file can reach this path.

## D3 — Nothing validates `parentId` on import

`parseBackup` filters items on `'id' in i` only; `normalizeItem` (`itemFactory.ts:102`)
defaults `parentId` to `null` when absent but never checks that the referenced id exists in
the same payload. So a backup with a dangling `parentId` imports as a top-level-looking item
whose invisible parent reference points nowhere. The UI renders children via `parentId`
lookups, so these simply appear unattached. Pre-existing and independent of the duplicate
strategy.

## Verification notes

D1 and D2 were confirmed by reading `mergeImportedItems` post-change and
`itemRepo.createMany` (`src/db/repository.ts:49-51`, `bulkPut`). D3 from
`parseBackup` (`src/lib/backup.ts:35-50`) and `normalizeItem` (`src/domain/itemFactory.ts:102`).
No new backlog items proposed from these — they are cosmetic/consistency edges on malformed or
unusual input, and each would need a product decision rather than a mechanical fix.