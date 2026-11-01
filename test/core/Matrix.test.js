// =============================================================================
// test/core/Matrix.test.js
// -----------------------------------------------------------------------------
// Mirrors src/core/Matrix.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
import { Complex } from '../../src/core/Complex.js';
import { Matrix } from '../../src/core/Matrix.js';

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
  strictEqual(result.data[0][1].real, 3);
  strictEqual(result.data[0][1].imaginary, 4);
  strictEqual(result.data[1][0].real, 5);
  strictEqual(result.data[1][0].imaginary, 6);
  strictEqual(result.data[1][1].real, 7);
  strictEqual(result.data[1][1].imaginary, 8);
});

test('Matrix multiply by identity on the left', () => {
  const A = new Matrix([
    [new Complex(1, 2), new Complex(3, 4)],
    [new Complex(5, 6), new Complex(7, 8)],
  ]);
  const I2 = Matrix.identity(2);
  const result = I2.multiply(A);
  strictEqual(result.data[0][0].real, 1);
  strictEqual(result.data[0][0].imaginary, 2);
  strictEqual(result.data[0][1].real, 3);
  strictEqual(result.data[0][1].imaginary, 4);
  strictEqual(result.data[1][0].real, 5);
  strictEqual(result.data[1][0].imaginary, 6);
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
  strictEqual(ct.data[1][1].real, 7);
  strictEqual(ct.data[1][1].imaginary, -8);
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
  // I2 tensor I2 = I4: assert all 16 elements exactly
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const expected = i === j ? new Complex(1, 0) : new Complex(0, 0);
      strictEqual(product.data[i][j].real, expected.real);
      strictEqual(product.data[i][j].imaginary, expected.imaginary);
    }
  }
  // Non-trivial case: X tensor Z
  const X = new Matrix([
    [new Complex(0, 0), new Complex(1, 0)],
    [new Complex(1, 0), new Complex(0, 0)],
  ]);
  const Z = new Matrix([
    [new Complex(1, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(-1, 0)],
  ]);
  const xz = Matrix.tensorProduct(X, Z);
  strictEqual(xz.data[0][0].real, 0);
  strictEqual(xz.data[0][1].real, 0);
  strictEqual(xz.data[0][2].real, 1);
  strictEqual(xz.data[0][3].real, 0);
  strictEqual(xz.data[1][0].real, 0);
  strictEqual(xz.data[1][1].real, -0);
  strictEqual(xz.data[1][2].real, 0);
  strictEqual(xz.data[1][3].real, -1);
  strictEqual(xz.data[2][0].real, 1);
  strictEqual(xz.data[2][1].real, 0);
  strictEqual(xz.data[2][2].real, 0);
  strictEqual(xz.data[2][3].real, 0);
  strictEqual(xz.data[3][0].real, 0);
  strictEqual(xz.data[3][1].real, -1);
  strictEqual(xz.data[3][2].real, 0);
  strictEqual(xz.data[3][3].real, -0);
});

test('Matrix zeros', () => {
  const Z = Matrix.zeros(2, 3);
  strictEqual(Z.rows, 2);
  strictEqual(Z.cols, 3);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      strictEqual(Z.data[i][j].real, 0);
      strictEqual(Z.data[i][j].imaginary, 0);
    }
  }
});

test('Matrix add', () => {
  const A = new Matrix([
    [new Complex(1, 2), new Complex(3, 4)],
    [new Complex(5, 6), new Complex(7, 8)],
  ]);
  const B = new Matrix([
    [new Complex(1, 0), new Complex(0, 1)],
    [new Complex(2, 0), new Complex(0, 2)],
  ]);
  const C = Matrix.add(A, B);
  strictEqual(C.data[0][0].real, 2);
  strictEqual(C.data[0][0].imaginary, 2);
  strictEqual(C.data[0][1].real, 3);
  strictEqual(C.data[0][1].imaginary, 5);
  strictEqual(C.data[1][0].real, 7);
  strictEqual(C.data[1][0].imaginary, 6);
  strictEqual(C.data[1][1].real, 7);
  strictEqual(C.data[1][1].imaginary, 10);
  const D = A.add(B);
  strictEqual(D.data[1][1].real, 7);
  strictEqual(D.data[1][1].imaginary, 10);
});

test('Matrix sub', () => {
  const A = new Matrix([
    [new Complex(1, 2), new Complex(3, 4)],
    [new Complex(5, 6), new Complex(7, 8)],
  ]);
  const B = new Matrix([
    [new Complex(1, 0), new Complex(0, 1)],
    [new Complex(2, 0), new Complex(0, 2)],
  ]);
  const C = Matrix.sub(A, B);
  strictEqual(C.data[0][0].real, 0);
  strictEqual(C.data[0][0].imaginary, 2);
  strictEqual(C.data[1][1].real, 7);
  strictEqual(C.data[1][1].imaginary, 6);
  const D = A.sub(B);
  strictEqual(D.data[0][1].real, 3);
  strictEqual(D.data[0][1].imaginary, 3);
});

test('Matrix scalar', () => {
  const A = new Matrix([
    [new Complex(1, 2), new Complex(3, 4)],
    [new Complex(5, 6), new Complex(7, 8)],
  ]);
  const C = Matrix.scalar(A, 2);
  strictEqual(C.data[0][0].real, 2);
  strictEqual(C.data[0][0].imaginary, 4);
  strictEqual(C.data[1][1].real, 14);
  strictEqual(C.data[1][1].imaginary, 16);
  const D = A.scalar(3);
  strictEqual(D.data[0][1].real, 9);
  strictEqual(D.data[0][1].imaginary, 12);
});

test('Matrix frobeniusNormSquared instance', () => {
  const A = new Matrix([
    [new Complex(1, 2), new Complex(3, 4)],
    [new Complex(5, 6), new Complex(7, 8)],
  ]);
  // 1^2+2^2 + 3^2+4^2 + 5^2+6^2 + 7^2+8^2 = 204
  strictEqual(A.frobeniusNormSquared(), 204);
  strictEqual(Matrix.zeros(2, 2).frobeniusNormSquared(), 0);
});

test('Matrix dimension mismatch throws', () => {
  const A = Matrix.identity(2);
  const B = Matrix.identity(3);
  throws(() => Matrix.add(A, B), Error);
  throws(() => Matrix.sub(A, B), Error);
  throws(() => A.add(B), Error);
  throws(() => A.sub(B), Error);
  const C = new Matrix([
    [new Complex(1, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(1, 0)],
    [new Complex(0, 0), new Complex(0, 0)],
  ]);
  throws(() => Matrix.multiply(A, C), Error);
});

test('Matrix NaN and Infinity input edge cases', () => {
  const N = new Matrix([
    [new Complex(NaN, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(1, 0)],
  ]);
  const I2 = Matrix.identity(2);
  const prod = Matrix.multiply(N, I2);
  ok(Number.isNaN(prod.data[0][0].real));
  const infNorm = new Matrix([
    [new Complex(Infinity, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(0, 0)],
  ]);
  ok(!Number.isFinite(infNorm.frobeniusNormSquared()));
});
