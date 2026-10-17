# IMP-062 — Implementation report

**Status:** implemented — all gates pass; `.improve/` state files untouched.

## Files changed

| File | Change |
| --- | --- |
| `src/domain/quickadd.ts` | `splitNoteDraft` normalizes `\r\n` and lone `\r` to `\n` with `text.replace(/\r\n?/g, '\n')` before splitting. Only `splitNoteDraft` changed; no other parser behavior touched. |
| `src/domain/quickadd.test.ts` | Added two tests in the existing `describe('splitNoteDraft')`: CRLF with a trailing newline asserting `title === 'Buy milk'`, no `\r` in `notes`, and exact equality with the LF equivalent; mixed line endings (`\r\n`, `\n`, lone `\r`) asserting normalized output and no `\r` in title + notes. |

## Acceptance criteria

1. Splitting happens after normalization, so no stored `title`/`notes` value can contain `\r`.
2. `"Buy milk\r\nCall mum\r\n"` equals `"Buy milk\nCall mum\n"` exactly (test asserts `toEqual`).
3. The `NOTE_TITLE_MAX` overflow split is unchanged after normalization; the existing long-line and exact-cap tests still pass, so no characters are lost.

## Validation

- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS, 41 files / **427** tests (baseline 425 + 2 new)
- `npm run build` — PASS (vite build + injected service worker)
