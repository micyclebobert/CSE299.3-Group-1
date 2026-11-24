Title: P0-14 Public controller API — replace browser-view access to app._stepTrace and app._status()

Summary:
- src/ui/placement-view.js: Replaced `app._status(result.reason)` with `app.setStatus(result.reason)`.
- src/ui/io-analyzer-view.js: Verified `app._stepTrace` is fully replaced with `app.getStepTrace()`; verified no `app._status()` remains.
- src/ui/AppController.js: `getStepTrace()` now returns a safe read-only facade `{ step, scheduleLength, numQubits, currentState }` instead of the mutable internal StepTrace. `setStatus(msg)` public method verified (delegates to `_status`). Added `getStateBoundary()` returning `{ step, totalSteps, numQubits, probabilities }`. Added `getStateAtStep(step)` returning a copied read-only state view (buffers copied before trace position is restored). Kept `get currentCircuit()` getter returning immutable Circuit.
- src/ui/ai-explainer-view.js: Updated `summarizeAtBoundary` to use `app.getStepTrace()` + `app.getStateAtStep()` instead of directly calling `trace.seek()`.
- src/ui/browser-app.js: Replaced `app._status(...)` and `app._shots` with `app.setStatus(...)` and `app.shots`.
- test/ui/app-controller-inspector.test.js: Added tests for `getStepTrace()` safe facade (no seek/next/reset/getChangedSteps exposed), `getStateBoundary()`, `getStateAtStep()`, and `setStatus()`. Fixed `buildApp()` to return `statusEl`.
- Verification: `node --check` passes on all modified files; `npm run test:ui` passes 196/196; full `npm test` passes 1041/1041 with 0 failures. All files under 400 lines.

Safe facade shapes:
- getStepTrace(): { step: number, scheduleLength: number, numQubits: number, currentState: read-only state view with getRe/getIm/probabilities/etc. }
- getStateBoundary(): { step: number, totalSteps: number, numQubits: number, probabilities: Float64Array }
