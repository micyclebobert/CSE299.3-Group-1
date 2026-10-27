// =============================================================================
// src/circuit/Flatten.js
// -----------------------------------------------------------------------------
// MEMBER 3 — Dual-Layer Circuit Flattening Pipeline
//
// Layer 1: flattenCircuit(circuit) -> Instruction[]
//   Recursively walks columns left-to-right, emitting one canonical
//   instruction per gate. Top-level gates get virtualColumn === column.
//
// Layer 2: scheduleColumns(instructions) -> ExecutionColumn[]
//   Buckets instructions sharing the same virtualColumn into contiguous
//   execution batches, sorted ascending by virtualColumn.
//
// Instruction shape (key order is significant):
//   {
//     gateId: "H",
//     target: 0,
//     target2: undefined, // second target for two-target gates (e.g. SWAP)
//     thetaRad: undefined, // rotation angle for parameterized gates
//     controls: [{ row: 1, on: true }],
//     thetaRad: undefined,
//     column: 2,        // top-level editor column index
//     virtualColumn: 3, // subcircuit-expanded execution column index
//     subcircuit: undefined // "Bell" when inlined from a subcircuit
//   }
// =============================================================================

import { Gate, GateColumn } from './GateColumn.js';
import { Circuit } from './Circuit.js';

// ---------------------------------------------------------------------------
// Layer 1 — Canonical 1D Flattening
// ---------------------------------------------------------------------------

/**
 * Flatten a Circuit into a 1D array of canonical Instruction objects.
 * Gates are emitted in left-to-right column, top-to-bottom row order.
 * Each instruction carries both its top-level `column` index and its
 * `virtualColumn` (execution position after subcircuit expansion).
 *
 * @param {Circuit} circuit
 * @returns {Instruction[]}
 */
export function flattenCircuit(circuit) {
  if (!(circuit instanceof Circuit)) {
    throw new TypeError(
      `flattenCircuit expects a Circuit instance, got: ${
        circuit && circuit.constructor && circuit.constructor.name
      }`
    );
  }

  const instructions = [];
  let virtualColumn = 0;

  for (let colIdx = 0; colIdx < circuit.columns.length; colIdx++) {
    const column = circuit.columns[colIdx];
    if (!(column instanceof GateColumn)) {
      throw new TypeError(
        `Column ${colIdx} is not a GateColumn instance`
      );
    }

    for (const gate of column.gates) {
      if (!(gate instanceof Gate)) {
        throw new TypeError(
          `Column ${colIdx} contains a non-Gate element`
        );
      }

      // If the gate carries an embedded subcircuit, inline it recursively.
      // The subcircuit's internal gates occupy successive virtual columns,
      // shifting subsequent top-level gates accordingly.
      if (gate.subcircuit && gate.subcircuit instanceof Circuit) {
        const subInstructions = flattenCircuit(gate.subcircuit);
        const subWidth =
          subInstructions.length > 0
            ? Math.max(...subInstructions.map((i) => i.virtualColumn)) + 1
            : 1;

        for (const subInstr of subInstructions) {
          instructions.push({
            gateId: subInstr.gateId,
            target: subInstr.target,
            controls: [...subInstr.controls],
            thetaRad: subInstr.thetaRad,
            column: colIdx,
            virtualColumn: virtualColumn + subInstr.virtualColumn,
            subcircuit: gate.subcircuitName || subInstr.subcircuit,
          });
        }

        virtualColumn += subWidth;
      } else {
        instructions.push({
          gateId: gate.name,
          target: gate.target,
          target2: gate.target2,
          thetaRad: gate.thetaRad,
          controls: [...gate.controls],
          column: colIdx,
          virtualColumn,
          subcircuit: undefined,
        });
        virtualColumn++;
      }
    }
  }

  return instructions;
}

// ---------------------------------------------------------------------------
// Layer 2 — Schedule Projection
// ---------------------------------------------------------------------------

/**
 * Group flat instructions sharing the same virtualColumn into contiguous
 * execution batches, sorted ascending by virtualColumn.
 *
 * @param {Instruction[]} instructions
 * @returns {ExecutionColumn[]}
 */
export function scheduleColumns(instructions) {
  if (!Array.isArray(instructions)) {
    throw new TypeError(
      `scheduleColumns expects an array of instructions, got: ${typeof instructions}`
    );
  }

  const buckets = new Map();

  for (const instr of instructions) {
    const key = Number.isInteger(instr.virtualColumn)
      ? instr.virtualColumn
      : NaN;
    if (!Number.isFinite(key)) {
      throw new TypeError(
        `Instruction missing valid virtualColumn: ${JSON.stringify(instr)}`
      );
    }
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(instr);
  }

  const executionColumns = [];
  for (const [virtualColumn, instrs] of [...buckets.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    executionColumns.push({
      virtualColumn,
      instructions: instrs,
    });
  }

  return executionColumns;
}

/**
 * Primary export matching the base filename (Flatten.js -> Flatten).
 * Static facade over flattenCircuit/scheduleColumns.
 */
export class Flatten {
  /**
   * Flatten a Circuit into a 1D array of canonical Instruction objects.
   * @param {Circuit} circuit
   * @returns {Instruction[]}
   */
  static flattenCircuit(circuit) {
    return flattenCircuit(circuit);
  }

  /**
   * Group flat instructions sharing the same virtualColumn into execution batches.
   * @param {Instruction[]} instructions
   * @returns {ExecutionColumn[]}
   */
  static scheduleColumns(instructions) {
    return scheduleColumns(instructions);
  }
}
