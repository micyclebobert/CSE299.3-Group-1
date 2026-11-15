Title: Implement Grover's search algorithm builder and tests

Summary:
Implemented src/algorithms/grover.js (previously a stub marked "Tier 3 planned") and added test/algorithms/grover.test.js.

grover(n, oracleGates, diffusionGates, iterations):
- Builds H^⊗n initialization, then `iterations` rounds of (oracle, diffusion).
- oracleGates/diffusionGates are arrays of Gate instances acting on rows 0..n-1.
- Packs gates into columns greedily so intra-column row-disjointness holds (GateColumn enforces this); the previous stub put all oracle/diffusion gates in a single column, which threw when gates shared rows (e.g. the cross-validation oracle X(0),X(1),CZ(control 0→target 1)).
- Validates n (positive integer), oracleGates/diffusionGates (arrays of Gate), iterations (non-negative integer).
- Layering preserved: imports core/circuit only; DOM-free; named export `grover`.

Tests (11, all pass): input validation, Circuit shape, first column = H on every row, oracle/diffusion alternation, peak amplification (n=2 marking |11> → probability 1 after 1 iteration; n=3 marking |111> → dominates after 2 iterations), 0 iterations = uniform superposition, and bit-determinism across repeated evaluate() runs.

Verification: `node --test test/algorithms/grover.test.js` → 11/11 pass. Full `node --test` → 447 pass, 1 fail. The single failure is a pre-existing bug in test/cross-validation/qiskit-vs-simqc.test.js (`new URL(filename, filesystemPath)` throws `TypeError: Invalid URL` at module load, before any grover code runs); unrelated to this change and pre-existing. Only src/algorithms/grover.js and test/algorithms/grover.test.js changed (git status confirmed).
