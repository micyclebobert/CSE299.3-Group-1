Title: Add missing sim test coverage (H-08, H-09, H-10, M-20, M-21, M-22, M-23, L-13, L-14, L-18)

Summary:
- test/sim/Evaluator.test.js: rewrote CNOT(1->0) test to run evaluate() end-to-end; replaced try/catch flag with assert.throws for unknown gate; added input-validation tests (non-array schedule, numQubits 0/-1/2.5 -> TypeError); added Rx/Ry/Rz/Cu1 pipeline tests; added anti-control (on===false) bit-identical test; extended circuitFromOps helper with thetaRad; tightened norm tolerance to 1e-12.
- test/sim/kernel.test.js: NORM_TOL 1e-9 -> 1e-12 (Rule #9, n<=8); added anti-control apply1QubitOp bit-identical pass-through test (Object.is); added control==target does-not-throw test documenting L-19 kernel.js gap.
- test/sim/StepTrace.test.js: added next() beyond final step throws; verify() throws on non-function; verify() wrong-numQubits mismatch; seek() scrubbing Object.is bit-identity checks.
- test/sim/analytic.test.js: added ghzState(0/-1/2.5) TypeError tests; qftState invalid n (TypeError) and invalid k (RangeError) tests.

Verification: `node --test` from repo root: 328 tests, 0 failures (312 baseline + 16 new). Only test/sim/*.test.js files modified; no src/ changes.
