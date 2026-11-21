Title: Fix AI browser fallback crash — replace process.stderr.write with console.error

Summary:
Replaced `process.stderr.write(...)` in `src/ai/AIExplainer.js` (the `catch` block of `explain()`) with a browser-safe `console.error(...)` guarded by `typeof console !== 'undefined'`. Previously, when Ollama was unavailable in a browser, `process` was undefined and the deterministic template fallback was never reached — instead a `TypeError: Cannot read properties of undefined (reading 'stderr')` was thrown. Now the fallback explanation is always returned on Ollama error in both Node.js and browsers.

Verification:
- `node --input-type=module --check` on `src/ai/AIExplainer.js` passed (syntax OK)
- `node --test test/ai/AIExplainer.test.js test/ai/AIBuilder.test.js`: 16 pass, 0 fail
- `process.stderr` reference fully removed (grep: no matches)
- Only `src/ai/AIExplainer.js` was modified for this task; pre-existing working-tree changes in `index.html` and `src/ui/AppController.js` are unrelated.
