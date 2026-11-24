Title: Split app-controller-circuit.js into three modules and clean up AppController

Summary:
- Split src/ui/app-controller-circuit.js (174 lines) into three modules:
  - src/ui/app-controller-placement.js (placeGateAt, placeGateFromCell, _tryPlace)
  - src/ui/app-controller-gates.js (applyCircuit, _syncAuxQubitCounts, serialize, deserialize)
  - src/ui/app-controller-structure.js (resetCircuit, _setCircuit)
  Deleted the original src/ui/app-controller-circuit.js.
- Updated src/ui/AppController.js to import from the three new modules and
  Object.assign them (plus debugger/inspector/shots mixins) onto the prototype.
- Removed the duplicated local URLCodec wrapper in AppController.js; encodeURL/decodeURL
  now import encode/decode directly from ../circuit/URLCodec.js (main.js already wires URLCodec).
- No module-level let/var remains in AppController.js; const by default preserved.
- All new/modified files pass `node --check`. `npm run test:ui` (209 pass, 0 fail) and
  `npm run test:interface` (274 pass, 0 fail) both pass.
- Mutable-state audit of src/: no `var` JS declarations (only a CSS var() string).
  Pre-existing module-level `let` violations (not introduced by this task):
  src/circuit/GateRegistry.js:25 (let sealed = false), src/main.js:128 (let cache = null),
  src/ui/browserApp.js:39-41 (let renderInspector/updateDebugStep/histogramView).
  All other `let` occurrences are loop counters/accumulators inside functions, which is allowed.
