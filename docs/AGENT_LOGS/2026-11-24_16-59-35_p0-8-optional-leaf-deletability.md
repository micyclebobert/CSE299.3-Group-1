Title: P0-8 — Optional-leaf deletability (debugger/, inspector/, ai/)

Summary:
Replaced static leaf imports in src/main.js with dynamic import() wrapped in a
try/catch loadLeaf(path) helper using top-level await. Each leaf module is
destructured with fallback to undefined names (const { Debugger } = dbgMod, etc.),
so deleting src/ai/, src/debugger/, or src/inspector/ degrades to undefined names
instead of a link-time crash. The debugger-playback.js / debugger-breakpoints.js
side-effect imports are also dynamic + try/catch. The static re-export
`export { ... } from './ai/registry.js'` was changed to a local named export of
the (possibly undefined) bindings. `let cache = null; if (Cache) cache = new Cache();`
unchanged. src/ui/browser-app.js: AI guard changed from `if (AIExplainer && aiOutput)`
to `if (AIExplainer && SparseSummary && aiOutput)`. Verified
src/ui/ai-explainer-view.js has zero Cache references (P0-7 edge already removed;
uses cache || app.cache, passes null → fallback explanation).

Verification:
- node --check src/main.js src/ui/browser-app.js: OK
- npm run test:ui: 201 tests, 0 failures
- npm test (full suite): 1047 tests, 0 failures (includes main.test.js statically
  importing main.js with top-level await; works under node --test on Node v22)
- Deletion sims: renamed each of src/ai/, src/debugger/, src/inspector/ to *.bak,
  node --check src/main.js passed in all three cases, folders restored.
- Line counts: main.js 155, browser-app.js 149, ai-explainer-view.js 137 (all < 400).

Files modified: src/main.js, src/ui/browser-app.js.
