Title: Add missing circuit test coverage for M-14 through M-19 and L-08 through L-12

Summary:
Added new tests to six test files under test/circuit/, only editing test files (no src/ modifications):

1. test/circuit/Circuit.test.js (M-17, L-08): Renamed misleading 'columns length differs' test to 'gates differ (same column count)' and added a correct 'columns length differs' test. Added withColumnAt immutability tests (returns new Circuit, doesn't mutate original, inserts at index 0, appends at end, throws on non-GateColumn, throws on out-of-range index). Added withRows immutability tests (returns new Circuit with different numQubits, doesn't mutate original, throws on invalid numQubits).

2. test/circuit/GateColumn.test.js (M-15, L-10): Added intra-column disjoint-row validation tests (two gates same target row throws; target/control row sharing throws). Added Gate target2 tests (getter, undefined when not set, target2===target throws, negative target2 throws, non-integer target2 throws, isEqualTo differs when target2 differs, toDescriptor includes/omits target2). Added GateColumn immutability tests (defensive copy of gates array, gates getter returns frozen array).

3. test/circuit/Serializer.test.js (M-16, L-09): Extended strict canonical validation (non-integer numQubits float, string numQubits, missing columns field, unexpected gate field, columns not array). Added toJson determinism test (two calls produce identical string). Added Serializer static facade tests (Serializer.toJson/Serializer.fromJson round-trip, matches module-level function output). Added Serializer import to the test file.

4. test/circuit/GateRegistry.test.js (M-18): Added registration validation tests (registerFixedGate throws on non-array flatTuple, wrong-length flatTuple, empty name; registerParameterizedGate throws on non-function, object instead of function, empty name; registerFixedGate accepts valid number[8]). Added test-order independence: moved seal() test to be last in file so it doesn't seal module-level state before other tests run; added NOTE comment explaining seal() ordering constraint and no unseal() availability.

5. test/circuit/Ascii.test.js (M-19, L-11): Added control-dot attachment test ('.' attaches as positive control to gate on different row). Added edge cases: vertical control line ('|') is skipped, single-letter gate labels recognized case-insensitively with gates in separate columns.

6. test/circuit/Flatten.test.js (M-14, L-12): Added subcircuit inlining test (gate with subcircuit property flattens to sub-instructions with virtualColumn shifting and subcircuit breadcrumb). Added virtualColumn shifting test with gaps (non-sequential virtualColumns grouped correctly by scheduleColumns).

Test outcome: All 112 tests across the 6 edited circuit test files pass. Full repo suite: 380 pass, 4 fail — the 4 failures are pre-existing in test/gates/param.test.js (Rx(pi)|1>, Ry(pi)|1>, Rz(pi)|1>, Cu1(pi) flat tuple floating-point precision issues in src/gates/ source files, which were not modified per task constraints).
