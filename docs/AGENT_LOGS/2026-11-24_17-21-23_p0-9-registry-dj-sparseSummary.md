Title: P0-9 — Compliant registry facade + exact test mirrors (dj, core/SparseSummary)

Summary:
- Rewrote src/ai/registry.js from a 7-line re-export barrel into a compliant primary-export facade exporting `registry` with lazy get(name)/list()/has() accessors over ai/ leaf modules via dynamic import. No barrel re-exports of concrete modules; preserves leaf deletability.
- Updated src/main.js to import `{ registry }` from './ai/registry.js' and resolve each ai/ leaf via `registry.get(name)` (async), preserving all named re-exports for the browser controller.
- Rewrote test/ai/registry.test.js to test the facade: list/has/get for known and unknown modules, Cache class resolution, no default export.
- Added input validation (TypeError on invalid n/oracleGates) to src/algorithms/dj.js.
- Created test/algorithms/dj.test.js: validation, circuit shape (5 columns for n=1), DJ behavior (constant f=0/f=1 → input |0>, balanced f=x → input |1>), determinism.
- Created test/core/SparseSummary.test.js: marginals(re, im, n) for |00>, |0>, |+>, Bell, GHZ states; rho00+rho11=1; row indices 0..n-1.

Verification:
- node --check passes on all 6 files.
- npm run test:ai: 92 pass, 0 fail.
- npm run test:core: 54 pass, 0 fail (incl. 8 new SparseSummary tests).
- npm run test:algorithms (dj only): 9 pass, 0 fail.
- Full npm test: 1089 pass, 1 fail (pre-existing UI status-message failure in test/ui/app-controller-circuit.test.js:858, unrelated to these changes), 1 skipped.
