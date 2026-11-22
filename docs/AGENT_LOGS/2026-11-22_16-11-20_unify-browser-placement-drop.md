Title: Unify browser placement with Interaction.drop() (Wave 1.4)

Summary:
- src/editor/Interaction.js: Modified `drop()` to accept optional `column`/`row` overrides (destructured from options, falling back to `this._cell.column/row`). Removed the `column > circuit.columns.length` rejection; when `column > length`, empty `GateColumn({ gates: [] })` gap columns are created for indices `length` through `column-1` before placing the gate. Kept rejections for `column < 0`, `row < 0`, and `row >= circuit.numQubits`.
- src/ui/AppController.js: Modified `placeGateFromCell()` to drop the `column > circuit.columns.length` rejection, call `interaction.snap(cell.x, cell.y, { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 })` before `drop()`, pass `column` and `row` to `drop()` as overrides, and on success call `_setCircuit(result.circuit)`, `draw()`, `onPlace()`; on conflict call `_status(result.reason)`.
- src/ui/placement-view.js: Already calls `interaction.snap()` before `placeGateFromCell` and uses it as the single entry point (pre-existing working-tree state; no change needed).
- test/editor/Interaction.test.js: Replaced the "drop rejects out-of-range column index" test with "drop rejects negative column index"; added gap-column tests for `drop` at column 2 (3 columns, gaps at 0,1) and column 5 (6 columns, gaps).
- test/ui/AppController.test.js: Replaced the out-of-range-coordinates test (column 5 now creates gaps) with negative-column and row >= numQubits rejection tests; added E2E gap-column tests for `placeGateFromCell` at columns 2 and 5; added an equivalence test showing `placeGateFromCell` and `_tryPlace` produce identical circuits for gap columns.

Verification:
- `node --input-type=module --check` passes on all modified source and test files.
- `node --test` from repo root: 835 tests pass, 0 fail (baseline 829; +6 new tests).
- AppController.js is 372 lines (under the 400-line cap).
- `git status` confirms only intended source/test files changed (placement-view.js was already in the target state before this session).
