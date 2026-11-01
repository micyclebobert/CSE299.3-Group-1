// =============================================================================
// test/core/StateVector.test.js
// -----------------------------------------------------------------------------
// Mirrors src/core/StateVector.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
import { StateVector } from '../../src/core/StateVector.js';

const TOL = 1e-12;

function approx(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

test('StateVector initializes to |0...0>', () => {
  const state = new StateVector(3);
  strictEqual(state.numQubits(), 3);
  strictEqual(state.size(), 8);
  strictEqual(state.getRe(0), 1.0);
  strictEqual(state.getIm(0), 0);
  for (let i = 1; i < 8; i++) {
    strictEqual(state.getRe(i), 0);
    strictEqual(state.getIm(i), 0);
  }
  approx(state.normSquared(), 1.0);
});

test('getRe/getIm', () => {
  const state = new StateVector(2);
  state.set(2, 3.0, 4.0);
  strictEqual(state.getRe(2), 3.0);
  strictEqual(state.getIm(2), 4.0);
});

test('set rejects non-numbers', () => {
  const state = new StateVector(1);
  throws(() => state.set(0, 'a', 0), TypeError);
  throws(() => state.set(0, 0, 'b'), TypeError);
});

test('probability', () => {
  const state = new StateVector(1);
  state.set(0, 0.6, 0.8);
  approx(state.probability(0), 0.36 + 0.64);
});

test('probabilities sums to 1', () => {
  const state = new StateVector(2);
  state.set(0, 1 / Math.sqrt(2), 0);
  state.set(3, 1 / Math.sqrt(2), 0);
  const probs = state.probabilities();
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += probs[i];
  approx(sum, 1.0);
});

test('normSquared', () => {
  const state = new StateVector(2);
  state.set(0, 1, 0);
  state.set(1, 0, 1);
  approx(state.normSquared(), 2.0);
});

test('clone is deep copy', () => {
  const state = new StateVector(2);
  state.set(1, 5.0, 6.0);
  const copy = state.clone();
  strictEqual(copy.getRe(1), 5.0);
  strictEqual(copy.getIm(1), 6.0);
  // Mutating clone does not affect original
  copy.set(1, 9, 9);
  strictEqual(state.getRe(1), 5.0);
  strictEqual(state.getIm(1), 6.0);
});

test('getRawRe/getRawIm return the internal buffers', () => {
  const state = new StateVector(2);
  const re = state.getRawRe();
  const im = state.getRawIm();
  re[3] = 7.0;
  strictEqual(state.getRe(3), 7.0);
});

test('renormalize', () => {
  const state = new StateVector(1);
  state.set(0, 2, 0);
  state.renormalize();
  approx(state.getRe(0), 1.0);
  approx(state.normSquared(), 1.0);
});

test('untouched amplitudes remain bit-identical (Object.is)', () => {
  const state = new StateVector(3);
  const before = state.get(5);
  state.set(2, 3.0, 4.0);
  strictEqual(state.getRe(2), 3.0);
  strictEqual(state.getIm(2), 4.0);
  strictEqual(Object.is(state.getRe(5), before[0]), true);
  strictEqual(Object.is(state.getIm(5), before[1]), true);
  for (let i = 0; i < 8; i++) {
    if (i !== 2) {
      strictEqual(Object.is(state.getRe(i), i === 0 ? 1.0 : 0), true);
      strictEqual(Object.is(state.getIm(i), 0), true);
    }
  }
});

test('StateVector(0) is a valid one-dimensional state', () => {
  const state = new StateVector(0);
  strictEqual(state.numQubits(), 0);
  strictEqual(state.size(), 1);
  strictEqual(state.getRe(0), 1.0);
  strictEqual(state.getIm(0), 0);
  approx(state.normSquared(), 1.0);
});

test('constructor throws for negative numQubits', () => {
  throws(() => new StateVector(-1), RangeError);
});

test('get(i) bounds checks', () => {
  const state = new StateVector(2);
  strictEqual(Object.is(state.get(0)[0], 1.0), true);
  const out = state.get(4);
  strictEqual(out[0], undefined);
  strictEqual(out[1], undefined);
  const neg = state.get(-1);
  strictEqual(neg[0], undefined);
  strictEqual(neg[1], undefined);
});

test('renormalize throws on zero norm', () => {
  const state = new StateVector(1);
  state.set(0, 0, 0);
  throws(() => state.renormalize(), Error);
});

test('renormalize throws on non-finite norm', () => {
  const state = new StateVector(1);
  state.set(0, Infinity, 0);
  throws(() => state.renormalize(), Error);
});
