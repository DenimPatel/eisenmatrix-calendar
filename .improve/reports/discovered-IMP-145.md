# Discovered during IMP-145

- **Compact label is tight at `100`.** At `size={28}`/`strokeWidth={3}` the compact `100` is
  18.64px inside the 22px inner diameter (~1.7px clearance per side); `40` has 4.2px. No overlap
  at any tested viewport/theme, but a caller using `size={28}` with a larger `strokeWidth`
  (smaller inner diameter) would re-introduce the collision. Not in scope (no such caller).
- **The `label` prop bypasses compactness.** A caller passing an explicit `label` at `size<40`
  gets no abbreviation, so overflow is still possible. No in-repo caller does this today;
  noted only as a latent footgun.
