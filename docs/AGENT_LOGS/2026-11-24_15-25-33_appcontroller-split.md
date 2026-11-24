Title: Split src/ui/AppController.js into method-group extension modules

Summary:
Split the 428-line src/ui/AppController.js (exceeds 400-line cap) into focused modules following the File Splitting Strategy and CONVENTIONS.md rules:

- Rewrote src/ui/AppController.js (168 lines): keeps constructor, core getters, notify(), refreshDebuggerTimeline(), _status(), undo/redo, setBuilderNumQubits, pointer/palette/canvas binding, encodeURL/decodeURL, and keeps only the imports still used directly (URLCodec, limits). At the bottom it imports the four extension method bundles and applies them via Object.assign(AppController.prototype, ...).
- Created src/ui/app-controller-circuit.js (154 lines): resetCircuit, _setCircuit, placeGateAt, placeGateFromCell, _tryPlace, applyCircuit, _syncAuxQubitCounts, serialize, deserialize. Exports circuitMethods. Imports Circuit, Gate/GateColumn, Serializer, flattenCircuit/scheduleColumns, StepTrace, gateControlCount/gateNeedsTarget2.
- Created src/ui/app-controller-debugger.js (75 lines): simulate, reset, step, stepDebugger, runToBreakpoint, seekDebugger, breakpoint methods, seek/step/timeline queries. Exports debuggerMethods. No new imports beyond the bundle.
- Created src/ui/app-controller-inspector.js (17 lines): probabilities, amplitudes, ketLabels, linearEntropy, purityGammas, bloch, draw. Exports inspectorMethods. No new imports beyond the bundle.
- Created src/ui/app-controller-shots.js (22 lines): setShots, sampleShots. Exports shotsMethods. Imports StateVector and sampleHistogram.
- Created test mirrors: test/ui/app-controller-circuit.test.js, test/ui/app-controller-debugger.test.js, test/ui/app-controller-inspector.test.js, test/ui/app-controller-shots.test.js. test/ui/AppController.test.js left unchanged (public API unchanged).

Notes:
- The extensions export method bundles and AppController applies them via Object.assign after the class definition (static imports, synchronous). A literal self-registering pattern (extensions importing AppController and calling Object.assign at top level) was avoided because Node evaluates static imports before module bodies and node --test does not settle top-level await, which caused a TDZ circular-import error and exit code 13 respectively. The public AppController API is unchanged.
- All files under 400 lines, named exports only, no var, no default exports, explicit .js extensions, Pure JS ESM.
- node --check passes on every modified/created file. npm run test:ui passes 189/189. Full npm test: 1008 pass / 20 fail; the 20 failures are pre-existing in test/debugger/* (confirmed failing on the committed main tree before these changes, caused by prior modifications to src/debugger/Debugger.js, src/main.js, src/sim/StepTrace.js) and are unrelated to this split.
