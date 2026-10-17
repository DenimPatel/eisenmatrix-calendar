# IMP-054b — Test-gap closure

## Status

Done. Test-only change. `npm run typecheck`, `npm run lint` and `npm run test`
(33 files / 342 tests) pass. No commit; `.improve/FEATURES.md` untouched.

## Gap addressed

Verifier NOTE (§5): the existing jsdom round-trip test switched shopping → bill →
shopping and committed while `effectiveKind === parsed.kind`, so `QuickAdd` took the
`quickAddToItem` path and never called `quickAddDataFor`. It therefore passed on pre-fix
code and would not catch a revert of `QuickAdd.tsx:50`.

## Change

`src/features/quickadd/QuickAdd.test.tsx` — new test
`commits a changed kind with its own data and no shopping fields`:

- types `buy milk 2L #groceries` (parses as `shopping`),
- changes the kind select to `bill`,
- commits while on the changed kind (exercises the `quickAddDataFor` branch),
- loads the stored row from Dexie and asserts `kind === 'bill'`,
  `data` matches `{ amount: 0, currency: 'USD', payee: 'Milk' }`, and
  `data` has **no** `quantity`/`unit`.

The existing round-trip test is kept unchanged, so both AC-3 (restore on switch-back)
and the wiring of the changed-kind branch are covered in jsdom.

## Mutation check

Temporarily restoring the pre-fix commit line
`item.data = defaultDataFor(effectiveKind)` made the new test fail:

```
expect(item.data).toMatchObject({ payee: 'Milk' })
Received: { amount: 0, currency: 'USD', payee: '' }
```

Confirms the test now exercises the fixed branch. Production files were restored
afterward; `git diff` on `QuickAdd.tsx` shows only the original implementation diff
(the helper call, no `defaultDataFor` import).

## Verification

```bash
npm run typecheck && npm run lint && npm run test
# Test Files 33 passed (33) / Tests 342 passed (342)
```

Targeted: `npx vitest run src/features/quickadd/QuickAdd.test.tsx` — 4 passed.

## Notes

- The negative `quantity`/`unit` assertions document AC-2 for the shopping→bill path.
- Asserting `payee: 'Milk'` is what makes the test fail pre-fix; `amount` is `0` on both
  paths because the parse has no amount. A task→bill case (`gift $120`) would add a
  positive amount assertion but is not required here.
- No production behavior changed and no defect was exposed.
