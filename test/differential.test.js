// =============================================================================
// test/differential.test.js
// -----------------------------------------------------------------------------
// Member 4 — Differential verification harness.
//
// Compares Member 1's O(2^n) pairwise kernel (via src/sim/Evaluator.js) against
// Sprint 1's O(4^n) naive Matrix.tensorProduct path for random circuits up to
// n = 6, tolerance 1e-12. Tests across all 6 amplitude profiles per
// SOURCE_OF_TRUTH §9.2 Layer 6:
//   1. purely real, 2. purely imaginary, 3. fully complex,
//   4. complex–real, 5. complex–imaginary, 6. imaginary–real.
// Also verifies IEEE-754 norm preservation after each gate and the
// bidirectional CNOT index swaps that guard against big-endian slips.
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { Complex } from '../src/core/Complex.js';
import { Matrix } from '../src/core/Matrix.js';
import { StateVector } from '../src/core/StateVector.js';
import * as Kernel from '../src/sim/kernel.js';
import { getGate } from '../src/circuit/GateRegistry.js';
import { evaluate } from '../src/sim/Evaluator.js';
import { Gate, GateColumn } from '../src/circuit/GateColumn.js';
import { Circuit } from '../src/circuit/Circuit.js';
import { flattenCircuit } from '../src/circuit/Flatten.js';
import { scheduleColumns } from '../src/circuit/Flatten.js';

// Seed the GateRegistry (main.js is the sole importer of gates/; import it
// here so evaluate() can resolve gate IDs in tests).
import '../src/main.js';

const TOL = 1e-12; // n <= 8 per CONVENTIONS.md #226
const NORM_TOL = 1e-9;
const GATE_IDS = ['H', 'X', 'Y', 'Z', 'S', 'T', 'CNOT', 'CZ'];

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function randInt(rng, max) {
  return Math.floor(rng() * max);
}

function bit(i, q) {
  return (i >>> q) & 1;
}

function flatToMatrix(flat) {
  return new Matrix([
    [new Complex(flat[0], flat[1]), new Complex(flat[2], flat[3])],
    [new Complex(flat[4], flat[5]), new Complex(flat[6], flat[7])],
  ]);
}

function singleQubitUnitary(flat, target, n) {
  const G = flatToMatrix(flat);
  const left = Matrix.identity(1 << (n - 1 - target));
  const right = Matrix.identity(1 << target);
  return Matrix.tensorProduct(Matrix.tensorProduct(left, G), right);
}

function cnotUnitary(control, target, n) {
  const size = 1 << n;
  const data = [];
  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) row.push(new Complex(0, 0));
    data.push(row);
  }
  const maskC = 1 << control;
  const maskT = 1 << target;
  for (let i = 0; i < size; i++) {
    if (bit(i, control) === 1) {
      data[i ^ maskT][i] = new Complex(1, 0);
    } else {
      data[i][i] = new Complex(1, 0);
    }
  }
  return new Matrix(data);
}

function czUnitary(control, target, n) {
  const size = 1 << n;
  const data = [];
  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) row.push(new Complex(0, 0));
    data.push(row);
  }
  for (let i = 0; i < size; i++) {
    const v = bit(i, control) === 1 && bit(i, target) === 1 ? -1 : 1;
    data[i][i] = new Complex(v, 0);
  }
  return new Matrix(data);
}

function naiveUnitary(op, n) {
  if (op.gateId === 'CNOT') {
    return cnotUnitary(op.controls[0].row, op.target, n);
  }
  if (op.gateId === 'CZ') {
    return czUnitary(op.controls[0].row, op.target, n);
  }
  return singleQubitUnitary(getGate(op.gateId), op.target, n);
}

function applyUnitary(re, im, U) {
  const size = re.length;
  const outRe = new Float64Array(size);
  const outIm = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    let ar = 0.0;
    let ai = 0.0;
    const row = U.data[i];
    for (let j = 0; j < size; j++) {
      const c = row[j];
      const sr = re[j];
      const si = im[j];
      ar += c.real * sr - c.imaginary * si;
      ai += c.real * si + c.imaginary * sr;
    }
    outRe[i] = ar;
    outIm[i] = ai;
  }
  return { re: outRe, im: outIm };
}

