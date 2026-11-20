Title: Fix serializer-roundtrip.test.js test bugs

Summary:
Fixed three test bugs in test/cross-validation/serializer-roundtrip.test.js that caused `node --test` to fail 3 of 532 tests:

1. "serializer: toJson output has canonical key order" — the test built a GateColumn where CNOT's control row 0 conflicted with X's anti-control row 0, violating GateColumn's intra-column disjointness rule (controls count as row usage). Split the conflicting gates into separate columns.
2. "serializer: round-trip preserves parameterized gates" — same disjointness violation (row 0 used by Rx and Rz; row 1 by Ry and Cu1's control). Split parameterized gates into disjoint columns and updated the thetaRad assertions to collect values across all columns.
3. "serializer: fromJson rejects unexpected fields" — used `assert.throws` but only `throws` was imported from 'assert'. Changed to `throws(...)`.

Source code was not modified; all failures were test-construction bugs. `node --test` now passes 523/523 (0 fail; 9 todo skipped when Qiskit/NumPy unavailable). Only `test/cross-validation/serializer-roundtrip.test.js` changed.
