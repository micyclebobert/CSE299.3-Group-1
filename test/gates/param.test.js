// =============================================================================
// test/gates/param.test.js
// -----------------------------------------------------------------------------
// Mirrors src/gates/param.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import { Cu1, Rx, Ry, Rz } from '../../src/gates/param.js';
import { StateVector } from '../../src/core/StateVector.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

// Seed the GateRegistry so evaluate() can resolve 'Rx', 'Ry', 'Rz', 'Cu1', 'X', 'CNOT'.
import '../../src/main.js';

const TOL = 1e-10;

function approx(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

function tupleClose(actual, expected, tol = TOL) {
  strictEqual(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    approx(actual[i], expected[i], tol);
  }
}

function gateColumn(gates) {
  return new GateColumn({ gates });
}

function circuit(numQubits, columns) {
  return new Circuit({ numQubits, columns: columns.map(gateColumn) });
}

function run(circuit) {
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

function basisState(n, b) {
  const state = new StateVector(n);
  if (b !== 0) {
    state.set(0, 0, 0);
  }
  state.set(b, 1, 0);
  return state;
}

// Ideal single-qubit unitaries applied to a basis state, used for
// "up to global phase" identity checks (never hardcoded tuple literals).
const NEG_IX = [0, 0, 0, -1, 0, -1, 0, 0]; // -iX
const NEG_IY = [0, 0, -1, 0, 1, 0, 0, 0]; // -iY
const NEG_IZ = [0, -1, 0, 0, 0, 0, 0, 1]; // -iZ

function applyIdeal(state, target, gate) {
  const size = state.size();
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const halfBlock = 1 << target;
  const fullBlock = 2 << target;
  for (let blockStart = 0; blockStart < size; blockStart += fullBlock) {
    for (let offset = 0; offset < halfBlock; offset++) {
      const i0 = blockStart + offset;
      const i1 = i0 | halfBlock;
      const a0r = state.getRe(i0);
      const a0i = state.getIm(i0);
      const a1r = state.getRe(i1);
      const a1i = state.getIm(i1);
      const g00re = gate[0];
      const g00im = gate[1];
      const g01re = gate[2];
      const g01im = gate[3];
      const g10re = gate[4];
      const g10im = gate[5];
      const g11re = gate[6];
      const g11im = gate[7];
      re[i0] = g00re * a0r - g00im * a0i + g01re * a1r - g01im * a1i;
      im[i0] = g00re * a0i + g00im * a0r + g01re * a1i + g01im * a1r;
      re[i1] = g10re * a0r - g10im * a0i + g11re * a1r - g11im * a1i;
      im[i1] = g10re * a0i + g10im * a0r + g11re * a1i + g11im * a1r;
    }
  }
  return { re, im };
}

function statesEqualUpToGlobalPhase(actual, expected, tol = TOL) {
  const size = actual.size();
  let phase = null;
  for (let i = 0; i < size; i++) {
    const er = expected.re[i];
    const ei = expected.im[i];
    if (er * er + ei * ei > 1e-24) {
      const ar = actual.getRe(i);
      const ai = actual.getIm(i);
      const denom = er * er + ei * ei;
      phase = { re: (ar * er + ai * ei) / denom, im: (ai * er - ar * ei) / denom };
      break;
    }
  }
  ok(phase !== null, 'expected state must have a nonzero amplitude');
  ok(Math.abs(Math.hypot(phase.re, phase.im) - 1) <= tol, 'global phase must be unit modulus');
  for (let i = 0; i < size; i++) {
    const expR = expected.re[i] * phase.re - expected.im[i] * phase.im;
    const expI = expected.re[i] * phase.im + expected.im[i] * phase.re;
    approx(actual.getRe(i), expR, tol);
    approx(actual.getIm(i), expI, tol);
  }
}

test('Rx(0) = I', () => {
  const t = Rx(0);
  tupleClose(t, [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('Rx(pi)|0> = -iX|0> up to global phase', () => {
  const state = run(circuit(1, [[new Gate({ name: 'Rx', target: 0, thetaRad: Math.PI })]]));
  statesEqualUpToGlobalPhase(state, applyIdeal(basisState(1, 0), 0, NEG_IX));
});

test('Rx(pi)|1> = -iX|1> up to global phase', () => {
  const state = run(circuit(1, [
    [new Gate({ name: 'X', target: 0 })],
    [new Gate({ name: 'Rx', target: 0, thetaRad: Math.PI })],
  ]));
  statesEqualUpToGlobalPhase(state, applyIdeal(basisState(1, 1), 0, NEG_IX));
});

test('Ry(0) = I', () => {
  const t = Ry(0);
  tupleClose(t, [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('Ry(pi)|0> = -iY|0> up to global phase', () => {
  const state = run(circuit(1, [[new Gate({ name: 'Ry', target: 0, thetaRad: Math.PI })]]));
  statesEqualUpToGlobalPhase(state, applyIdeal(basisState(1, 0), 0, NEG_IY));
});

test('Ry(pi)|1> = -iY|1> up to global phase', () => {
  const state = run(circuit(1, [
    [new Gate({ name: 'X', target: 0 })],
    [new Gate({ name: 'Ry', target: 0, thetaRad: Math.PI })],
  ]));
  statesEqualUpToGlobalPhase(state, applyIdeal(basisState(1, 1), 0, NEG_IY));
});

test('Rz(0) = I', () => {
  const t = Rz(0);
  tupleClose(t, [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('Rz(pi)|0> = -iZ|0> up to global phase', () => {
  const state = run(circuit(1, [[new Gate({ name: 'Rz', target: 0, thetaRad: Math.PI })]]));
  statesEqualUpToGlobalPhase(state, applyIdeal(basisState(1, 0), 0, NEG_IZ));
});

test('Rz(pi)|1> = -iZ|1> up to global phase', () => {
  const state = run(circuit(1, [
    [new Gate({ name: 'X', target: 0 })],
    [new Gate({ name: 'Rz', target: 0, thetaRad: Math.PI })],
  ]));
  statesEqualUpToGlobalPhase(state, applyIdeal(basisState(1, 1), 0, NEG_IZ));
});

test('rotation tuples are length 8', () => {
  strictEqual(Rx(0.5).length, 8);
  strictEqual(Ry(0.5).length, 8);
  strictEqual(Rz(0.5).length, 8);
});

test('Cu1(pi) flat tuple', () => {
  tupleClose(Cu1(Math.PI), [1, 0, 0, 0, 0, 0, -1, 0]);
});

test('Cu1(pi) flips the phase of |11> through evaluate', () => {
  // H(0); CNOT(0->1) => (|00> + |11>)/sqrt(2).
  // Cu1(pi) with control=0, target=1 flips the phase of |11> only.
  const state = run(circuit(2, [
    [new Gate({ name: 'H', target: 0 })],
    [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })],
    [new Gate({ name: 'Cu1', target: 1, controls: [{ row: 0, on: true }], thetaRad: Math.PI })],
  ]));
  const inv = 1 / Math.sqrt(2);
  approx(state.getRe(0), inv);
  approx(state.getRe(3), -inv);
  approx(state.getIm(0), 0);
  approx(state.getIm(3), 0);
});

test('Rx throws TypeError on non-number theta', () => {
  throws(() => Rx('x'), TypeError);
  throws(() => Rx(undefined), TypeError);
  throws(() => Rx(null), TypeError);
});

test('Ry throws TypeError on non-number theta', () => {
  throws(() => Ry('x'), TypeError);
  throws(() => Ry(undefined), TypeError);
  throws(() => Ry(null), TypeError);
});

test('Rz throws TypeError on non-number theta', () => {
  throws(() => Rz('x'), TypeError);
  throws(() => Rz(undefined), TypeError);
  throws(() => Rz(null), TypeError);
});

test('untouched amplitudes stay bit-identical under controlled Cu1(pi)', () => {
  const before = run(circuit(2, [[new Gate({ name: 'H', target: 0 })]]));
  const after = run(circuit(2, [
    [new Gate({ name: 'H', target: 0 })],
    [new Gate({ name: 'Cu1', target: 1, controls: [{ row: 0, on: true }], thetaRad: Math.PI })],
  ]));
  // Cu1 only updates pairs whose control row 0 is 1. Indices 0 and 2 have
  // control = 0 and must remain bit-identical.
  ok(Object.is(after.getRe(0), before.getRe(0)), 're[0] must be bit-identical');
  ok(Object.is(after.getIm(0), before.getIm(0)), 'im[0] must be bit-identical');
  ok(Object.is(after.getRe(2), before.getRe(2)), 're[2] must be bit-identical');
  ok(Object.is(after.getIm(2), before.getIm(2)), 'im[2] must be bit-identical');
});
