# verify-IMP-068 — Boot migration can no longer reject unhandled

**Verdict: PASS.** All four acceptance criteria met. The implementer's root-cause claim is
**independently confirmed**; the backlog item's own premise was wrong. The fix is a real fix, not
suppression. Two independent mutations are caught by the new tests.

Reviewer did not write this change. Repo: `/Users/denimpatel/Desktop/git/eisenmatrix-calendar`,
branch `improve/auto-20261003`, HEAD `75778cc`, node v25.6.1, npm 11.9.0, vitest 4.1.11.

---

## 1. The diff

```
 .improve/PROGRESS.log                 |  1 +
 src/App.tsx                           |  4 +++-
 src/db/migrations/legacyTasks.test.ts | 39 +++++++++++++++++++++++++++++++++++
 src/db/migrations/legacyTasks.ts      | 15 +++++++++++++-
 4 files changed, 57 insertions(+), 2 deletions(-)
```

Blob hashes at review time: `App.tsx b132d0d..cec6038`, `legacyTasks.ts 8b09bf9..39fde47`,
`legacyTasks.test.ts a1406c5..f56d72f` — byte-identical to the implementer's state before I began
mutation testing. Working tree restored to exactly that state at the end (verified by hash).

**Scope:** 3 source files, all named in `impl-IMP-068.md`. No scope creep. No unrelated changes.
No debug leftovers, no `TODO`/`FIXME`/`.only`/`.skip`/skipped suites, no `it.only`. No secrets, no
`.env` access, no lockfile or `dist/` edits. The only pre-existing dirt is the one-line
`.improve/PROGRESS.log` addition, which belongs to **IMP-050** (HEAD `75778cc`), not IMP-068 — see
§7.

**Style / conventions (`AGENTS.md`, `.improve/REPO_PROFILE.md` §5):**
- No new direct `localStorage`/`sessionStorage` use outside the legacy migration — the only
  non-test `localStorage` references repo-wide are the migration itself and comments:
  `rg -n "localStorage" src --glob '!*.test.*'` → `App.tsx:28` (comment), `types/item.ts:63`
  (comment), `legacyTasks.ts:205,207,210,211,214,218`.
- No new direct Dexie outside `src/db/`. `runLegacyMigration`'s signature and the `MigrationDeps`
  contract are unchanged; the new helper's return type is the existing `MigrationDeps['storage']`.
- Dependency direction preserved (`db` → leaf). Helper is module-private, not exported.
- Prettier clean: `npx prettier --check` on all 3 touched files → "All matched files use Prettier
  code style!".
- Comments explain non-obvious intent (the Node stub), which the convention permits.

---

## 2. Root-cause claim — VERIFIED CORRECT (the backlog item was wrong)

The backlog item asserts: *"In some runs the read happens after the test environment tears down,
producing an unhandled `storage.getItem` rejection."* **That premise is false.** There is no
teardown race. The read is unconditional and throws on **every** run.

### 2a. Node exposes a webstorage stub, not a `Storage`

```
$ node -v
v25.6.1

$ node -e "console.log('toString:', Object.prototype.toString.call(globalThis.localStorage));
           console.log('getItem:', typeof globalThis.localStorage?.getItem);
           console.log('setItem:', typeof globalThis.localStorage?.setItem);
           console.log('proto:', Object.getPrototypeOf(globalThis.localStorage)===Object.prototype ? 'Object.prototype' : '...')"
toString: [object Object]
getItem: undefined
setItem: undefined
proto: Object.prototype
(node:12411) Warning: `--localstorage-file` was provided without a valid path
```

Matches the report's quoted output exactly.

### 2b. Vitest does NOT replace it with jsdom's `Storage`

Instrumented probe (temporary test, since deleted) in **both** Vitest environments — default
`environment: 'node'` and the smoke test's `// @vitest-environment jsdom`:

