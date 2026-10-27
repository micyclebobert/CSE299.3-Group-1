// =============================================================================
// src/sim/StepTrace.js
// -----------------------------------------------------------------------------
// Tiered step trace over a flattened ExecutionColumn[] schedule.
//
//   Dense Mode (n <= 12):    clones working buffers into snapshots at every
//                            column boundary; O(1) scrubbing via seek().
//   Ephemeral Replay (n > 12): single mutable buffer pair; seek() fast-forwards
//                            from step 0 with zero heap allocations.
//
// API: reset(), next(), seek(targetCol), findStepWhere(predicate), verify(),
//      read-only currentState().
//
// Layering: imports core/ and circuit/ only. No DOM, no gates/ folder import
// (gates are resolved via the registry injected from circuit/).
// =============================================================================

import { StateVector } from '../core/StateVector.js';
import * as Kernel from './kernel.js';
import { getGate } from '../circuit/GateRegistry.js';
import { evaluate as evaluateLimits } from './limits.js';

const NORM_TOL_DENSE = 1e-12;
const NORM_TOL_SPARSE = 1e-9;

function toleranceFor(n) {
  return n <= 8 ? NORM_TOL_DENSE : NORM_TOL_SPARSE;
}

/**
 * Apply a single ExecutionColumn to the state-vector buffers in place.
 * Mirrors the per-instruction dispatch in src/sim/Evaluator.js.
 *
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {number} n
 * @param {{ instructions: { gateId, target, controls, thetaRad, target2? }[] }} column
 */
