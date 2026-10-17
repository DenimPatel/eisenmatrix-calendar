# Discovered during IMP-064

## 1. `.playwright-mcp/` is untracked generated cruft but not gitignored

The repo root contains `.playwright-mcp/` with 123 untracked session snapshot YAML files
from browser verification runs. IMP-064 excludes it from Prettier, but every verification
run still pollutes `git status` and risks accidental commits. Recommend adding
`.playwright-mcp/` to `.gitignore` (separate tooling change).

## 2. `REPO_PROFILE.md` test baseline is stale

`.improve/REPO_PROFILE.md` §3/§7 states "33 files / 375 tests", but the actual baseline
on this branch is 41 files / 425 tests. The profile's baseline table should be refreshed
by the owning process.

## 3. Spec drift list was incomplete

IMP-064 named `src/pwa/ReminderRuntime.tsx` and `src/domain/itemActions.test.ts` as
drifted, but both were already clean at HEAD. Conversely, five other tracked files
(`delivery.ts`, `delivery.test.ts`, `ItemEditorSheet.tsx`, `SettingsView.tsx`,
`repository.test.ts`) were the real drift. No action needed beyond this note.
