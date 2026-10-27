Title: Implement M1.1 analytic.js and M1.2 StepTrace.js (with limits.js)

Summary:
Implemented Sprint 3 tasks M1.1 and M1.2 for the SimQC engine core.

New source files:
- src/sim/limits.js — exports MAX_DENSE_QUBITS=12, MAX_EPHEMERAL_QUBITS=20, HARD_CLI_CAP=24, and evaluate(n) which returns { mode, advisory, numQubits } with a console.warn advisory for 15 <= n <= 20 and a hard throw above n=24. Required by StepTrace for mode selection.
- src/sim/analytic.js — curated closed-form state expectations: bellState(), ghzState(n), qftState(n, k), teleportationResource(), and expectation() helper. All return { re: Float64Array, im: Float64Array } indexed by little-endian basis state.
- src/sim/StepTrace.js — tiered step trace class with Dense Mode (n <= 12, snapshots at column boundaries, O(1) seek) and Ephemeral Replay Mode (n > 12, single buffer pair, zero-allocation fast-forward seek). API: reset(), next(), seek(targetCol), findStepWhere(predicate), verify(analyticExpectation), read-only currentState(). Static StepTrace.evaluate() facade included.

New test files:
- test/sim/limits.test.js — threshold constants, mode selection, advisory range, hard cap, input validation.
- test/sim/analytic.test.js — bellState, ghzState, qftState phase formula, normalization, teleportationResource, expectation helper.
- test/sim/StepTrace.test.js — construction in both modes, reset/next/seek/findStepWhere/verify/currentState, static evaluate, snapshot integrity, error handling.

Verification:
- node --test: 182/182 passing, 0 failures.
- git status: only 6 new untracked files, no existing files modified.
- CLI pipe: `cat test/fixtures/bell_state.json | node cli/cli.js` produces correct Bell-state JSON on stdout.
