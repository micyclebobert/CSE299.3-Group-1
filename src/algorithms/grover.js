// =============================================================================
// src/algorithms/grover.js
// -----------------------------------------------------------------------------
// Grover's search algorithm builder (Tier 3 planned).
//
// Layering: imports core/ and circuit/ only. DOM-free.
// =============================================================================

import { Gate } from '../circuit/GateColumn.js';
import { GateColumn } from '../circuit/GateColumn.js';
import { Circuit } from '../circuit/Circuit.js';

export function grover(n, oracleGates, diffusionGates, iterations) {
  const columns = [];
  const initGates = [];
  for (let q = 0; q < n; q++) initGates.push(new Gate({ name: 'H', target: q }));
  columns.push(new GateColumn({ gates: initGates }));
  for (let it = 0; it < iterations; it++) {
    columns.push(new GateColumn({ gates: oracleGates }));
    columns.push(new GateColumn({ gates: diffusionGates }));
  }
  return new Circuit({ numQubits: n, columns });
}
