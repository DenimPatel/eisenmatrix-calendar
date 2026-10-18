# Handoff — eisenmatrix-calendar

## State
Session 3 on `improve/auto-20261017` completed 51 items in 39 commits (`ded0f53..57faf4d`), after a
discovery round that added IMP-098..135. Gates at tip: typecheck, lint, 707 tests (2x), format:check,
build all green. Final regression sweep CLEAN (`reports/regression-s3.md`): 52 route/viewport/theme
captures, zero console errors/failed requests/overflow; critical flows and offline load pass.
Nothing pushed (pre-push hook blocks; merging to main deploys Pages).

Backlog (`FEATURES.md`, canonical): 0 open TODO except IMP-091, 106, 108, 109 (see below), 7
NEEDS-HUMAN (034, 047, 048, 067, 095, 127, 128), 1 BLOCKED (017).

## Recommended next
1. Run a discovery round (open TODOs < refill threshold).
2. IMP-091 (mobile List column context), IMP-106 (Matrix dead space), IMP-108 (Today empty states), IMP-109 (min badge size).
3. Follow-ups in `reports/discovered-IMP-*.md` not yet itemized: bills/drag-overlay occurrence titles (085),
   recurrenceToRRule count+until over-expansion on import (113), archived-only Lists empty state (101),
   toast Undo pops newest entry (129), Goals/Calendar elevated tokens (099), toggle/title hit overlap (100).

## Warnings
- Verifiers repeatedly caught real defects on first attempt (037, 098, 116, 122, 124, 133, 042): keep independent verification.
- Status flips: do not use a lazy regex across items (it flipped 091/106/108/109 wrongly; reverted).
- IMP-017 BLOCKED on product decision; Dependabot TS7 / coverage-v8 5 PRs fail CI (pre-existing).
- Preview checks must reset service worker/caches first (AGENTS.md).

## Commands
npm run typecheck && npm run lint && npm run test && npm run format:check && npm run build
