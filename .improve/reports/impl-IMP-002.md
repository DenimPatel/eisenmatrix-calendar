# impl-IMP-002 — Delete deep descendants

## Files
- `src/db/repository.ts`: exported `collectDescendantIds(id)` BFS walker using the
  `parentId` index (`where('parentId').anyOf(frontier)`). Now tracks a `visited` set
  seeded with the root id, skips any id already seen (never traverses an id twice), and
  advances the frontier only with newly-visited children. This makes self-parent rows and
  parent/child cycles terminate and keeps the root from being returned as its own
  descendant. `removeWithChildren` still bulk-deletes the item plus all transitive
  descendants inside the existing single read-write transaction.
- `src/db/repository.test.ts`: retained the 4-level fixture plus unrelated pair, and added
  two regression tests:
  - self-parent (`s.parentId === 's'`) terminates and deletes only `s`;
  - a 2-node cycle (`a.parentId = b`, `b.parentId = a`) terminates and deletes both nodes.

## Approach
BFS by level with an indexed `parentId` lookup and a visited set. Helper remains exported
for reuse by IMP-003/IMP-004. No schema/migration changes.

## Round-2 fix (verify-IMP-002)
- Blocker resolved: `collectDescendantIds` no longer loops forever on self-parent or a
  two-node cycle; regression tests cover both cases (the verifier's throwaway repro is now
  a committed test).
- Minor: the `.improve/PROGRESS.log` line flagged as unrelated is confirmed to belong to
  IMP-001 (`2026-10-04T02:24Z | IMP-001 | done | a20b684`); left untouched as it is
  IMP-001's own log entry, not part of this item's code change.

## Commands + results
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS (11 files, 57 tests)

## Uncertainties
- IMP-003 needs descendant *items* (not just ids) for undo; it may want a sibling helper or
  reuse of `collectDescendantIds` + `itemRepo.get`/`query`. Flagged for that item.
