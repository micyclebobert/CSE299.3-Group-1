Title: Fix Grover cross-validation test gate construction

Summary:
Fixed the first failing Grover test, "algorithm: Grover n=2 matches Qiskit" in test/cross-validation/qiskit-vs-simqc.test.js, by replacing plain-object gate constructions with real `new Gate({...})` instances and correcting the oracle to mark |11>.

- Root cause: the cross-validation Grover test built oracle/diffusion gates via the plain-object helper `gate(name, target, extra)` returning `{ gate, target, ...extra }`. src/algorithms/grover.js intentionally validates `oracleGates[i] instanceof Gate` (throws `TypeError: oracleGates[0] must be a Gate instance`), a contract enforced by test/algorithms/grover.test.js (11/11 passing with real Gate instances).
- Fix (test-side only, src/algorithms/grover.js untouched): oracle now uses a single real `new Gate({ name: 'CZ', target: 1, controls: [{ row: 0, on: true }] })` marking |11> (basis index 3), mirroring the working unit-test oracle at test/algorithms/grover.test.js:36-40; diffusion now uses real `new Gate({...})` instances mirroring diffusion2Gates() at test/algorithms/grover.test.js:43-55.

Verification: `node --test --test-name-pattern="Grover" test/cross-validation/qiskit-vs-simqc.test.js` -> 1/1 pass (includes Qiskit differential comparison and peak probability at |11> > 0.9). `node --test test/algorithms/grover.test.js` -> 11/11 pass.

Full `node --test` from repo root: 694 pass / 6 fail; the 6 failures are pre-existing Deutsch-Jozsa cross-validation assertion failures in the same file (untouched by this change, failing on probability-expectation assertions rather than Gate instantiation).

Only test/cross-validation/qiskit-vs-simqc.test.js changed (git status confirms).
