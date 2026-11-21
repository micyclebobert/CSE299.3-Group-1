Title: Browser application state/controller layer and renderer correction

Summary:
Implemented the browser application state/controller layer (src/ui/AppController.js) and corrected the canvas renderer (src/canvas/Renderer.js), per the UI Audit remediation order steps 1 and 3.

Controller layer (src/ui/AppController.js):
- Holds mutable currentCircuit, current StepTrace, History, and shot count.
- Coordinates palette placement (gate arity/control metadata), undo/redo, simulation (StepTrace stepping/reset/seek), Inspector readouts (probabilities, amplitudes, purity linear entropy, Bloch vectors), measurement shot sampling, and canonical v1 JSON serialization/deserialization.
- Exposes render/inspector/code-view subscriptions and a notify() change broadcast so the DOM stays in sync with the model.
- Wired into index.html with palette buttons, canvas, simulator/reset/undo/redo/step controls, Inspector tabs (Amplitudes/Probabilities/Bloch), shot sampling, Code&AI JSON (copy/import/export/share), AI explainer, and status bar.

Renderer correction (src/canvas/Renderer.js):
- Added label gutter so qubit labels (q0, q1...) are drawn inside the canvas instead of off-canvas at x=-6.
- Added horizontal row separators so qubit rows are visibly represented.
- Control lines now connect to gate centres (rowY + rh/2) instead of row top edges.
- Added control dots and target circle/⊕ symbols for controlled gates; SWAP second-target connection line.
- Row-level purity glow driven by linear entropy (S_L) per row instead of the misleading "has controls" glow; applied as a row band.
- Gate parameter values (thetaRad) displayed on parameterized gates.
- Separated CSS layout size from backing-store size in index.html (canvas width:100%/height:100% CSS, dpr-scaled bitmap).

Gate palette (src/editor/gatePalette.js):
- Added CNOT, CZ, SWAP, Toffoli to satisfy the Sprint 5 palette contract.
- Added arity/control/target2/parameterized metadata to every entry for valid placement.
- main.js now exports the discardable leaves (Inspector, DebuggerUI, InspectorUI, AIExplainer, IOAnalyzer, AIBuilder) and Inspector.

Tests: updated test/canvas/Renderer.test.js and test/editor/gatePalette.test.js to match corrected behavior (removed assertions that codified the off-canvas label bug and the CNOT omission). Full `node --test`: 704 passed, 0 failed (baseline 703).
