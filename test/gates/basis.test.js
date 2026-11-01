// =============================================================================
// test/gates/basis.test.js
// -----------------------------------------------------------------------------
// Mirrors src/gates/basis.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, deepEqual } from 'assert';
import {
  I, X, Y, Z, H, S, T,
  I_MATRIX, X_MATRIX, Y_MATRIX, Z_MATRIX, H_MATRIX, S_MATRIX, T_MATRIX,
  matrixToFloat8,
} from '../../src/gates/basis.js';
import { Matrix } from '../../src/core/Matrix.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

// Seed the GateRegistry so evaluate() can resolve 'I', 'X', 'H', 'CNOT'.
import '../../src/main.js';

function approxEqual(a, b, tol = 1e-12) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
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

test('I flat tuple', () => {
  deepEqual(I, [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('X flat tuple', () => {
  deepEqual(X, [0, 0, 1, 0, 1, 0, 0, 0]);
});

test('Y flat tuple', () => {
  deepEqual(Y, [0, 0, 0, -1, 0, 1, 0, 0]);
});

test('Z flat tuple', () => {
  deepEqual(Z, [1, 0, 0, 0, 0, 0, -1, 0]);
});

test('H flat tuple', () => {
  const inv = 1 / Math.sqrt(2);
  deepEqual(H, [inv, 0, inv, 0, inv, 0, -inv, 0]);
});

test('S flat tuple', () => {
  deepEqual(S, [1, 0, 0, 0, 0, 0, 0, 1]);
});

test('T flat tuple', () => {
  const inv = 1 / Math.sqrt(2);
  deepEqual(T, [1, 0, 0, 0, 0, 0, inv, inv]);
});

test('all basis matrices are unitary', () => {
  const mats = [I_MATRIX, X_MATRIX, Y_MATRIX, Z_MATRIX, H_MATRIX, S_MATRIX, T_MATRIX];
  for (const m of mats) {
    ok(Matrix.isUnitary(m), `${m} should be unitary`);
  }
});

test('matrixToFloat8 produces 8 elements for 2x2', () => {
  const out = matrixToFloat8(X_MATRIX);
  strictEqual(out.length, 8);
  deepEqual([...out], X);
});

test('X|0> = |1> through flatten/scheduleColumns/evaluate', () => {
  const state = run(circuit(1, [[new Gate({ name: 'X', target: 0 })]]));
  strictEqual(state.size(), 2);
  approxEqual(state.getRe(0), 0);
  approxEqual(state.getRe(1), 1);
  approxEqual(state.getIm(0), 0);
  approxEqual(state.getIm(1), 0);
});

test('H|0> = |+> through flatten/scheduleColumns/evaluate', () => {
  const state = run(circuit(1, [[new Gate({ name: 'H', target: 0 })]]));
  const inv = 1 / Math.sqrt(2);
  approxEqual(state.getRe(0), inv);
  approxEqual(state.getRe(1), inv);
  approxEqual(state.getIm(0), 0);
  approxEqual(state.getIm(1), 0);
});

test('I^2 = I through evaluate', () => {
  const state = run(circuit(1, [
    [new Gate({ name: 'I', target: 0 })],
    [new Gate({ name: 'I', target: 0 })],
  ]));
  approxEqual(state.getRe(0), 1);
  approxEqual(state.getRe(1), 0);
  approxEqual(state.getIm(0), 0);
  approxEqual(state.getIm(1), 0);
});

test('H^2 = I through evaluate', () => {
  const state = run(circuit(1, [
    [new Gate({ name: 'H', target: 0 })],
    [new Gate({ name: 'H', target: 0 })],
  ]));
  approxEqual(state.getRe(0), 1);
  approxEqual(state.getRe(1), 0);
  approxEqual(state.getIm(0), 0);
  approxEqual(state.getIm(1), 0);
});

test('untouched amplitudes stay bit-identical under CNOT(0->1)', () => {
  const before = run(circuit(2, [[new Gate({ name: 'H', target: 0 })]]));
  const after = run(circuit(2, [
    [new Gate({ name: 'H', target: 0 })],
    [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })],
  ]));
  // CNOT(0->1) only updates pairs whose control row 0 is 1 (pair {1, 3}).
  // Indices 0 and 2 have control = 0 and must remain bit-identical.
  ok(Object.is(after.getRe(0), before.getRe(0)), 're[0] must be bit-identical');
  ok(Object.is(after.getIm(0), before.getIm(0)), 'im[0] must be bit-identical');
  ok(Object.is(after.getRe(2), before.getRe(2)), 're[2] must be bit-identical');
  ok(Object.is(after.getIm(2), before.getIm(2)), 'im[2] must be bit-identical');
});
