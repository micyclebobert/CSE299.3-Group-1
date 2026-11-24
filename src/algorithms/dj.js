// =============================================================================
// src/algorithms/dj.js
// -----------------------------------------------------------------------------
// Deutsch–Jozsa algorithm builder (Tier 3 planned).
//
// Layering: imports core/ and circuit/ only. DOM-free.
// =============================================================================

import { Gate } from '../circuit/GateColumn.js';
import { GateColumn } from '../circuit/GateColumn.js';
import { Circuit } from '../circuit/Circuit.js';

/**
 * Build a Deutsch–Jozsa circuit for a given oracle.
 *
 * @param {number} n - number of input qubits
 * @param {Gate[]} oracleGates - gates implementing the oracle on n+1 qubits
 * @returns {Circuit}
 */
export function deutschJozsa(n, oracleGates) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(
      `deutschJozsa expects n to be a positive integer, got: ${typeof n}`
    );
  }
  if (!Array.isArray(oracleGates)) {
    throw new TypeError(
      `deutschJozsa expects oracleGates to be an array, got: ${typeof oracleGates}`
    );
  }
  for (const gate of oracleGates) {
    if (!(gate instanceof Gate)) {
      throw new TypeError(
        `deutschJozsa expects every oracle gate to be a Gate, got: ${typeof gate}`
      );
    }
  }

  const columns = [];
  // H on all input qubits, then X then H on the ancilla (sequential columns).
  const initGates = [];
  for (let q = 0; q < n; q++) initGates.push(new Gate({ name: 'H', target: q }));
  columns.push(new GateColumn({ gates: initGates }));
  columns.push(new GateColumn({ gates: [new Gate({ name: 'X', target: n })] }));
  columns.push(new GateColumn({ gates: [new Gate({ name: 'H', target: n })] }));
  // Oracle
  columns.push(new GateColumn({ gates: oracleGates }));
  // H on input qubits
  const finalGates = [];
  for (let q = 0; q < n; q++) finalGates.push(new Gate({ name: 'H', target: q }));
  columns.push(new GateColumn({ gates: finalGates }));
  return new Circuit({ numQubits: n + 1, columns });
}
