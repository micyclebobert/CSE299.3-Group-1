Title: P0-7 — AI Explainer grounding & boundary

Summary:
Fixed P0-7 across the AI Explainer view and explainer.

src/ui/ai-explainer-view.js:
- Removed the direct `import { Cache } from '../ai/Cache.js'` edge; the view now uses only the injected shared `cache` (passed via browser-app.js from main.js) or `app.cache`.
- `summarizeAtBoundary` now produces one sparse Top-k summary per virtual column, returned as a dense array indexed by virtualColumn (`summaries[vc]`), seeking to each virtual column boundary via `app.getStateAtStep()` (which restores the trace position in its finally block, so the private trace is never permanently mutated).
- Added a browser boundary selector (`<select>` with "Final state"/"Virtual step" options plus a step number input) that drives closure-scoped `stateBoundary` and is passed to summarize.
- The context block now shows the actual sparse summaries sent: boundary, per-virtual-column count, and top-k labels per column (`vc=N: |label>, ...`).
- Cache identity (`stateIdentity`) includes boundary + virtual columns.
- No-cache fallback retained: `cache: cache || app.cache` (no `new Cache()`), so AIExplainer's template fallback still works when no cache is injected.

src/ai/AIExplainer.js:
- `buildPrompt` now builds a seen-set of virtual columns and iterates unique virtual columns in order, emitting one summary section per virtual column (deduplicating repeated instructions on the same column), using `summaries[virtualColumn]` dense indexing.

src/ui/browser-app.js:
- Verified it already passes the injected shared `cache` to `initAIExplainerView(app, aiOutput, AIExplainer, SparseSummary, cache)`; no change required.

Tests:
- test/ai/AIExplainer.test.js: added "buildPrompt emits one section per unique virtual column".
- test/ui/ai-explainer-view.test.js: updated cache-fallback and boundary assertions for per-column summaries; added "no direct Cache import edge; uses injected app.cache only".

Verification:
- `node --check` passes on all four modified files.
- `npm run test:features`: 237/237 pass, 0 fail.
- `npm run test:ui`: ai-explainer-view tests 6/6 pass; 3 remaining `renderShots` (histogram) failures are pre-existing (from P0-6 histogram changes already in the tree) and unrelated to P0-7.
- All files under 400 lines; no direct Cache import remains in ai-explainer-view.js.
