Title: Wave 3.5 UI view test mirrors + test/main.test.js

Summary:
Created 1:1 mirrored tests for the ten new src/ui/*-view modules and added test/main.test.js.
- test/ui/ai-builder-view.test.js: DOM shim, mock AppController.aiBuilder, verifies onChange wiring, qubits input init, build click flow (applyCircuit/draw/serialize) and the unavailable path.
- test/ui/canvas-renderer.test.js: DOM shim, verifies onRender registration, canvas sizing from getBoundingClientRect, and empty-circuit render.
- test/ui/code-view.test.js: DOM shim, verifies onCode registration, Enter keydown deserialize/draw, and action button listeners.
- test/ui/debugger-view.test.js: DOM shim, verifies updateDebugStep return, timeline refresh, scrub seek, breakpoint toggle, step, run.
- test/ui/io-analyzer-view.test.js: DOM shim, verifies onChange wiring and analyzer-present/absent (disabled/unavailable) paths.
- test/ui/panel-view.test.js: verifies panel toggle listener wiring and display toggle on region visibility.
- test/ui/browser-app.test.js: imports browser-app.js with a full DOM shim, asserts all expected getElementById ids and the window resize listener.
- test/main.test.js: asserts all required main.js exports, that the gate registry is sealed (registration throws), and Cache set/get/has.
Also fixed test/main.test.js import path (../src/main.js since it lives at test/ level).
Exposed public onChange(cb) methods on src/ai/AIBuilderUI.js and src/ai/IOAnalyzerUI.js (3 lines each) so browser-app.js can load with the real leaf UI classes; the views already assumed this contract.
Verified test/ui/ai-explainer-view.test.js already passes sparseSummary per the Wave 3.4 signature (no change needed).
All checks: node --input-type=module --check passes on every new test file; node --test from repo root passes 914/914, 0 failures.
