// =============================================================================
// test/core/Matrix.test.js
// -----------------------------------------------------------------------------
// Mirrors src/core/Matrix.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { Complex } from '../../src/core/Complex.js';
import { Matrix } from '../../src/core/Matrix.js';

const TOL = 1e-12;

function approx(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

test('Matrix identity', () => {
  const I = Matrix.identity(2);
  strictEqual(I.rows, 2);
  strictEqual(I.cols, 2);
  strictEqual(I.data[0][0].real, 1);
  strictEqual(I.data[0][1].real, 0);
  strictEqual(I.data[1][0].real, 0);
  strictEqual(I.data[1][1].real, 1);
});

test('Matrix multiply by identity', () => {
  const A = new Matrix([
    [new Complex(1, 2), new Complex(3, 4)],
    [new Complex(5, 6), new Complex(7, 8)],
  ]);
  const I2 = Matrix.identity(2);
  const result = A.multiply(I2);
  strictEqual(result.data[0][0].real, 1);
  strictEqual(result.data[0][0].imaginary, 2);
  strictEqual(result.data[1][1].real, 7);
  strictEqual(result.data[1][1].imaginary, 8);
});

test('Matrix conjugateTranspose', () => {
  const M = new Matrix([
    [new Complex(1, 2), new Complex(3, 4)],
    [new Complex(5, 6), new Complex(7, 8)],
  ]);
  const ct = M.conjugateTranspose();
  strictEqual(ct.data[0][0].real, 1);
  strictEqual(ct.data[0][0].imaginary, -2);
  strictEqual(ct.data[0][1].real, 5);
  strictEqual(ct.data[0][1].imaginary, -6);
  strictEqual(ct.data[1][0].real, 3);
  strictEqual(ct.data[1][0].imaginary, -4);
});

test('Matrix isUnitary accepts identity', () => {
  ok(Matrix.isUnitary(Matrix.identity(2)));
});

test('Matrix isUnitary rejects non-unitary', () => {
  const M = new Matrix([
    [new Complex(2, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(2, 0)],
  ]);
  ok(!Matrix.isUnitary(M));
});

test('Matrix tensorProduct', () => {
  const I2 = Matrix.identity(2);
  const product = Matrix.tensorProduct(I2, I2);
  strictEqual(product.rows, 4);
  strictEqual(product.cols, 4);
  // I2 tensor I2 = I4
  ok(Matrix.isUnitary(product));
});
