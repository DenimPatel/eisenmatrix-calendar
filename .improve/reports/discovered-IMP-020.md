# Discovered findings — IMP-020

Out-of-scope observations made while implementing IMP-020. Not fixed here.

## 1. A payload with neither `items` nor `tasks` still imports as 0 items

**Where:** `src/lib/backup.ts:55-59`.

```ts
const items = Array.isArray(parsed.items) ? parsed.items
  : Array.isArray(parsed.tasks) ? parsed.tasks
  : [];
```

With no identity or version error, `parseBackup('{"hello":"world"}')` — or any JSON file
that is not a backup at all — still returns `{items: [], lists: [], version: 1}`, and
`importJSON` then shows the **success** toast `Backup imported` with the report
`Imported 0 items · skipped 0 · overwritten 0 · duplicated 0`.

This is pre-existing (the removed `!Array.isArray(items)` guard was dead and never fired).
The identity check added by IMP-020 closes the *foreign-app* and *too-new-version* cases but
not this one: an arbitrary JSON file with no `app` field is indistinguishable from an old
backup as far as `app` goes, and adding a "must contain items or tasks" check would be a
behaviour change beyond the item's acceptance criteria.

**Candidate item:** require the payload to carry `items` or `tasks` (or `app`), so a
mistakenly-picked non-backup JSON is rejected instead of silently importing nothing.
Small; needs a decision on whether an intentionally-empty *legacy* backup (`{version:1}`)
must keep working.

## 2. `lists` entries are completely unvalidated

**Where:** `src/lib/backup.ts:60,62` — `lists` is `parsed.lists as List[]`, a bare cast.

`mergeImportedItems` carefully filters `items` down to objects with an `id`, but `lists`
gets no equivalent treatment, and `importJSON` writes them straight to Dexie via
`listRepo.createMany` (`SettingsView.tsx:115`). A payload such as
`{"app":"eisenmatrix","version":2,"items":[],"lists":[null,42,"nope"]}` passes the new
identity/version checks and reaches `createMany`.

**Candidate item:** apply the same object/`id` filter to `lists` as is already done for
`items`, and/or add a repository-level guard. Worth checking whether a malformed list row
can throw at write time (surfacing as an error toast) or corrupt the table.

## 3. `src/lib/backup.test.ts` was already Prettier-dirty at HEAD

`npx prettier --check src/lib/backup.test.ts` fails on `main`/`improve/auto-20261003`
before this item: the IMP-051 addition at what is now `:95`
(`const { toPut, duplicated } = mergeImportedItems([parent, child], [parent, child], 'duplicate');`)
is 101 chars, over the 100-char print width. `npm run lint` does not run Prettier, so the
gates stay green and nobody notices.

`npm run prettier --write` on the file reformats that line. I **reverted** the unrelated
reformat to keep the IMP-020 diff scoped — so the file is still dirty, exactly as it was
before.

**Candidate item:** one-line formatting commit, or wire `prettier --check` into
`npm run lint` / the CI gate from IMP-005 so formatting drift cannot land again.
