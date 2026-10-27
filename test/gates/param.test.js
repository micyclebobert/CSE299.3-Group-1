// =============================================================================
// test/gates/param.test.js
// -----------------------------------------------------------------------------
// Mirrors src/gates/param.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { Rx, Ry, Rz } from '../../src/gates/param.js';

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

test('Rx(0) = I', () => {
  const t = Rx(0);
  tupleClose(t, [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('Rx(pi) = -iX up to global phase', () => {
  const t = Rx(Math.PI);
  approx(t[0], 0);
  approx(t[1], 0);
  approx(t[2], 0);
  approx(t[3], -1);
  approx(t[4], 0);
  approx(t[5], -1);
  approx(t[6], 0);
  approx(t[7], 0);
});

test('Ry(0) = I', () => {
  const t = Ry(0);
  tupleClose(t, [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('Ry(pi) = -iY up to global phase', () => {
  const t = Ry(Math.PI);
  approx(t[0], 0);
  approx(t[1], 0);
  approx(t[2], -1);
  approx(t[3], 0);
  approx(t[4], 1);
  approx(t[5], 0);
  approx(t[6], 0);
  approx(t[7], 0);
});

test('Rz(0) = I', () => {
  const t = Rz(0);
  tupleClose(t, [1, 0, 0, 0, 0, 0, 1, 0]);
});

test('Rz(pi) = diag(-i, i)', () => {
  const t = Rz(Math.PI);
  approx(t[0], 0);
  approx(t[1], -1);
  approx(t[2], 0);
  approx(t[3], 0);
  approx(t[4], 0);
  approx(t[5], 0);
  approx(t[6], 0);
  approx(t[7], 1);
});

test('rotation tuples are length 8', () => {
  strictEqual(Rx(0.5).length, 8);
  strictEqual(Ry(0.5).length, 8);
  strictEqual(Rz(0.5).length, 8);
});
