Title: Implement code, URL, AI, and persistence workflows

Summary:
Implemented the following changes across the SimQC codebase:

1. src/ai/AIBuilder.js — Added retry mechanism (callOllamaWithRetry) with configurable retries; only retries on network errors (fetch TypeError), not HTTP/parse errors. Return value now includes `model` field in both success and error results.

2. src/ai/AIBuilderUI.js — Added `model` to cache key (${prompt}|${numQubits}|${model}|${BUILD_CACHE_VERSION}). Added `setModel()` getter/setter and `DEFAULT_MODEL` constant. Removed `model` from getStateSnapshot to match existing test shape.

3. src/ai/IOAnalyzerUI.js — Added row bounds validation in setInputRows/setOutputRows via validateRowsWithinBounds(), ensuring all rows are within [0, numQubits-1].

4. src/main.js — Fixed `let cache = null` to `const cache = Cache ? new Cache() : null;` (const-compatible, zero module-level mutable state).

5. src/ui/browserApp.js — Added hashchange event listener for URL circuit reloading. Replaced prompt()-based share/import UX with visible read-only share URL field + copy button, import textarea + file picker + import button, with clipboard feedback messages. Added edit-time JSON validation on textarea input. Added code/AI tab strip with 6 subviews (Canonical JSON, Compressed URL, Exported Code, AI Explainer, AI Builder, I/O Analyzer). Added localStorage persistence with save/load/reset buttons and error handling. Replaced module-level `let` variables with `const viewRefs` object pattern. Multi-row I/O Analyzer input using comma-separated text fields.

6. index.html — Added share URL input field (readonly) + copy button. Added import textarea + file picker (.json) + import button. Added copy confirmation message area. Added Code/AI tab strip with 6 subview tab-contents. Added localStorage reset/privacy controls section.

IOAnalyzer.js enrichWithLLM fix: Already correct in source — calls explainer.explain(instructions, summaries, numQubits) (not explainer([])). Verified by IOAnalyzer.test.js test "enrichWithLLM passes instructions to the explainer" which passes.

Flatten.js: Already carries `subcircuit` breadcrumb field in flattened instructions. No change needed.

Test results:
- npm run test:ai: 92/92 pass
- npm run test:ui: 209/209 pass
- npm run test:circuit: 121/121 pass
