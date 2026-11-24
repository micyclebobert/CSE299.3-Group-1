// =============================================================================
// src/sim/step-trace-apply.js
// -----------------------------------------------------------------------------
// Tiered step trace helper: applies a single ExecutionColumn to state-vector
// buffers in place. Mirrors the per-instruction dispatch in Evaluator.js.
// =============================================================================

import * as Kernel from './kernel.js';
import { getGate } from '../circuit/GateRegistry.js';

export function applyColumn(re, im, n, column) {
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
        throw new Error(`CNOT requires exactly one control, got ${controls.length}`);
      }
      Kernel.applyCnot(re, im, n, controls[0].row, target);
    } else if (gateId === 'CZ') {
      if (controls.length !== 1) {
        throw new Error(`CZ requires exactly one control, got ${controls.length}`);
      }
      Kernel.applyCz(re, im, n, controls[0].row, target);
    } else if (gateId === 'SWAP') {
      const target2 = instr.target2;
      if (!Number.isInteger(target2) || target2 < 0) {
        throw new Error('SWAP requires a second target qubit row (target2)');
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
        re, im, n, target, gateFlat, controlMask, antiControlMask,
      );
    }
  }
}
