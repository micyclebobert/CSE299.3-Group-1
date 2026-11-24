Title: Item 9 - Add 1:1 test mirror for src/ai/registry.js

Summary:
Created test/ai/registry.test.js mirroring src/ai/registry.js (7-line named re-export barrel for the ai/ discardable leaf). The test verifies all seven named exports (AIExplainer, IOAnalyzer, AIBuilder, SparseSummary, AIBuilderUI, IOAnalyzerUI, Cache) are defined and are classes, checks Cache.sha256Hex against known SHA-256 digests, verifies Cache.computeKey determinism/version-sensitivity and 64-hex-char format, exercises Cache instance get/set/has round-trip plus overwrite and instance independence, and asserts no default export exists. Runs via `node --test test/ai/registry.test.js` (8/8 pass) and full `npm test` passes with 0 failures (949 tests).
