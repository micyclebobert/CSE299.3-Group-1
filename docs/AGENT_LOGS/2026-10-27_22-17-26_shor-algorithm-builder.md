Title: M1.5 — Shor's order-finding circuit builder

Summary:
Implemented src/algorithms/shor.js (Shor's order-finding circuit builder) and test/algorithms/shor.test.js (mirrored tests), completing M1.5 of Sprint 3.

The builder constructs the order-finding circuit:
- Hadamard on all count-register qubits
- Controlled-U^{2^j} (j = 0..t-1) applied in place to a single work register W (starts |1>) via controlled value-permutation y -> (a^{2^j} * y) mod N
- Inverse QFT on the count register

Key implementation details:
- Controlled modular multiplication is a controlled permutation; the map y<N -> (m*y) mod N is bijective (gcd(m,N)=1), with y>=N fixed to itself, making it a valid unitary permutation on [0, 2^n).
- Multi-controlled X decomposed into Toffoli + CNOT with clean ancillae (all return to |0>).
- Detection flag = (reg == v) AND control; uncomputation re-detects the swapped value so flags return to 0 for both control=0 and control=1.
- Transpositions applied in reverse cycle order so the composed permutation matches the target map.
- Inverse QFT uses swaps-first, ascending-i rotations-then-H (verified as the exact inverse of the forward QFT).

Exports: gcd, modExp, findOrder (classical helpers) and shor(N, a, options).

Verification:
- node --test passes 207/207 (191 pre-existing + 16 new), zero failures.
- Simulated Shor(15,7) peaks exactly at {0, 64, 128, 192} with probability 0.25 each (r=4, mass=1.0); Shor(15,11) peaks at {0,128} with 0.5 each (r=2); Shor(15,13) matches r=4 theory.
- Only two new untracked files; no existing files modified. shor.js = 245 lines, shor.test.js = 199 lines (both under the 400-line CI cap).
