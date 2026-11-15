Title: Implement Sprint 4 M1.5 and M1.6 cross-validation (measurement vs Qiskit, purity vs Qiskit)

Summary:

Implemented M1.5 and M1.6 of the Sprint 4 cross-validation plan:

M1.5 — Measurement Born rule & histogram vs Qiskit counts
- Created `test/cross-validation/measurement-vs-qiskit.test.js`
- Always-run analytical/Born-rule tests (no Qiskit needed):
  * sampleHistogram returns a Map<number,number> summing to `shots` with valid basis-index keys
  * sampleHistogram does not mutate the source StateVector
  * collapse mutates in place to a Born-distributed index and saturates (re-collapse returns the same index); |+> produces both outcomes over 50 trials
  * Empirical Born sampling of |+> and a non-uniform superposition matches analytical probabilities within a 6-sigma statistical tolerance (N=20000 shots)
- Qiskit differential tests (test.todo, skipped gracefully when python3/Qiskit unavailable): Bell state, GHZ state, and a random n=3 circuit; Qiskit Statevector probabilities compared against sampleHistogram empirical frequencies per bin within statistical tolerance; source state verified unmodified after sampling

M1.6 — Purity (gamma / linear entropy) vs Qiskit partial trace
- Created `test/cross-validation/purity-vs-qiskit.test.js`
- Created `test/cross-validation/partial_trace_ref.py` — Python reference that reconstructs a Qiskit Statevector from SimQC-emitted amplitudes and computes per-qubit Tr(rho^2) via Qiskit's independent partial_trace, emitting { qubits, purities: [...] }
- Always-run analytical tests (no Qiskit needed): |0> and |+> (gamma=1, S_L=0), |00> product (gamma=1 both rows), SimQC-evaluated Bell state (gamma=0.5 both rows), SimQC-evaluated 3-qubit GHZ (gamma=0.5 all rows), each compared against exact constants within 1e-9
- Qiskit differential tests (skipped gracefully when unavailable): product state |00>, Bell pair, and GHZ; SimQC Purity.gamma/linearEntropy compared against Qiskit partial_trace purities within 1e-9

Both test files seed the GateRegistry via `import '../../src/main.js'` so `evaluate()` can resolve gate IDs, and follow the established cross-validation conventions (spawnSync python3 runner, skip-if-unavailable via test.todo, little-endian row mapping, tolerance 1e-9 for purity).

Verification:
- `node --test` from repo root: 497 pass, 0 fail, 6 todo (Qiskit/NumPy-dependent tests skip gracefully in this bare environment; numpy/qiskit not installed)
- New files: 11 pass, 0 fail, 2 todo in isolation
- Only intended files changed (3 new files, no modifications to existing files)
- All files under the 400-line cap; no spaces in filenames; named exports only; explicit .js extensions

Files changed:
- new: test/cross-validation/measurement-vs-qiskit.test.js
- new: test/cross-validation/purity-vs-qiskit.test.js
- new: test/cross-validation/partial_trace_ref.py
