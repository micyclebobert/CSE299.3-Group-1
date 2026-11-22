Title: Wave 2 Task C — Integrate DebuggerUI into AppController and browser

Summary:
Integrated DebuggerUI into AppController and the browser entry point for Wave 2, Task C of the SimQC UI audit remediation.

Changes to src/main.js:
- Added `import { Debugger } from './debugger/Debugger.js';` after the DebuggerUI import.
- Added `Debugger` to the discardable feature leaf exports.

Changes to src/ui/AppController.js:
- Constructor accepts optional `Debugger, DebuggerUI` params (default null), stored as `this._Debugger` / `this._DebuggerUI`.
- `_setCircuit()` instantiates `this._debugger` and `this._debuggerUI` after the inspector, wiring `onStepChange(() => this.notify())`.
- Added public accessors: `get debuggerUI()`, `get debugger()`, `getDebuggerStep()`, `getDebuggerTotal()`, `isDebuggerAtStart()`, `isDebuggerAtEnd()`, breakpoint CRUD methods.
- Added `stepDebugger()`, `runToBreakpoint()`, `seekDebugger(col)` methods.
- `step()` now delegates to `stepDebugger()` (uses `Debugger.next()`, safe at end-of-schedule).
- `reset()` now uses `this._debugger.reset()`.

Changes to index.html:
- Imports `Debugger` from main.js and passes `Debugger, DebuggerUI` to AppController.
- Bottom panel toolbar adds: "Toggle BP" button, "Run to BP" button, breakpoint column input, timeline scrubber range input.
- `updateDebugStep()` uses `app.getDebuggerStep()` / `app.getDebuggerTotal()`.
- Step/Run/Reset/Undo/Redo handlers call `updateDebugStep()` after each operation.
- Breakpoint toggle and run-to-breakpoint button handlers wired.
- Timeline scrubber `input` handler calls `app.seekDebugger(value)`.

Verification:
- `node --input-type=module --check` passes for both modified JS modules.
- `node --test`: 807 passed, 0 failed (8 suites).
