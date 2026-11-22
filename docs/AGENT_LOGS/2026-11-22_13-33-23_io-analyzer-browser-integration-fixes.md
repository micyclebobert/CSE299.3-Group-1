Title: Wave 2 Task D — Fix I/O Analyzer browser integration bugs

Summary:
Fixed 3 bugs in I/O Analyzer browser integration:

1. src/ai/IOAnalyzer.js:95 — Aligned changed-step indices: changed `changedSet.has(col.virtualColumn)` to `changedSet.has(col.virtualColumn + 1)` because StepTrace.getChangedSteps() returns 1-based snapshot indices while virtualColumn is 0-based.

2. src/ui/io-analyzer-view.js:25 — Added `options.state` to the analyze call: `{ state: app._stepTrace.currentState, numQubits: app.numQubits }` so sparse summaries are computed and displayed.

3. src/ui/io-analyzer-view.js:14 — Fixed causal chain rendering: changed `a.causalChain.map((c) => 'col ' + c.column)` to `a.causalChain.join(...)` since IOAnalyzer returns string entries, not objects with `.column`.

Test files updated to match 1-based changedSteps convention:
- test/ai/IOAnalyzer.test.js: changedSteps `[0, 1]` → `[1, 2]`, `[0]` → `[1]`
- test/ai/IOAnalyzerUI.test.js: same changes

Verification:
- node --input-type=module --check: PASS for both modified source files
- node --test: 807 passed, 0 failed
