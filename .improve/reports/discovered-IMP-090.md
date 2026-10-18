# Discovered — IMP-090

Unrelated findings noticed while implementing IMP-090:

- **`itemRepo` write-return values are still unnormalized.** `create` returns the
  caller's `item`, `update`/`updateAtomic` return the raw `mergeItem` result, and
  `updateAtomic` returns a *normalized* `before` but a *raw* `after` (a direct
  inconsistency). No current caller renders those return values, so this is not
  a live defect, but a future consumer could receive a partial nested payload.
  Same class as IMP-088 advisory #2; a one-line `readItem(...)` on the returns
  would close it.
- **`mergeDefaults` drops explicitly-`undefined` payload keys.** The previous
  shallow spread kept an own property with value `undefined`; the recursive merge
  omits such keys (they carry no value through JSON/Dexie anyway). Harmless, but
  the object shape differs from the old spread for `{ unit: undefined }`-style
  patches.
