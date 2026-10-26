// =============================================================================
// test/differential.test.js
// -----------------------------------------------------------------------------
// Member 4 — Differential verification harness.
//
// Compares Member 1's O(2^n) pairwise kernel (via src/sim/Evaluator.js) against
// Sprint 1's O(4^n) naive Matrix.tensorProduct path for random circuits up to
// n = 6, tolerance 1e-12. Also verifies IEEE-754 norm preservation after each
// gate and the bidirectional CNOT index swaps that guard against big-endian
// slips.
// =============================================================================

import { test } from 'node:test';
import { ok } from 'assert';
import { Complex } from '../src/core/Complex.js';
import { Matrix } from '../src/core/Matrix.js';
import { StateVector } from '../src/core/StateVector.js';
import * as Kernel from '../src/core/kernel.js';
import { getGate } from '../src/core/registry.js';
import { evaluate } from '../src/sim/Evaluator.js';
import { Gate, GateColumn } from '../src/circuit/GateColumn.js';
import { Circuit } from '../src/circuit/Circuit.js';
import { flattenCircuit } from '../src/circuit/Flatten.js';
import { scheduleColumns } from '../src/circuit/Flatten.js';

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

// Lift a single-qubit gate on target t to n qubits (little-endian: qubit t =
// bit t) via Kronecker: U = I_{2^(n-1-t)} (x) G (x) I_{2^t}. Uses
// Matrix.tensorProduct — the naive O(4^n) reference path.
function singleQubitUnitary(flat, target, n) {
  const G = flatToMatrix(flat);
  const left = Matrix.identity(1 << (n - 1 - target));
  const right = Matrix.identity(1 << target);
  return Matrix.tensorProduct(Matrix.tensorProduct(left, G), right);
}

// CNOT as a permutation matrix (textbook definition, O(4^n) to build).
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

// CZ as a diagonal phase matrix.
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

function naiveSimulate(ops, n) {
  const size = 1 << n;
  let re = new Float64Array(size);
  let im = new Float64Array(size);
  re[0] = 1.0;
  for (let g = 0; g < ops.length; g++) {
    const next = applyUnitary(re, im, naiveUnitary(ops[g], n));
    re = next.re;
    im = next.im;
  }
  return { re, im };
}

// Run ops through the full pairwise pipeline: Circuit -> flatten ->
// scheduleColumns -> evaluate.
function pairwiseSimulate(ops, n) {
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
  return evaluate(schedule, n);
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

test('pairwise kernel matches naive Matrix path for random circuits (n=1..6)', () => {
  for (let n = 1; n <= 6; n++) {
    for (let t = 0; t < 10; t++) {
      const seed = n * 1000 + t;
      const rng = makeRng(seed);
      const ngates = 4 + randInt(rng, 6);
      const ops = [];
      for (let g = 0; g < ngates; g++) ops.push(randomOp(rng, n));

      const size = 1 << n;
      const state = pairwiseSimulate(ops, n);
      const naive = naiveSimulate(ops, n);

      for (let i = 0; i < size; i++) {
        ok(
          Math.abs(state.getRe(i) - naive.re[i]) <= TOL,
          `n=${n} seed=${seed} i=${i} re: ${state.getRe(i)} vs ${naive.re[i]}`,
        );
        ok(
          Math.abs(state.getIm(i) - naive.im[i]) <= TOL,
          `n=${n} seed=${seed} i=${i} im: ${state.getIm(i)} vs ${naive.im[i]}`,
        );
      }
      ok(
        Math.abs(state.normSquared() - 1.0) <= NORM_TOL,
        `n=${n} seed=${seed} normSquared = ${state.normSquared()}`,
      );
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
    strictEqualCheck(re[1], 0);
    strictEqualCheck(re[3], 1);
    strictEqualCheck(re[5], 0);
    strictEqualCheck(re[7], 1);
  }
  // CNOT(1->0) swaps {2,3} and {6,7}.
  {
    const state = new StateVector(3);
    const re = state.getRawRe();
    const im = state.getRawIm();
    re[2] = 1.0;
    re[6] = 1.0;
    Kernel.applyCnot(re, im, 3, 1, 0);
    strictEqualCheck(re[2], 0);
    strictEqualCheck(re[3], 1);
    strictEqualCheck(re[6], 0);
    strictEqualCheck(re[7], 1);
  }
});

function strictEqualCheck(actual, expected) {
  ok(Object.is(actual, expected), `expected ${actual} to be identical to ${expected}`);
}
