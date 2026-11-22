Title: Wave 3 Task G — AI Builder results applied to editor, explainer sparse grounding + cache reuse

Summary:
Modified 4 core files plus supporting changes to implement Wave 3 Task G of the SimQC UI audit remediation:

1. src/ui/AppController.js — Added `applyCircuit(circuit)` public method that calls `_setCircuit(circuit)` and sets status message. Added `cache` constructor parameter with `get cache()` getter. Added `builderNumQubits` getter and `setBuilderNumQubits(numQubits)` method to expose and update builder qubit count.

2. src/ui/ai-builder-view.js — After successful build, calls `app.applyCircuit(aiBuilder.circuit)` to apply the generated circuit to the editor, then triggers `app.draw()`, `renderInspector()`, and `codeEl.value = app.serialize()`. Added `#builder-qubits` input field that calls `aiBuilder.setNumQubits()` on change.

3. src/ui/ai-explainer-view.js — Generates sparse state summaries using `SparseSummary.summarize(state)` from main.js export. Passes `app.serialize()` as `canonicalJson` for cache key. Passes `app.cache` (from main.js export) for cache reuse. Reuses a single `AIExplainer` instance across requests (module-level `let explainer`).

4. src/main.js — Added `SparseSummary` import and export alongside existing `Cache` export.

Supporting changes:
- src/ui/browser-app.js — Imports `cache` from main.js, passes it to AppController and initAIExplainerView, passes `codeEl` and `renderInspector` to initAIBuilderView.
- index.html — Added `#builder-qubits` number input to the AI Builder section.

Verification:
- node --input-type=module --check: all 5 modified files pass
- node --test (relevant suites): 53 passed, 0 failed across AppController, AIBuilder, AIBuilderUI, AIExplainer, Cache, SparseSummary tests