function applyColumn(re, im, n, column) {
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

/**
 * Compare two state vectors component-wise within tolerance, reporting the
 * first offending index.
 *
 * @param {Float64Array} reA
 * @param {Float64Array} imA
 * @param {Float64Array} reB
 * @param {Float64Array} imB
 * @param {number} tol
 * @returns {{ ok: boolean, index?: number, msg?: string }}
 */
function compareStates(reA, imA, reB, imB, tol) {
  const size = reA.length;
  for (let i = 0; i < size; i++) {
    const dr = Math.abs(reA[i] - reB[i]);
    const di = Math.abs(imA[i] - imB[i]);
    if (dr > tol || di > tol) {
      return { ok: false, index: i, msg: `index ${i}: expected (${reB[i]}, ${imB[i]}) got (${reA[i]}, ${imA[i]}) tol ${tol}` };
    }
  }
  return { ok: true };
}

export class StepTrace {
  #schedule;
  #numQubits;
  #size;
  #mode;
  #re;
  #im;
  #step;
  #snapshots;

  constructor(schedule, numQubits) {
    if (!Array.isArray(schedule)) {
      throw new TypeError(
        `StepTrace expects an array of execution columns, got: ${typeof schedule}`,
      );
    }
    if (!Number.isInteger(numQubits) || numQubits < 1) {
      throw new TypeError(
        `StepTrace expects a positive integer numQubits, got: ${String(numQubits)}`,
      );
    }

    this.#schedule = schedule;
    this.#numQubits = numQubits;
    this.#size = 1 << numQubits;
    const policy = evaluateLimits(numQubits);
    this.#mode = policy.mode;
    this.#re = new Float64Array(this.#size);
    this.#im = new Float64Array(this.#size);
    this.#step = 0;

    if (this.#mode === 'dense') {
      this.#snapshots = new Array(schedule.length + 1);
    } else {
      this.#snapshots = null;
    }

    this.reset();
  }

  get mode() { return this.#mode; }
  get step() { return this.#step; }
  get numQubits() { return this.#numQubits; }
  get size() { return this.#size; }
  get scheduleLength() { return this.#schedule.length; }

  /**
   * Zero working buffers in place, set |0...0>, reset step = 0.
   * In Dense Mode, cache the initial snapshot. No TypedArray reallocation.
   */
  reset() {
    const size = this.#size;
    const re = this.#re;
    const im = this.#im;
    for (let i = 0; i < size; i++) {
      re[i] = 0.0;
      im[i] = 0.0;
    }
    re[0] = 1.0;
    this.#step = 0;
    if (this.#snapshots !== null) {
      this.#snapshots[0] = {
        re: new Float64Array(re),
        im: new Float64Array(im),
      };
    }
  }

  /**
   * Apply the next ExecutionColumn in place, increment step.
   * In Dense Mode, cache the resulting snapshot.
   */
  next() {
    if (this.#step >= this.#schedule.length) {
      throw new Error(
        `StepTrace.next(): already at final step ${this.#step} (schedule length ${this.#schedule.length})`,
      );
    }
    applyColumn(this.#re, this.#im, this.#numQubits, this.#schedule[this.#step]);
    this.#step++;
    if (this.#snapshots !== null) {
      this.#snapshots[this.#step] = {
        re: new Float64Array(this.#re),
        im: new Float64Array(this.#im),
      };
    }
  }

  /**
   * Clamp targetCol to [0, scheduleLength].
   * Dense Mode: copy cached snapshot via Float64Array.set() — O(1).
   * Ephemeral Mode: reset() and loop next() in place — zero heap allocations.
   *
   * @param {number} targetCol
   */
  seek(targetCol) {
    if (!Number.isInteger(targetCol) || targetCol < 0) {
      throw new TypeError(
        `StepTrace.seek expects a non-negative integer targetCol, got: ${String(targetCol)}`,
      );
    }
    const clamped = Math.min(targetCol, this.#schedule.length);

    if (this.#mode === 'dense') {
      const snap = this.#snapshots[clamped];
      if (snap !== undefined) {
        this.#re.set(snap.re);
        this.#im.set(snap.im);
        this.#step = clamped;
      } else {
        // Snapshot not yet cached; replay forward from current step.
        while (this.#step < clamped) {
          this.next();
        }
      }
    } else {
      this.reset();
      while (this.#step < clamped) {
        this.next();
      }
    }
  }

  /**
   * Reset and step column by column, evaluating predicate(buffers, step) in
   * place with zero intermediate allocations. Returns the first step where
   * predicate returns true, or -1 if none.
   *
   * @param {(re: Float64Array, im: Float64Array, step: number) => boolean} predicate
   * @returns {number}
   */
  findStepWhere(predicate) {
    if (typeof predicate !== 'function') {
      throw new TypeError(
        `StepTrace.findStepWhere expects a function predicate, got: ${typeof predicate}`,
      );
    }
    this.reset();
    while (this.#step <= this.#schedule.length) {
      if (predicate(this.#re, this.#im, this.#step)) {
        return this.#step;
      }
      if (this.#step === this.#schedule.length) {
        break;
      }
      this.next();
    }
    return -1;
  }

  /**
   * Compare trace states against a curated analytic expectation.
   *
   * @param {(step: number, numQubits: number) => { re: Float64Array, im: Float64Array } | null} analyticExpectation
   *   Returns expected state at a given step, or null to skip that step.
   * @returns {{ ok: boolean, failures: { step: number, index: number, msg: string }[] }}
   */
  verify(analyticExpectation) {
    if (analyticExpectation !== null && typeof analyticExpectation !== 'function') {
      throw new TypeError(
        `StepTrace.verify expects a function or null, got: ${typeof analyticExpectation}`,
      );
    }
    const tol = toleranceFor(this.#numQubits);
    const failures = [];

    const checkStep = (step) => {
      const expected = analyticExpectation ? analyticExpectation(step, this.#numQubits) : null;
      if (!expected) return;
      let reActual, imActual;
      if (this.#mode === 'dense' && this.#snapshots) {
        const snap = this.#snapshots[step];
        reActual = snap.re;
        imActual = snap.im;
      } else {
        // Ephemeral mode: can only check the current state at current step.
        // Replay to this step if needed.
        this.seek(step);
        reActual = this.#re;
        imActual = this.#im;
      }
      const cmp = compareStates(reActual, imActual, expected.re, expected.im, tol);
      if (!cmp.ok) {
        failures.push({ step, index: cmp.index, msg: cmp.msg });
      }
    };

    if (this.#mode === 'dense') {
      for (let s = 0; s <= this.#schedule.length; s++) {
        checkStep(s);
      }
    } else {
      checkStep(this.#step);
    }

    return { ok: failures.length === 0, failures };
  }

  /**
   * Read-only accessor to the current state vector. The returned object
   * exposes only read methods; it does not expose the mutable buffers.
   *
   * @returns {{ numQubits(): number, size(): number, getRe(i): number, getIm(i): number, probability(i): number, probabilities(): Float64Array, normSquared(): number }}
   */
  get currentState() {
    const trace = this;
    return {
      numQubits() { return trace.#numQubits; },
      size() { return trace.#size; },
      getRe(i) { return trace.#re[i]; },
      getIm(i) { return trace.#im[i]; },
      probability(i) {
        const r = trace.#re[i];
        const im = trace.#im[i];
        return r * r + im * im;
      },
      probabilities() {
        const out = new Float64Array(trace.#size);
        for (let i = 0; i < trace.#size; i++) {
          const r = trace.#re[i];
          const im = trace.#im[i];
          out[i] = r * r + im * im;
        }
        return out;
      },
      normSquared() {
        let sum = 0.0;
        for (let i = 0; i < trace.#size; i++) {
          const r = trace.#re[i];
          const im = trace.#im[i];
          sum += r * r + im * im;
        }
        return sum;
      },
    };
  }

  /**
   * Primary export matching the base filename (StepTrace.js -> StepTrace).
   * Static facade for one-shot evaluation (mirrors Evaluator convention).
   */
  static evaluate(schedule, numQubits) {
    const trace = new StepTrace(schedule, numQubits);
    while (trace.step < trace.scheduleLength) {
      trace.next();
    }
    return trace;
  }
}
