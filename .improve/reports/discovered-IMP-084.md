# discovered-IMP-084

Findings noticed while implementing IMP-084 (remap `parentId` for every incoming item under
the duplicate strategy). Nothing new beyond the item's own spec; no unrelated problems found.

- No new defects observed. The residual known gaps stay with their owners: D2 (two same-id
  incoming rows collapse to one) and D3 (a dangling `parentId` is unvalidated) are documented
  in `discovered-IMP-051.md`; D3 rides with IMP-038.
