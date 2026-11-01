// =============================================================================
// src/sim/Evaluator.js
// -----------------------------------------------------------------------------
// Member 4 — Simulation execution engine.
//
//   evaluate(schedule, numQubits) -> StateVector
//
// Fast single-buffer execution from virtual column 0 to end with zero
// intermediate allocations. Applies each ExecutionColumn in order using the
// bare-function hot-path kernels in src/sim/kernel.js, resolving gate
// identifiers through src/circuit/GateRegistry.js.
//
// Layering: imports core/ and circuit/ only. No DOM, no gates/ folder import
// (gates are resolved via the registry injected from circuit/).
// =============================================================================

import { StateVector } from '../core/StateVector.js';
import * as Kernel from './kernel.js';
import { getGate } from '../circuit/GateRegistry.js';

/**
 * Execute a flattened schedule against an |0...0> initial state.
 *
 * @param {ExecutionColumn[]} schedule - output of scheduleColumns()
 * @param {number} numQubits
 * @returns {StateVector}
 */
export function evaluate(schedule, numQubits) {
  if (!Array.isArray(schedule)) {
    throw new TypeError(
      `evaluate expects an array of execution columns, got: ${typeof schedule}`,
    );
  }
  if (!Number.isInteger(numQubits) || numQubits < 1) {
    throw new TypeError(
      `evaluate expects a positive integer numQubits, got: ${String(numQubits)}`,
    );
  }

  const state = new StateVector(numQubits);
  const re = state.getRawRe();
  const im = state.getRawIm();
  const n = numQubits;

  for (let c = 0; c < schedule.length; c++) {
    const column = schedule[c];
    const instructions = column.instructions;
    for (let k = 0; k < instructions.length; k++) {
      const instr = instructions[k];
      const gateId = instr.gateId;
      const target = instr.target;
      const controls = instr.controls || [];

      let controlMask = 0;
      let antiControlMask = 0;
      for (let m = 0; m < controls.length; m++) {
        const control = controls[m];
        if (control.on) {
          controlMask |= 1 << control.row;
        } else {
          antiControlMask |= 1 << control.row;
        }
      }

      if (gateId === 'CNOT') {
        if (controls.length !== 1) {
          throw new Error(
            `CNOT requires exactly one control, got ${controls.length}`,
          );
        }
        Kernel.applyCnot(re, im, n, controls[0].row, target);
      } else if (gateId === 'CZ') {
        if (controls.length !== 1) {
          throw new Error(`CZ requires exactly one control, got ${controls.length}`);
        }
        Kernel.applyCz(re, im, n, controls[0].row, target);
      } else if (gateId === 'SWAP') {
        if (controls.length !== 0) {
          throw new Error(`SWAP requires no controls, got ${controls.length}`);
        }
        const target2 = instr.target2;
        if (!Number.isInteger(target2) || target2 < 0) {
          throw new Error(`SWAP requires a second target qubit row (target2)`);
        }
        Kernel.applySwap(re, im, n, target, target2);
      } else if (gateId === 'Toffoli') {
        if (controls.length !== 2) {
          throw new Error(`Toffoli requires exactly two controls, got ${controls.length}`);
        }
        Kernel.applyToffoli(re, im, n, controls[0].row, controls[1].row, target);
      } else {
        const gateFlat = getGate(gateId, instr.thetaRad);
        if (!gateFlat) {
          throw new Error(`Unknown gate: ${gateId}`);
        }
        Kernel.apply1QubitOp(
          re,
          im,
          n,
          target,
          gateFlat,
          controlMask,
          antiControlMask,
        );
      }
    }
  }

  return state;
}

/**
 * Primary export matching the base filename (Evaluator.js -> Evaluator).
 * Static facade over evaluate.
 */
export class Evaluator {
  /**
   * Execute a flattened schedule against an |0...0> initial state.
   * @param {ExecutionColumn[]} schedule
   * @param {number} numQubits
   * @returns {StateVector}
   */
  static evaluate(schedule, numQubits) {
    return evaluate(schedule, numQubits);
  }
}
