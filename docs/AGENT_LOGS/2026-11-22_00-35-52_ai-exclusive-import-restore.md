Title: Restore ai/ exclusive-import rule in index.html and src/main.js

Summary:
Removed the direct `./src/ai/AIExplainer.js` dynamic import from `index.html` (violated CONVENTIONS.md §3 / SOURCE_OF_TRUTH §3.3 Rule 3: Feature Leaf Isolation — `ai/` must be imported exclusively by `main.js`). `index.html` now consumes `AIExplainer` via its existing named import from `./src/main.js`. Added `Cache` to `main.js`'s discardable feature leaf exports alongside `AIExplainer`, `IOAnalyzer`, and `AIBuilder`. Verified all 38 AI tests pass (6 suites, 0 failures) and all edited JS modules pass `node --input-type=module --check`.
