// =============================================================================
// src/sim/Evaluator.js
// -----------------------------------------------------------------------------
// Member 4 — Simulation execution engine.
//
//   evaluate(schedule, numQubits) -> StateVector
//
// Fast single-buffer execution from virtual column 0 to end with zero
// intermediate allocations. Applies each ExecutionColumn in order using the
// bare-function hot-path kernels in src/core/kernel.js, resolving gate
// identifiers through src/core/registry.js.
//
// Layering: imports core/ and circuit/ only. No DOM, no gates/ folder import
// (gates are resolved via the registry injected from core).
// =============================================================================

import { StateVector } from '../core/StateVector.js';
import * as Kernel from '../core/kernel.js';
import { getGate } from '../core/registry.js';

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
