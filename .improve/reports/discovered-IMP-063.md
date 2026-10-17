# Discovered — IMP-063

Unrelated to the workflow change:

1. `.improve/REPO_PROFILE.md` §3 and §7 still record the test baseline as 33 files /
   375 tests. The current tree runs 41 files / 425 tests (`npm run test`, all passing),
   matching the 425 baseline named in the IMP-063 task. The profile's date line still
   says 2026-10-17, so this is stale content rather than a regression.
