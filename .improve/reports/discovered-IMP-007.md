# Discovered findings — IMP-007

Out-of-scope observations made while implementing IMP-007. Nothing here was fixed.

## 1. Service worker serves stale bundles after a local rebuild (verification trap)

**Where:** `vite.config.ts` (`injectManifest`), `src/pwa/sw.ts`, `src/pwa/register.ts`.

After `npm run build` while `npm run preview` is already running, the Playwright page kept
executing the **previously precached** bundle. Symptoms: the app still showed the old
behaviour after the source fix, and vite-plugin-pwa rendered an "A new version is available"
toast. The same-hash navigation (`page.goto` to the identical `#/notes` URL) does **not**
reload the page, so the stale bundle survives.

Recovery used (works, ~1 call):

```js
const regs = await navigator.serviceWorker.getRegistrations();
await Promise.all(regs.map((r) => r.unregister()));
const keys = await caches.keys();
await Promise.all(keys.map((k) => caches.delete(k)));   // workbox-precache-v2-…
const dbs = await indexedDB.databases();
await Promise.all(dbs.map((d) => new Promise((res) => {
  const r = indexedDB.deleteDatabase(d.name);
  r.onsuccess = r.onerror = r.onblocked = () => res();
})));
```

then navigate to `about:blank` and back to force a real document load. Any verifier doing
UI checks against a fresh build should do this first, otherwise a passing fix can look
broken. (The vite-pwa `devOptions` shortcut only applies to `npm run dev`, not `preview`.)

**Not filed as a backlog item:** this is expected PWA behaviour, not a product defect. It is
a procedure note for the verify step.

## 2. The 80-char note-title cap is only applied on quick-add

`splitNoteDraft` (`src/domain/quickadd.ts`) caps the quick-added title at
`NOTE_TITLE_MAX = 80`, but `ItemEditorSheet`'s title field has no `maxLength`, so a user can
type or paste an arbitrarily long title by hand. The cap therefore only shapes the quick-add
path. Not a data-loss bug — cosmetic/UX consistency. Left as-is to keep IMP-007 minimal.

## 3. `HabitsView.tsx:29` still hardcodes `weekStartsOn = 1`

Already noted in the IMP-049 notes; re-confirmed unchanged here. Still open.

## 4. Note quick-add splits on `\n` only, so CRLF input leaves a trailing `\r`

`text.split('\n')` leaves `\r` at the end of every line for CRLF input (e.g. text pasted
from Windows), so the stored title/body end with `\r`. Pre-existing behaviour, unchanged by
IMP-007, and only reachable via paste on Windows-style input. Not fixed — it would change
behaviour for every kind that goes through the quick-add path.