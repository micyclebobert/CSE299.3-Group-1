// =============================================================================
// test/gates/basis.test.js
// -----------------------------------------------------------------------------
// Mirrors src/gates/basis.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, deepEqual } from 'assert';
import {
  I, X, Y, Z, H, S, T,
  I_MATRIX, X_MATRIX, Y_MATRIX, Z_MATRIX, H_MATRIX, S_MATRIX, T_MATRIX,
  matrixToFloat8,
} from '../../src/gates/basis.js';
import { Matrix } from '../../src/core/Matrix.js';

const TOL = 1e-12;

function approx(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
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
