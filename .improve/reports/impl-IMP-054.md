# IMP-054 — Preserve parsed quick-add data when the kind is changed

## Status

Implemented. `npm run typecheck`, `npm run lint` and `npm run test` (33 files / 341 tests) pass.
Not committed; `.improve/FEATURES.md` status untouched.

## What changed

### `src/domain/quickadd.ts` — new pure helper `quickAddDataFor(kind, parsed)`

Builds the data payload for a target kind from `defaultDataFor(kind)` and overlays only the
parsed fields that kind understands:

- `shopping` ← `quantity`, `unit`
- `bill` ← `amount`, `currency`, `payee` (from the parsed title, matching `quickAddToItem`)
- every other kind keeps only its defaults, so incompatible fields are dropped.

Because the payload is always derived from the original parse rather than from the previous
kind's data, switching kind and switching back restores the parsed values.

### `src/features/quickadd/QuickAdd.tsx` — commit path

The kind-override branch now calls `quickAddDataFor(effectiveKind, parsed)` instead of
`defaultDataFor(effectiveKind)`; the `defaultDataFor` import was removed. Same-kind commits keep
using the `quickAddToItem` payload (which also handles payee/default recurrence).

## Tests

- `src/domain/quickadd.test.ts`: three cases for the helper — shopping fields survive and are
  absent from task data; bill fields survive and are absent from shopping data; a
  shopping → bill → shopping round-trip retains `quantity === 2` and `unit === 'l'`.
- `src/features/quickadd/QuickAdd.test.tsx`: jsdom integration test types `buy milk 2L
  #groceries`, switches the kind select to `bill` and back to `shopping`, commits, and asserts
  the stored row is `shopping` with `quantity === 2` and `unit === 'l'`.

## Verification

```bash
npm run typecheck && npm run lint && npm run test
# Test Files 33 passed (33) / Tests 341 passed (341)
```

## Uncertainty / notes

- The helper carries `payee` for bills in addition to the required `amount`/`currency`, matching
  `quickAddToItem`; this is the only field beyond the acceptance criteria.
- No browser run was performed; the jsdom test exercises the same commit path end-to-end,
  including the Dexie write.
- Adjacent (not fixed, logged in `discovered-IMP-054.md`): the item's `recurrence` is still
  derived from the parsed kind, so a parsed habit switched to a task keeps a daily rule.