function naiveSimulate(ops, n, initRe, initIm) {
  const size = 1 << n;
  let re = new Float64Array(size);
  let im = new Float64Array(size);
  if (initRe) re.set(initRe);
  if (initIm) im.set(initIm);
  else re[0] = 1.0;
  for (let g = 0; g < ops.length; g++) {
    const next = applyUnitary(re, im, naiveUnitary(ops[g], n));
    re = next.re;
    im = next.im;
  }
  return { re, im };
}

function pairwiseSimulate(ops, n, initRe, initIm) {
  const columns = ops.map(
    (op) =>
      new GateColumn({
        gates: [
          new Gate({
            name: op.gateId,
            target: op.target,
            controls: op.controls || [],
          }),
        ],
      }),
  );
  const circuit = new Circuit({ numQubits: n, columns });
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const size = 1 << n;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  if (initRe) re.set(initRe);
  if (initIm) im.set(initIm);
  else re[0] = 1.0;
  for (let c = 0; c < schedule.length; c++) {
    const column = schedule[c];
    for (const instr of column.instructions) {
      const gateId = instr.gateId;
      const target = instr.target;
      const controls = instr.controls || [];
      let controlMask = 0;
      let antiControlMask = 0;
      for (const control of controls) {
        if (control.on) controlMask |= 1 << control.row;
        else antiControlMask |= 1 << control.row;
      }
      if (gateId === 'CNOT') {
        Kernel.applyCnot(re, im, n, controls[0].row, target);
      } else if (gateId === 'CZ') {
        Kernel.applyCz(re, im, n, controls[0].row, target);
      } else {
        const gateFlat = getGate(gateId, instr.thetaRad);
        Kernel.apply1QubitOp(re, im, n, target, gateFlat, controlMask, antiControlMask);
      }
    }
  }
  return { re, im };
}

function randomOp(rng, n) {
  let gateId = GATE_IDS[randInt(rng, GATE_IDS.length)];
  if (n === 1 && (gateId === 'CNOT' || gateId === 'CZ')) {
    gateId = 'H';
  }
  const target = randInt(rng, n);
  const controls = [];
  if ((gateId === 'CNOT' || gateId === 'CZ') && n > 1) {
    let control;
    do {
      control = randInt(rng, n);
    } while (control === target);
    controls.push({ row: control, on: true });
  }
  return { gateId, target, controls };
}

// Six amplitude profiles (SOURCE_OF_TRUTH §9.2 Layer 6).
function amplitudeProfiles(n) {
  const size = 1 << n;
  const invSqrt2 = 1 / Math.sqrt(2);
  const half = 1 / 2;
  return [
    // 1. purely real: alpha0 = 1
    { name: 'purely-real', re: () => { const r = new Float64Array(size); r[0] = 1; return r; }, im: () => new Float64Array(size) },
    // 2. purely imaginary: alpha0 = i
    { name: 'purely-imaginary', re: () => new Float64Array(size), im: () => { const i = new Float64Array(size); i[0] = 1; return i; } },
    // 3. fully complex: alpha0 = (1+i)/sqrt(2)
    { name: 'fully-complex', re: () => { const r = new Float64Array(size); r[0] = invSqrt2; return r; }, im: () => { const i = new Float64Array(size); i[0] = invSqrt2; return i; } },
    // 4. complex–real: alpha0=(1+i)/2, alpha1=1/sqrt(2)
    { name: 'complex-real', re: () => { const r = new Float64Array(size); r[0] = half; r[1] = invSqrt2; return r; }, im: () => { const i = new Float64Array(size); i[0] = half; return i; } },
    // 5. complex–imaginary: alpha0=(1+i)/2, alpha1=i/sqrt(2)
    { name: 'complex-imaginary', re: () => { const r = new Float64Array(size); r[0] = half; return r; }, im: () => { const i = new Float64Array(size); i[0] = half; i[1] = invSqrt2; return i; } },
    // 6. imaginary–real: alpha0=i/sqrt(2), alpha1=1/sqrt(2)
    { name: 'imaginary-real', re: () => { const r = new Float64Array(size); r[1] = invSqrt2; return r; }, im: () => { const i = new Float64Array(size); i[0] = invSqrt2; return i; } },
  ];
}

