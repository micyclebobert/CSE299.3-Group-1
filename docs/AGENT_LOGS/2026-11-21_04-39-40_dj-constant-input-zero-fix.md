Title: Fix Deutsch-Jozsa constant input-zero mass subspace assertion

Summary:
Fixed the first failing DJ test, "algorithm: DJ constant n=1 matches Qiskit", in test/cross-validation/qiskit-vs-simqc.test.js, by correcting the all-input-zero probability-mass summation from basis indices {0, 1} to the proper all-zero input subspace {0, 2^n}.

- Root cause: src/algorithms/dj.js builds a circuit with numQubits = n + 1 (n input qubits at rows 0..n-1 plus ancilla at row n). For the constant oracle the final state concentrates all input-register mass on the all-zero input subspace, so the surviving basis indices are {0, 2^n} (ancilla free, all input bits = 0). The test incorrectly summed probability(0) + probability(1), which for n=1 reads P(|00>) + P(|10>) = 0.5 + 0 = 0.5 and failed the ~1.0 expectation (error: "DJ constant n=1: input qubits not all |0⟩ (mass=0.4999999999999998)").
- Fix (test-side only, src/algorithms/dj.js untouched): pInputZero = simqcState.probability(0) + simqcState.probability(1 << n).
- The fix applies to all Deutsch-Jozsa constant-oracle loop iterations n=1..3; DJ constant n=1, n=2, n=3 now pass.

Verification: `node --test test/cross-validation/qiskit-vs-simqc.test.js` -> DJ constant n=1, n=2, n=3 now ok; M1 fixtures, Bell, GHZ, QFT, Grover, and Shor tests still ok; remaining failures in that file are the out-of-scope DJ balanced tests.

Full `node --test` from repo root: 697 pass / 3 fail; the 3 failures are the pre-existing DJ balanced cross-validation tests (untouched by this change, still failing on the not-all-zero expectation for balanced oracles).
