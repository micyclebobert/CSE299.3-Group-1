Title: Wave 1.2 — Placement coordinate validation

Summary:
Added coordinate validation to AppController.placeGateAt() in src/ui/AppController.js to reject invalid placement requests with a conflict and visible status feedback:
- Reject negative columns (column < 0) -> conflict "coordinate out of range"
- Reject columns beyond the insertion point (column > circuit.columns.length) -> conflict
- Reject negative rows (row < 0) -> conflict
- Reject rows >= numQubits -> conflict
- Covers target/control/target2 rows since target is the user-supplied row and controls/target2 are allocated in-range by _tryPlace.
- On conflict, calls this._status() so placement-view's pointerup flow reports the reason via statusEl.

Also added 5 tests to test/ui/AppController.test.js:
- Negative column rejected with conflict
- Column beyond insertion point rejected with conflict
- Negative row rejected with conflict
- Row >= numQubits rejected with conflict
- Column equal to length (append at insertion point) still accepted

Verified: node --test passes all 820 tests (815 prior + 5 new), 0 failures. AppController.js is 399 lines (under the 400-line cap). All modified source/test files pass `node --input-type=module --check`.

Note: src/ui/placement-view.js and portions of test/ui/AppController.test.js (colOffset 48->80 geometry fix) were pre-existing uncommitted working-tree changes from a prior session, retained because placement-view tests depend on them and all tests pass.
