# Discovered while implementing IMP-082

Unrelated or out-of-scope observations. Not fixed here.

## D1 — Empty-tail guard ignores `exceptions` (low, by design)

`hasOccurrenceOnOrAfter` (and its sibling `occurrencesBeforeKey`) count candidate days only,
so a series whose every remaining candidate day is listed in `recurrence.exceptions` still
reports "has a later occurrence". A "this and future" split at such a key therefore writes a
tail whose `expandOccurrences` is empty — a phantom recurring row again, just via a different
mechanism than IMP-082's passed-`until`/consumed-`count` cases. IMP-082's Notes explicitly
keep the tail's `exceptions`/`overrides` copy out of scope, so this was not changed. A future
item could fold `exceptions` into the emptiness check (or drop the inherited `exceptions` from
the tail).
