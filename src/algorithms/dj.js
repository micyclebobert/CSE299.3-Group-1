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
  const columns = [];
  // H on all input qubits, X then H on ancilla
  const initGates = [];
  for (let q = 0; q < n; q++) initGates.push(new Gate({ name: 'H', target: q }));
  initGates.push(new Gate({ name: 'X', target: n }));
  initGates.push(new Gate({ name: 'H', target: n }));
  columns.push(new GateColumn({ gates: initGates }));
  // Oracle
  columns.push(new GateColumn({ gates: oracleGates }));
  // H on input qubits
  const finalGates = [];
  for (let q = 0; q < n; q++) finalGates.push(new Gate({ name: 'H', target: q }));
  columns.push(new GateColumn({ gates: finalGates }));
  return new Circuit({ numQubits: n + 1, columns });
}
