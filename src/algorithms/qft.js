// =============================================================================
// src/algorithms/qft.js
// -----------------------------------------------------------------------------
// Quantum Fourier Transform circuit builder (Tier 3 planned).
//
// Constructs the QFT on n qubits (little-endian: qubit row 0 is the least
// significant bit):
//
//   for q = n-1 down to 0:
//     H(q)
//     for m = 0 to q-1:
//       Cu1(2*pi / 2^(q-m+1)) with control m, target q
//   SWAP(j, n-1-j) for j = 0..floor((n-1)/2)
//
// The result satisfies QFT|k> = 1/sqrt(2^n) * sum_j exp(2*pi*i*k*j/2^n) |j>,
// matching src/sim/analytic.js qftState(n, k).
//
// Layering: imports core/ and circuit/ only. DOM-free.
// =============================================================================

import { Gate } from '../circuit/GateColumn.js';
import { GateColumn } from '../circuit/GateColumn.js';
import { Circuit } from '../circuit/Circuit.js';

const TAU = 2 * Math.PI;

/**
 * Build the Quantum Fourier Transform circuit on n qubits.
 *
 * @param {number} n - qubit count (n >= 1)
 * @returns {Circuit}
 */
export function qft(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(`qft expects a positive integer n, got: ${String(n)}`);
  }

  const columns = [];

  for (let q = n - 1; q >= 0; q--) {
    columns.push(new GateColumn({ gates: [new Gate({ name: 'H', target: q })] }));
    for (let m = 0; m < q; m++) {
      const angle = TAU / (1 << (q - m + 1));
      columns.push(
        new GateColumn({
          gates: [
            new Gate({
              name: 'Cu1',
              target: q,
              controls: [{ row: m, on: true }],
              thetaRad: angle,
            }),
          ],
        }),
      );
    }
  }

  // Reverse qubit order with pairwise swaps.
  for (let j = 0; j < Math.floor(n / 2); j++) {
    columns.push(
      new GateColumn({
        gates: [new Gate({ name: 'SWAP', target: j, target2: n - 1 - j })],
      }),
    );
  }

  return new Circuit({ numQubits: n, columns });
}
