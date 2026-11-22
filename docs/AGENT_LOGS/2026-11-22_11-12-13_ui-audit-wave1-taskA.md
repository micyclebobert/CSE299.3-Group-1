Title: UI Audit Wave 1 Task A — Fix browser gate placement crash, row reservation, and pointer geometry

Summary:
Fixed three defects in the browser gate placement path:

1. src/ui/AppController.js _tryPlace(): Added `const n = circuit.numQubits;` at the top of _tryPlace() to fix the `ReferenceError: n is not defined` crash. Added `usedRows.add(row)` after the target-row occupancy check to reserve the selected target row before allocating controls, preventing controls from being allocated to the same row as the target. Changed the arity capacity check from `totalNeeded` (which double-counted the already-reserved target row) to `extraNeeded` (controls + target2 only), so CNOT/SWAP/Toffoli placement works correctly when the target row is already reserved.

2. index.html pointer snapping geometry: Changed `interaction.snap()` call from `{ colPitch: 20, rowPitch: 20, colOffset: 48, rowOffset: 10 }` to `{ colPitch: 80, rowPitch: 48, colOffset: 48, rowOffset: 20 }`, matching renderer geometry (colWidth=64 + colGap=16 = 80 pitch; rowHeight=40 + rowGap=8 = 48 pitch; labelGutter=48 offset; rowHeight/2=20 row center offset). At renderer cell center (80, 20), browser mapping now correctly yields column 0, row 0 instead of column 2, row 1.

3. Placement unification: Chose Option A — _tryPlace() remains the single canonical placement implementation called by placeGateAt(). The browser uses placeGateAt() with correct geometry. No second divergent placement algorithm exists in the browser path.

4. Created test/ui/AppController.test.js with 5 tests: (a) snapCell regression test verifying (80,20) maps to column 0, row 0 with renderer geometry, (b) regression guard confirming old geometry mis-maps to column 2, row 1, (c) E2E placement test placing H at (0,0) and verifying circuit + history, (d) CNOT target row reservation test verifying control goes to row 1 not row 0, (e) Toffoli insufficient-rows conflict test in a 2-qubit circuit.

Verification:
- node --test test/ui/AppController.test.js: 5/5 pass
- node --test test/ui/AppControllerStartup.test.js: 5/5 pass (existing tests unchanged)
- node --test (full suite): 780/780 pass, 0 fail
- node --input-type=module --check src/ui/AppController.js: syntax OK
- node --input-type=module --check index.html inline script: syntax OK
