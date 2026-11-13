Title: Implement M1.8 differential CLI pipe harness and M1.9 cross-validation fixtures

Summary:
Added test/cross-validation/ to unblock M2 (Qiskit gate/algorithm cross-validation).

M1.8 — Differential CLI pipe harness:
- test/cross-validation/harness_helpers.js: runCli() spawns cli/cli.js, feeds canonical v1 circuit JSON on stdin, parses deterministic {qubits, probabilities[], amplitudes[]} JSON on stdout, asserts exit code 0, empty stderr, valid JSON stdout, and correct output shape.
- test/cross-validation/differential-harness.test.js: 4 tests — valid Bell circuit yields valid JSON with correct shape/probabilities; amplitudes match probabilities (re^2+im^2); invalid JSON rejected with non-zero exit; empty stdin rejected.

M1.9 — Cross-validation fixtures (test/cross-validation/fixtures/):
- bell.json, ghz3.json, qft3.json, qft4.json, dj_constant.json, dj_balanced.json, grover2.json: single canonical v1 circuit documents.
- random_circuits.json: array of canonical v1 circuit documents for n=1..6.
- analytic_states.json: Bell, GHZ3, QFT|0> states with expected amplitudes.

All fixtures run through cli/cli.js with exit 0 and empty stderr. node --test from repo root passes 436/436 (0 failures), auto-discovering test/cross-validation/*.test.js. No existing files modified.
