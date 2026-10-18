# Discovered problems — IMP-038

Out-of-scope observations noticed while implementing IMP-038. Not fixed here.

## 1. `parseBackup` does not validate `lists`
`src/lib/backup.ts` still does `lists: lists as List[]` with no shape check, and
`SettingsView.importJSON` persists them via `listRepo.createMany(parsed.lists)`. A hostile
backup can persist junk list objects (`id`/`name`/`type` missing or wrong-typed) that
`listRepo`/UI code then assumes. IMP-038's spec only names items, so this was left as-is.

## 2. Scalar string/date fields remain unguarded in `normalizeItem`
`title`, `notes`, `start`, `end`, `dueAt`, `listId`, `parentId`, `createdAt`, `updatedAt`
are still copied from the untrusted partial without a type check. A numeric/array `start`
survives normalization; combined with the `parseLocalDate(item.start)!` non-null
assertions tracked by IMP-041, that can still throw in views. Related to IMP-041 rather
than IMP-038, so deferred.

## 3. `occurrences` values are not validated
`coerceItemShape` guarantees `occurrences` is a plain object but not that each value is a
valid `OccurrenceState`. A backup with `occurrences: { '2024-01-01': 5 }` still reaches
downstream consumers that read `occ.status`. Not covered by the IMP-038 acceptance
criteria (which only require the container type).
