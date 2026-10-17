# Verify IMP-054b — test-gap closure

**Verdict: PASS.** Independent re-verification of the test-only follow-up on branch
`improve/auto-20261017` (base `ecf419f`, working tree only). I did not author the change.

## 1. Gap closure: the new test is not vacuous

`src/features/quickadd/QuickAdd.test.tsx:105-142` types `buy milk 2L #groceries`
(parses `shopping`), changes the kind select to `bill`, and commits while the select is
still `bill`. At commit `effectiveKind ('bill') !== item.kind ('shopping')`, so
`QuickAdd.tsx:48-51` takes the `quickAddDataFor` branch and asserts the persisted Dexie
row. Supersedes the prior NOTE at `verify-IMP-054.md:80-86`.

Mutation checks (production files restored after each; `git diff` re-confirmed identical,
`git diff --check` clean, Prettier clean):

| Mutation | Result |
| --- | --- |
| Restore pre-fix line `item.data = defaultDataFor(effectiveKind)` (plus import) | New test FAILS: expected `payee: 'Milk'`, received `payee: ''`. Other 3 tests pass. |
| Leak `data.quantity = parsed.quantity` into the bill payload | New test FAILS at `not.toHaveProperty('quantity')` (received 2). |

Both are the exact regressions of concern: reverting the wiring and reintroducing
incompatible fields are both caught. The two negative assertions
(`not.toHaveProperty('quantity'|'unit')`) are live guards, not decorative.
Targeted file passed 5 consecutive runs (no flake from the 50 ms settle wait).

## 2. Acceptance criteria 1–3 (re-check)

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. Compatible parsed fields carry over | **met** | `quickAddDataFor` overlays `quantity`/`unit` (shopping) and `amount`/`currency`/`payee` (bill); unit tests for both; jsdom now covers the changed-kind commit path (bill `payee`/`currency`). |
| 2. Incompatible fields are dropped | **met** | Payload rebuilt from `defaultDataFor(kind)` + compatible overlays only; unit negative assertions and the new jsdom negative assertions (mutation-verified above). |
| 3. Switching back restores parsed values | **met** | Payload is always derived from `parsed`, never from prior kind state; domain round-trip test (`shopping → bill → shopping`, `quantity === 2`) plus the jsdom round-trip test. The jsdom round-trip test still commits at `parsed.kind` (it alone would pass pre-fix), but AC-3 is covered by the helper test and by construction. |

## 3. Scope

Diff is limited to the four expected source files (production change unchanged from the
original IMP-054 diff: `quickadd.ts` +19/−1, `QuickAdd.tsx` +2/−3) plus `.improve/*`
orchestrator bookkeeping. The 054b run added only the +39-line jsdom test; no unrelated
production, schema, migration, repository, route, or dependency changes.

## 4. Gates (this run)

```
npm run typecheck  PASS
npm run lint       PASS
npm run test       PASS  33 files / 342 tests
npm run build      PASS  tsc + vite build; PWA injectManifest; 18 precache entries
npx prettier --check <4 changed files>  PASS
git diff --check   PASS
```

No browser matrix rerun (per instruction); prior browser evidence in
`verify-IMP-054.md` §4 remains valid and the changed branch is now covered in jsdom.

## 5. Residual (unchanged, non-blocking)

Pre-existing base-field normalization (`listId`, default recurrence) on kind switch is
still out of IMP-054 scope, as noted in `verify-IMP-054.md` §5.