| | `node` env | `jsdom` env |
|---|---|---|
| `typeof localStorage` | `"object"` (present) | `"object"` (present) |
| `Object.prototype.toString` | `[object Object]` | `[object Object]` |
| `typeof getItem` | `"undefined"` | `"undefined"` |
| `typeof setItem` | `"undefined"` | `"undefined"` |
| prototype `=== Object.prototype` | `true` | `true` |
| `localStorage instanceof window.Storage` | n/a | **`false`** |
| `window.Storage` | n/a | `"Storage"` (jsdom's real class) |
| `globalThis === window` | n/a | `true` |

So in the jsdom environment `window.Storage` is jsdom's genuine class, yet `window.localStorage` is
Node's bare stub and is **not** an instance of it. Vitest 4.1.11 does not overwrite it. The
implementer's claim on this point is exactly right.

### 2c. The throw site is real and was reached

`git show HEAD:src/db/migrations/legacyTasks.ts | sed -n '205,222p'`, line 15 of that window =
**line 219**:

```
219:   const raw = storage.getItem(LEGACY_STORAGE_KEY);
```

and the guard on line 209 was
`const storage = deps?.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);`
— which the truthy stub passes. The backlog's own `:219` reference is correct.

### 2d. End-to-end counterfactual: 1 rejection with the old code, 0 with the new

Temporary jsdom test mounting `<App />` exactly as `src/test/app.smoke.test.tsx` does, with
`process.on('unhandledRejection', …)`:

| Tree state | Result |
|---|---|
| **old** `legacyTasks.ts` guard + **old** `void runLegacyMigration()` | `rejections seen: 1 -> ["TypeError: storage.getItem is not a function"]` |
| **new** guard + **new** `.catch` (as reviewed) | `rejections seen: 0 -> []` |

Deterministic on every mount — this is not a race.

### 2e. Independent corroboration that only the *reporting* is flaky

With **all** IMP-068 changes reverted (`git stash`), `npm run test` ran twice and reported **0**
unhandled/error hits both times (173/173 passing) — while §2d shows the same code rejects on every
mount. So the defect reproduces 100% of the time at the promise level; Vitest's unhandled-error
collector is what intermittently fails to attribute it. This exactly reconciles the implementer's
claim with `.improve/reports/regression-10.md:45` and `verify-IMP-015.md:201`, and explains why prior
reviewers could not reproduce it on demand.

**Conclusion: the implementer's root-cause claim is correct and the backlog item's stated premise is
false.**

---

## 3. Criteria-by-criterion

### AC1 — Zero unhandled errors across ≥10 consecutive full-suite runs → **MET**

| Run | Exit | Result | `rg -ci 'unhandled\|Errors [0-9]+ error'` |
|---|---|---|---|
| 1–10 (`/tmp/imp068-verify/run-1..10.log`) | `0` each | `175 passed (175)` each | `0` each |

A recursive rescan of all 10 logs returned **ZERO MATCHES**. Grep negative control: the same pattern
family matches `passed` twice in run-1, so the zero is a true zero and not a broken pattern.

Also per the backlog's verification method, `--sequence.shuffle` ×4
(`/tmp/imp068-verify/shuffle-1..4.log`): exit `0`, `175 passed (175)`, 0 hits each.

### AC2 — Boot promise is awaited/caught or cannot reject → **MET**

- `src/App.tsx:29-31` — the only boot call site — now owns the promise:
  `void runLegacyMigration().catch((error: unknown) => { console.warn('Legacy v1 migration failed', error); });`
  This is AC2's first listed option (caught at the call site), and it is a belt-and-braces fix on top
  of the source fix. Verified only one boot call site exists:
  `rg -n "runLegacyMigration" src` → `App.tsx:22,29`, `SettingsView.tsx` (user-triggered,
  awaited in an `async` handler), tests.
- The throw itself is removed at source, so even a future unhandled caller cannot hit it.

### AC3 — Runs exactly once, result observable; existing tests stay green → **MET**

Unit level:
- `src/db/migrations/legacyTasks.test.ts` diff is **pure addition — 0 deletions** (39 `+`, no `-`).
  No existing assertion was edited, relaxed, skipped, or deleted. Tests are strictly stronger.
- All 4 pre-existing cases still pass: field mapping, full import + all four `completionHistory`
  key formats + both backups + marker, idempotent re-run, marker-when-nothing-to-migrate.
- Count delta verified independently: with all IMP-068 changes stashed → `173 passed (173)`;
  with the change → `175 passed (175)`. Exactly the 2 new cases, nothing else moved.

Real-browser level (Chromium via Playwright, against `npm run preview`):
```
after boot 1:  itemCount 2, backupRowCount 1, marker {version:1, completedAt:1791164504145, count:2}
after boot 2:  itemCount 2, backupRowCount 1, marker {version:1, completedAt:1791164504145, count:2}
```
Item titles unchanged (`V1 Browser Legacy Task`, `V1 Daily Habit`), backup row count still 1, and
`completedAt` **byte-identical** → the migration executed exactly once and the marker short-circuits
the second boot. Settings UI shows "Current migration version 1".

### AC4 — No user-facing behavior change → **MET** (real browser, not just unit tests)

Real Chromium at `http://localhost:4173/eisenmatrix-calendar/`:

```
localStorage: { getItem: "function", setItem: "function",
                tag: "[object Storage]", isStorage: true, ctor: "Storage" }
```
A real browser **does** have the `Storage` API, so `ambientLegacyStorage()` returns it and the
migration runs. Full reset (all IndexedDB deleted, `localStorage.clear()`), seeded a 2-task v1
payload, reloaded:

| Assertion | Observed |
|---|---|
| Items imported into `items` | `["V1 Browser Legacy Task", "V1 Daily Habit"]` |
| Daily recurrence + time expanded | card shows `V1 Daily Habit 08:00 Daily`; Overdue lists Oct 2, Oct 3 |
| Raw backup in IndexedDB | `{ reason: "legacy-v1-migration", payloadLen: 540 }` |
| Raw backup in `localStorage` | `eisenmatrix-tasks.v1.bak` present (`true`) |
| Settings flag written | `{ key: "migration.legacy", value: { version: 1, completedAt: …, count: 2 } }` |
| Settings Data line | `2 items · 0 lists · 1 local snapshots · backup format v2` |
| Console messages | **none** (no errors, no warnings) across both boots |

The guard is a **no-op in a real browser** — the capability check is satisfied, so behaviour is
unchanged.

---

## 4. Is it a real fix or suppression?

**It is a real fix.** Checked against all three failure modes:

- **Does not merely silence console output.** No `vi.spyOn(console, …)`, no `--silent`, no
  `onConsoleLog`/`onUnhandledError` hook, no `vitest.config.ts` change (`git status` shows
  `vitest.config.ts` untouched). The only added console write is one `console.warn` on the genuine
  error path. Vitest's reporting pipeline is untouched.
- **Does not swallow unrelated migration errors.** The `.catch` is scoped to the boot call site in
  `App.tsx`, and it **logs** rather than discarding. There is no `try`/`catch` inside
  `runLegacyMigration`; every Dexie read/write and every `storage.getItem`/`setItem` error still
  propagates out of the function to that handler and is reported. `deps?.storage` is read via `??`,
  so an explicitly injected storage still takes precedence and its errors behave as before.
- **Does not skip the migration when `localStorage` genuinely works.** The guard returns
  `localStorage` whenever `getItem` **and** `setItem` are functions, which is exactly the browser
  case. Proven three ways: (a) mutation §5b — forcing the helper to `undefined` fails the new
  ambient test; (b) unit test "falls back to the ambient localStorage and still records the marker"
  injects a full `Storage`-shaped object via the ambient path and asserts `migrated: true`,
  `items.count() === 5`, marker `version: 1`; (c) the real-browser run in §3 AC4 actually migrated.
- **Migration still writes its settings flag** — confirmed in unit tests and in the real browser
  (`count: 2`).

**The new capability check degrades safely.** A non-`Storage` global now takes the pre-existing
`{ migrated: false, count: 0, backupCreated: false }` early return at `legacyTasks.ts:225` — the same
path that already covered SSR and non-browser hosts — rather than throwing. Deliberate and correct:
there is no legacy data to read from a host with no web storage. It also writes **no** marker in that
case, so a later run on a host that *does* have working storage will still migrate (asserted by the
new test: `expect(await db.settings.get(LEGACY_MIGRATION_KEY)).toBeUndefined()`). That is the right
semantics — better than stamping the marker on a host that could not read anything.

---

## 5. Mutation checks

### 5a. Restore the old guard

```ts
-  const storage = deps?.storage ?? ambientLegacyStorage();
+  const storage = deps?.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
```
```
$ npx vitest run src/db/migrations/legacyTasks.test.ts
 ❯ src/db/migrations/legacyTasks.test.ts (6 tests | 1 failed)
   × ignores a localStorage global that lacks the Storage API instead of throwing 3ms
 FAIL  … > ignores a localStorage global that lacks the Storage API instead of throwing
TypeError: storage.getItem is not a function
 ❯ runLegacyMigration src/db/migrations/legacyTasks.ts:232:23
    232|   const raw = storage.getItem(LEGACY_STORAGE_KEY);
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```
**New test fails, with the exact predicted error.** 1 failed / 5 passed — matches the implementer's
reported mutation result.

### 5b. Force the ambient path to `undefined` (would "skip the migration when localStorage works")

```ts
 function ambientLegacyStorage(): … {
   …
-  return localStorage;
+  return undefined;
 }
```
```
$ npx vitest run src/db/migrations/legacyTasks.test.ts
   × falls back to the ambient localStorage and still records the marker 3ms
AssertionError: expected false to be true // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```
**Both new tests have teeth.** Neither is decorative, and together they pin both directions: the
ambient global must be used when it works, and must be ignored when it does not.

Tree fully restored afterwards — verified by blob hash (§1) and by re-running all four gates.

---

## 6. Full gate results (all run by the reviewer)

| Command | Exit | Detail |
|---|---|---|
| `npm run typecheck` | `0` | `tsc --noEmit`, no diagnostics |
| `npm run lint` | `0` | `eslint .`, no output |
| `npm run test` | `0` | `23 passed (23)` files, `175 passed (175)` |
| `npm run build` | `0` | `✓ built in 2.23s`, PWA `injectManifest`, `dist/sw.js`, `precache 18 entries (604.12 KiB)` |
| `npm run test` ×10 consecutive | `0` each | 175/175 each, 0 unhandled/errors (logs in `/tmp/imp068-verify/run-1..10.log`) |
| `npm run test -- --sequence.shuffle` ×4 | `0` each | 175/175 each, 0 unhandled/errors |
| `npm run preview` + Playwright | — | app boots, all 10 routes render, migration runs, 0 console messages |

Gates were re-run after all mutation testing; still `0/0/0/0`.

---

## 7. Issues

**No blocking issues.** Non-blocking observations:

1. **Bookkeeping deferred to the committer (expected).** `.improve/PROGRESS.log` has no `IMP-068`
   line, and `FEATURES.md` still shows `- **Status:** TODO` for IMP-068 (24 completed items are
   `DONE`). The `PROGRESS.log` format requires a commit SHA, which does not exist until commit, so
   this is a commit-time step, not an implementer defect. *The dirty `PROGRESS.log` line in the
   working tree belongs to IMP-050 (HEAD `75778cc`), not to IMP-068* — it is pre-existing dirt and
   should be committed with or before the IMP-068 line.
2. **`console.warn` is now the only console write in non-test source** (`src/App.tsx:30`; no
   `no-console` eslint rule exists and lint passes). It fires only on a genuine boot failure, so
   this is low risk and it is the correct choice over a silent `.catch()`. The implementer flagged
   the trade-off in `impl-IMP-068.md` §Uncertainties. Acceptable as-is; if the project later wants a
   uniform policy, it should be a separate decision, not folded into a bug fix.
3. **CI runs Node 20** (`.github/workflows/ci.yml`), where `globalThis.localStorage` does not exist
   at all, so the old guard would have returned `undefined` and CI could never have reproduced this
   failure. The fix is therefore dev/test-environment driven. It cannot regress CI (it only narrows
   the ambient-global case that previously threw), but the backlog's framing of this as a
   "CI-flake risk" was based on the local suite, not the Node-20 CI job.
4. **Out-of-scope findings were correctly deferred, not silently dropped.**
   `.improve/reports/discovered-IMP-068.md` records five: (1) `SettingsView.rerunMigration`
   (`src/features/settings/SettingsView.tsx:144`) still rejects unhandled on the same class of
   error — verified real and left unfixed, correctly, since it is outside IMP-068's ACs; (2) the
   smoke test never awaits the boot migration, so boot side effects stay unasserted; (3) a
   single-run CI gate is weak insurance against this class of leak; (4)+(5) the Node stub deserves a
   note in `AGENTS.md`/`REPO_PROFILE.md` §7. All are legitimate follow-ups and none blocks this
   item. Item (2) is the one worth promoting — it is the reason this defect survived ~10 commits.

**Reviewer environment side-effect (disclosed):** to test AC3/AC4 I deleted all IndexedDB databases
and cleared `localStorage` in the Playwright verification profile, then seeded and removed a 2-task
v1 fixture. The profile was left clean (0 databases, 0 `localStorage` keys) but any data that
profile held beforehand is gone. It is a throwaway verification profile, not user data; the repo and
`dist/` were untouched. The `npm run preview` server was stopped.

**No commit was made.** The only file added by this review is this report.
