Title: Item 10 — Add comprehensive browser integration test suite

Summary:
Created test/ui/browser-integration-comprehensive.test.js (400 lines, 15 test cases) covering all
browser-facing scenarios for Item 10: (1) startup — 2 qubits, render/inspector/code callbacks,
resize and pointermove binding; (2) palette placement — H at (0,0) via pointer, CNOT, gap column,
Toffoli conflict, and invalid coordinate rejection (NaN, Infinity, fractional, negative, out of
range); (3) canvas repaint — draw passes circuit and purity to renderer, render callback fires on
notify; (4) inspector tabs — state/bloch switching, probabilities, ket labels, bloch readout, render
on notify; (5) debugger transport — step, run/simulate, reset, seek, isAtStart/isAtEnd; (6) debugger
timeline — max updates on column addition, breakpoint add/toggle/remove/clear, preserved across edits;
(7) debugger breakpoint semantics — breakpoint at column k = step k, invalid columns rejected;
(8) code import/export/share — serialize/deserialize and encodeURL/decodeURL round-trips, base64url-safe
URL, import failure handling; (9) AI workflows — explainer button handler, builder build flow applies
circuit, state boundary, cache hit/miss; (10) I/O analysis — analyze button handler, row selection,
analysis result; (11) URL routing — decodeURL success/failure including hash extraction; (12) panel
toggles — collapse/expand, getLayoutRects, visibility state; (13) shots — setShots validation
(NaN, Infinity, 0, negative, fractional, valid) and sampleShots counts; (14) public API —
currentCircuit, shots, numQubits, getTimelineMax, getDebuggerStep, getDebuggerTotal.

Uses DOM shims (makeElement, window/document), MockInspector, MockAIBuilderUI, MockIOAnalyzerUI, and
inline MockAIExplainer, following the existing test/ui/browser-integration.test.js patterns. Imports
src/main.js to seed the GateRegistry.

Verification:
- node --check test/ui/browser-integration-comprehensive.test.js: PASS (syntax OK)
- node --test test/ui/browser-integration-comprehensive.test.js: 15 pass, 0 fail
- npm test (full suite): 964 pass, 0 fail

Only the new untracked file test/ui/browser-integration-comprehensive.test.js was added; no existing
files were modified by this change.
