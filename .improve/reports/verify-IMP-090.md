# Verify — IMP-090: Deep-normalize nested kind payloads

Independent skeptical review. Reviewer did not author the change. Source files unmodified
(throwaway probe `src/domain/__probeIMP090.test.ts` created and deleted).

## Verdict: PASS

All three acceptance criteria met; all gates green. Two non-blocking accuracy nits and
one self-disclosed follow-up recorded below.

## Change under review

- `src/domain/itemFactory.ts`: new private `mergeDefaults<T>(defaults, value)`; used by
  `createItem` and `normalizeItem` in place of the shallow `{ ...defaults, ...data }`.
- Tests: `itemFactory.test.ts` (+3), `repository.test.ts` (+1), `noDataRows.test.tsx` (+2),
  `stats.test.ts` (+2).
- `FEATURES.md` IMP-090 status TODO → DONE. Untracked `impl-IMP-090.md`,
  `discovered-IMP-090.md`.

No scope creep: no edits to `stats.ts`, `HabitsView.tsx`, `GoalsView.tsx` or
`KindFields.tsx`. That matches the item note ("prefer a small recursive defaults merge
over per-callsite guards"); the listed view/stat files are call sites, not required edits.

## Acceptance criteria

1. **Nested defaults complete after normalization — MET.**
   `mergeDefaults` recurses through plain-object defaults, so `{target:{count:2}}` →
   `{target:{count:2,per:'day'}, streak:{current:0,best:0,lastAt:null}}` and
   `{metric:{type:'numeric',current:3}}` keeps `type` over the `binary` default while
   filling `horizon`. Verified directly (`itemFactory.test.ts`, probe).
2. **`{target:null}`, `{target:{count:2}}`, `{metric:null}` render / stats don't throw — MET.**
   Repository reads run `normalizeItem` (`repository.ts:12`, consumed via
   `useData.ts:37` `itemRepo.all()`), so `HabitsView.tsx:127` (`data.target.per`) and
   `GoalsView.tsx:109` (`data.metric.type`) receive complete objects. `noDataRows.test.tsx`
   mounts both views on raw `db.items.bulkPut` rows and asserts `1× per day` / `2× per day`.
   `stats.ts` was already defensive (`?? {count:1,per:'day'}`, `?? {type:'binary'}`,
   `target.per ?? 'day'`), so its new tests are belt-and-braces rather than the fix; the
   fix is exercised by the repository and mount tests.
3. **Read-only; well-formed payloads byte-identical — MET (with one documented caveat).**
   `mergeDefaults` only reads its inputs and builds a fresh object; the repository test
   re-reads the raw rows via `db.items.get` and asserts them unchanged. Probe: for every
   `ITEM_KINDS`, `normalizeItem({kind, data: defaultDataFor(kind)})` serializes
   byte-identically to the input. Caveat below.

## Gates (all run on the reviewed tree)

```
npm run typecheck    PASS
npm run lint         PASS
npm run test         PASS  42 files / 471 tests
npm run format:check PASS
npm run build        PASS  (tsc + vite + PWA injectManifest)
```

## Edge cases probed (throwaway, deleted)

- **Arrays in an object-default slot** (`target:[1,2]`): `isPlainObject` rejects arrays →
  slot falls back to the default. No throw; result equals `defaultDataFor('habit')`.
- **Prototype pollution** (`JSON.parse('{"__proto__":…,"constructor":…}')`): the
  `if (!(key in merged))` guard skips inherited keys, so `__proto__`/`constructor` never
  land on the result; `Object.getPrototypeOf(out) === Object.prototype` and
  `({}).polluted` stays undefined. Safe.
- **`null` in a scalar-default slot** (`note.pinned: null`): survives as `null` (falsy at
  the call site). No crash.
- **`Date` in an object-default slot**: `isPlainObject(Date)===true` but `Object.entries`
  is empty → defaults win. No throw.
- **`createItem({data:{target:{count:3}}})`**: returns the completed payload (intended).
- **Explicit-`undefined` payload key** (`{unit:undefined}`): key is dropped rather than
  retained as an own property (self-disclosed in `discovered-IMP-090.md`); harmless
  through JSON/Dexie and equal under `toEqual`.

## Non-vacuous

Reverting to the shallow spread makes the new repository assertion (missing `per`/`streak`)
and the `noDataRows` assertion (`2× per undefined`, or a throw on the null-target row) fail.
The tests exercise the fix.

## Non-blocking findings

1. **"Byte-identical" is only guaranteed for default key order.** For a nested object whose
   payload key order differs from the defaults (e.g. `metric:{current,target,type}`), the
   merge re-emits `{type,current,target}` — value-identical but not byte-identical. Probe
   confirmed. App-produced payloads start from the defaults (`KindFields` spreads
   `normalized.data.metric`/`.target`) so no live payload reorders; the impl report already
   states "key order may differ". Criterion 3 wording is stricter than the guarantee.
2. **Doc comment overstates.** `mergeDefaults`'s comment says "`null` never survives in a
   slot that has a default", but `null` *does* survive a scalar default (it is only replaced
   when the default is itself a plain object). Behavior is fine; the comment is inaccurate.
3. **Self-disclosed follow-up** (`discovered-IMP-090.md`): `itemRepo.create/update/updateAtomic`
   return unnormalized write values (`updateAtomic` returns normalized `before` but raw
   `after`). No live consumer renders them today; same class as IMP-088 advisory #2.

None of these block the item.