test('pairwise kernel matches naive Matrix path for random circuits across 6 amplitude profiles (n=1..6)', () => {
  for (let n = 1; n <= 6; n++) {
    const profiles = amplitudeProfiles(n);
    for (const profile of profiles) {
      for (let t = 0; t < 5; t++) {
        const seed = n * 1000 + t;
        const rng = makeRng(seed);
        const ngates = 4 + randInt(rng, 6);
        const ops = [];
        for (let g = 0; g < ngates; g++) ops.push(randomOp(rng, n));

        const initRe = profile.re();
        const initIm = profile.im();

        const state = pairwiseSimulate(ops, n, initRe, initIm);
        const naive = naiveSimulate(ops, n, initRe, initIm);

        const size = 1 << n;
        for (let i = 0; i < size; i++) {
          ok(
            Math.abs(state.re[i] - naive.re[i]) <= TOL,
            `n=${n} profile=${profile.name} seed=${seed} i=${i} re: ${state.re[i]} vs ${naive.re[i]}`,
          );
          ok(
            Math.abs(state.im[i] - naive.im[i]) <= TOL,
            `n=${n} profile=${profile.name} seed=${seed} i=${i} im: ${state.im[i]} vs ${naive.im[i]}`,
          );
        }
        ok(
          Math.abs(
            state.re.reduce((s, v) => s + v * v, 0) +
              state.im.reduce((s, v) => s + v * v, 0) -
              1.0,
          ) <= NORM_TOL,
          `n=${n} profile=${profile.name} seed=${seed} normSquared not ~1`,
        );
      }
    }
  }
});

test('norm is preserved after each gate (pairwise kernel, n=5)', () => {
  const state = new StateVector(5);
  const re = state.getRawRe();
  const im = state.getRawIm();
  const ops = [
    { gateId: 'H', target: 0, controls: [] },
    { gateId: 'H', target: 2, controls: [] },
    { gateId: 'CNOT', target: 3, controls: [{ row: 0, on: true }] },
    { gateId: 'X', target: 1, controls: [] },
    { gateId: 'Z', target: 4, controls: [] },
    { gateId: 'CZ', target: 2, controls: [{ row: 4, on: true }] },
    { gateId: 'H', target: 3, controls: [] },
  ];
  const flatById = {};
  for (const id of ['H', 'X', 'Z', 'S', 'T']) {
    flatById[id] = getGate(id);
  }
  for (let g = 0; g < ops.length; g++) {
    const op = ops[g];
    if (op.gateId === 'CNOT') {
      Kernel.applyCnot(re, im, 5, op.controls[0].row, op.target);
    } else if (op.gateId === 'CZ') {
      Kernel.applyCz(re, im, 5, op.controls[0].row, op.target);
    } else {
      Kernel.apply1QubitOp(re, im, 5, op.target, flatById[op.gateId], 0, 0);
    }
    ok(
      Math.abs(state.normSquared() - 1.0) <= NORM_TOL,
      `gate ${g} (${op.gateId}) normSquared = ${state.normSquared()}`,
    );
  }
});

test('bidirectional CNOT exact swap pairs (n=3)', () => {
  // CNOT(0->1) swaps {1,3} and {5,7}.
  {
    const state = new StateVector(3);
    const re = state.getRawRe();
    const im = state.getRawIm();
    re[1] = 1.0;
    re[5] = 1.0;
    Kernel.applyCnot(re, im, 3, 0, 1);
    strictEqual(Object.is(re[1], 0), true);
    strictEqual(Object.is(re[3], 1), true);
    strictEqual(Object.is(re[5], 0), true);
    strictEqual(Object.is(re[7], 1), true);
  }
  // CNOT(1->0) swaps {2,3} and {6,7}.
  {
    const state = new StateVector(3);
    const re = state.getRawRe();
    const im = state.getRawIm();
    re[2] = 1.0;
    re[6] = 1.0;
    Kernel.applyCnot(re, im, 3, 1, 0);
    strictEqual(Object.is(re[2], 0), true);
    strictEqual(Object.is(re[3], 1), true);
    strictEqual(Object.is(re[6], 0), true);
    strictEqual(Object.is(re[7], 1), true);
  }
});
