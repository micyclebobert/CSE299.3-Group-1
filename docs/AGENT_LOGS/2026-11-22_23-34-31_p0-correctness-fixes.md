Title: P0 correctness fixes for placement validation, shots validation, debugger timeline refresh, breakpoint semantics

Summary:
- src/ui/AppController.js:
  * placeGateAt() now requires Number.isFinite && Number.isInteger for both column and row (rejects NaN/Infinity/fractional) with visible status feedback; removed the column > circuit.columns.length upper bound so gap columns are allowed, matching placeGateFromCell()/Interaction.drop().
  * setShots() now rejects non-finite or < 1 values with status feedback (keeps current value) instead of silently producing NaN; otherwise clamps to Math.max(1, Math.floor(shots)).
  * Added public refreshDebuggerTimeline() and call it at the end of _setCircuit() (replacing notify()) so the debugger timeline/breakpoint presentation refreshes on every circuit/schedule replacement (direct edit, deserialize, applyCircuit, undo/redo).
  * Removed the dead, untested _placeGate() private method to stay within the 400-line file cap (file is now 393 lines).
- src/ui/debugger-view.js: refreshBreakpoints() now labels breakpoints as "Step ${column}" and documents the semantics (step 0 = initial state; step k = state after column k-1 applied; breakpoint at column k breaks at state step k).
- src/ui/browser-app.js: wired updateDebugStep() into app.onInspector() so the timeline scrubber and breakpoint list refresh on every circuit change via notify().
- test/ui/AppController.test.js: added tests for NaN/Infinity/fractional column/row rejection, gap-column placement, and setShots validation (NaN/Infinity/0/negative/fractional/valid).
- test/ui/AppControllerPlacement.test.js: updated the outdated "invalid coordinates" test (column > length no longer conflicts) and added a gap-column placement test.
- Verification: node --test -> 927 pass, 0 fail; node --input-type=module --check passes on all modified source files.
