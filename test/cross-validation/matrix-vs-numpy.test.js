// test/cross-validation/matrix-vs-numpy.test.js
// -----------------------------------------------------------------------------
// M1.3 — Matrix algebra cross-validation vs NumPy.
//
// Compares src/core/Matrix.js operations against NumPy:
//   - Matrix.multiply (matrix-matrix product)
//   - Matrix.tensorProduct (Kronecker product)
//   - Matrix.conjugateTranspose
//   - Matrix.isUnitary
//   - Matrix.frobeniusNormSquared
//
// Random complex matrices up to 4x4, tolerance 1e-12.
// numpy_ref.py computes references and emits JSON to stdout; Node test spawns
// it. Skips gracefully if NumPy unavailable, so `node --test` passes in bare
// environments.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { Complex } from '../../src/core/Complex.js';
import { Matrix } from '../../src/core/Matrix.js';

const REF_SCRIPT = new URL('./numpy_ref.py', import.meta.url).pathname;
const TOL = 1e-12;

/* ------------------------------------------------------------------ */
/*  Deterministic seeded PRNG (mulberry32)                            */
/* ------------------------------------------------------------------ */

let rngSeed = 0x243f6a88;
function randUint32() {
  rngSeed = (rngSeed + 0x9e3779b9) | 0;
  let z = rngSeed;
  z = (z ^ (z >>> 16)) >>> 0;
  z = Math.imul(z, 0x21f0aa8d) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

function randFloat(min, max) {
  return min + (randUint32() / 0xffffffff) * (max - min);
}

function randComplex() {
  return [randFloat(-10, 10), randFloat(-10, 10)];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Build a SimQC Matrix from nested [[re, im], ...] raw data. */
function complexMatrix(raw) {
  const data = raw.map((row) => row.map((cell) => new Complex(cell[0], cell[1])));
  return new Matrix(data);
}

/** Convert a SimQC Matrix to nested [[re, im], ...] raw data. */
function matrixToRaw(mat) {
  const out = [];
  for (let i = 0; i < mat.rows; i += 1) {
    const row = [];
    for (let j = 0; j < mat.cols; j += 1) {
      const c = mat.data[i][j];
      row.push([c.real, c.imaginary]);
    }
    out.push(row);
  }
  return out;
}

/** Assert two raw matrices match within tolerance. */
function assertMatricesClose(actual, expected, label) {
  strictEqual(actual.length, expected.length, `${label}: row count`);
  for (let i = 0; i < actual.length; i += 1) {
    strictEqual(
      actual[i].length,
      expected[i].length,
      `${label}: col count row ${i}`,
    );
    for (let j = 0; j < actual[i].length; j += 1) {
      ok(
        Math.abs(actual[i][j][0] - expected[i][j][0]) <= TOL,
        `${label}[${i}][${j}] re mismatch`,
      );
      ok(
        Math.abs(actual[i][j][1] - expected[i][j][1]) <= TOL,
        `${label}[${i}][${j}] im mismatch`,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Python numpy reference                                            */
/* ------------------------------------------------------------------ */

function isPython3Available() {
  try {
    const result = spawnSync('python3', ['--version'], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
}

function isNumpyAvailable() {
  try {
    const result = spawnSync(
      'python3',
      ['-c', 'import numpy'],
      { stdio: 'ignore' },
    );
    return result.status === 0;
  } catch {
    return false;
  }
}

function runRef(ops) {
  const result = spawnSync('python3', [REF_SCRIPT], {
    input: JSON.stringify({ ops }),
    encoding: 'utf-8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `numpy_ref.py exited ${result.status}: ${result.stderr.toString()}`,
    );
  }
  return JSON.parse(result.stdout).results;
}

const python3Available = isPython3Available();
const numpyAvailable = python3Available && isNumpyAvailable();

/* ------------------------------------------------------------------ */
/*  1. Hand-computed analytical values (always run)                   */
/* ------------------------------------------------------------------ */

test('Matrix multiply analytical: identity * A = A', () => {
  const A = complexMatrix([
    [[1, 2], [3, 4]],
    [[5, 6], [7, 8]],
  ]);
  const I = Matrix.identity(2);
  const result = Matrix.multiply(I, A);
  const raw = matrixToRaw(result);
  strictEqual(raw[0][0][0], 1);
  strictEqual(raw[0][0][1], 2);
  strictEqual(raw[0][1][0], 3);
  strictEqual(raw[0][1][1], 4);
  strictEqual(raw[1][0][0], 5);
  strictEqual(raw[1][0][1], 6);
  strictEqual(raw[1][1][0], 7);
  strictEqual(raw[1][1][1], 8);
});

test('Matrix multiply analytical: general 2x2 product', () => {
  const A = complexMatrix([
    [[1, 0], [2, 0]],
    [[3, 0], [4, 0]],
  ]);
  const B = complexMatrix([
    [[5, 0], [6, 0]],
    [[7, 0], [8, 0]],
  ]);
  // A @ B = [[19, 22], [43, 50]]
  const result = Matrix.multiply(A, B);
  const raw = matrixToRaw(result);
  strictEqual(raw[0][0][0], 19);
  strictEqual(raw[0][1][0], 22);
  strictEqual(raw[1][0][0], 43);
  strictEqual(raw[1][1][0], 50);
});

test('Matrix conjugateTranspose analytical', () => {
  const A = complexMatrix([
    [[1, 2], [3, 4]],
    [[5, 6], [7, 8]],
  ]);
  // A† = [[1-2i, 5-6i], [3-4i, 7-8i]]
  const result = A.conjugateTranspose();
  const raw = matrixToRaw(result);
  strictEqual(raw[0][0][0], 1);
  strictEqual(raw[0][0][1], -2);
  strictEqual(raw[0][1][0], 5);
  strictEqual(raw[0][1][1], -6);
  strictEqual(raw[1][0][0], 3);
  strictEqual(raw[1][0][1], -4);
  strictEqual(raw[1][1][0], 7);
  strictEqual(raw[1][1][1], -8);
});

test('Matrix tensorProduct analytical: I(2) kron X(2)', () => {
  const I2 = complexMatrix([
    [[1, 0], [0, 0]],
    [[0, 0], [1, 0]],
  ]);
  const X2 = complexMatrix([
    [[0, 0], [1, 0]],
    [[1, 0], [0, 0]],
  ]);
  // kron(I2, X2) = [[0,1,0,0],[1,0,0,0],[0,0,0,1],[0,0,1,0]]
  const result = Matrix.tensorProduct(I2, X2);
  const raw = matrixToRaw(result);
  strictEqual(raw.length, 4);
  strictEqual(raw[0][1][0], 1);
  strictEqual(raw[1][0][0], 1);
  strictEqual(raw[2][3][0], 1);
  strictEqual(raw[3][2][0], 1);
});

test('Matrix isUnitary: identity is unitary', () => {
  ok(Matrix.isUnitary(Matrix.identity(2)), 'identity 2x2 is unitary');
  ok(Matrix.isUnitary(Matrix.identity(4)), 'identity 4x4 is unitary');
});

test('Matrix isUnitary: all-ones matrix is not unitary', () => {
  const ones = complexMatrix([
    [[1, 0], [1, 0]],
    [[1, 0], [1, 0]],
  ]);
  ok(!Matrix.isUnitary(ones), 'all-ones 2x2 is not unitary');
});

test('Matrix frobeniusNormSquared analytical', () => {
  const I2 = Matrix.identity(2);
  strictEqual(I2.frobeniusNormSquared(), 2);
  const A = complexMatrix([
    [[3, 0], [4, 0]],
    [[0, 0], [0, 0]],
  ]);
  strictEqual(A.frobeniusNormSquared(), 25);
});

/* ------------------------------------------------------------------ */
/*  2. Python NumPy reference (skipped when python3/numpy unavailable) */
/* ------------------------------------------------------------------ */

if (!python3Available || !numpyAvailable) {
  test.todo('Matrix vs NumPy (python3/numpy unavailable)');
} else {
  test('Matrix vs NumPy: random multiply, tensorProduct, conjugateTranspose, isUnitary, frobeniusNormSquared', () => {
    const sizes = [1, 2, 3, 4];
    const trials = 25;

    // Build ops and corresponding SimQC matrices in a single deterministic pass.
    const ops = [];
    const cases = []; // each: { label, kind, aMat, bMat?, expectedIndex }

    for (let trial = 0; trial < trials; trial += 1) {
      const ra = sizes[randUint32() % sizes.length];
      const ca = sizes[randUint32() % sizes.length];
      const rb = sizes[randUint32() % sizes.length];
      const cb = sizes[randUint32() % sizes.length];

      const aRaw = [];
      for (let i = 0; i < ra; i += 1) {
        const row = [];
        for (let j = 0; j < ca; j += 1) {
          row.push(randComplex());
        }
        aRaw.push(row);
      }
      const bRaw = [];
      for (let i = 0; i < rb; i += 1) {
        const row = [];
        for (let j = 0; j < cb; j += 1) {
          row.push(randComplex());
        }
        bRaw.push(row);
      }

      const aMat = complexMatrix(aRaw);
      const bMat = complexMatrix(bRaw);
      const labelBase = `trial[${trial}] ${ra}x${ca} x ${rb}x${cb}`;

      if (ca === rb) {
        ops.push({ op: 'multiply', a: aRaw, b: bRaw });
        cases.push({
          label: `${labelBase} multiply`,
          kind: 'multiply',
          aMat,
          bMat,
        });
      }

      ops.push({ op: 'tensorProduct', a: aRaw, b: bRaw });
      cases.push({
        label: `${labelBase} tensorProduct`,
        kind: 'tensorProduct',
        aMat,
        bMat,
      });

      ops.push({ op: 'conjugateTranspose', a: aRaw });
      cases.push({
        label: `${labelBase} conjugateTranspose`,
        kind: 'conjugateTranspose',
        aMat,
      });

      if (ra === ca) {
        ops.push({ op: 'isUnitary', a: aRaw });
        cases.push({
          label: `${labelBase} isUnitary`,
          kind: 'isUnitary',
          aMat,
        });
      }

      ops.push({ op: 'frobeniusNormSquared', a: aRaw });
      cases.push({
        label: `${labelBase} frobeniusNormSquared`,
        kind: 'frobeniusNormSquared',
        aMat,
      });
    }

    const ref = runRef(ops);
    strictEqual(ref.length, ops.length, 'reference result count');

    let idx = 0;
    for (const c of cases) {
      if (c.kind === 'multiply') {
        const actual = matrixToRaw(Matrix.multiply(c.aMat, c.bMat));
        assertMatricesClose(actual, ref[idx], c.label);
      } else if (c.kind === 'tensorProduct') {
        const actual = matrixToRaw(Matrix.tensorProduct(c.aMat, c.bMat));
        assertMatricesClose(actual, ref[idx], c.label);
      } else if (c.kind === 'conjugateTranspose') {
        const actual = matrixToRaw(c.aMat.conjugateTranspose());
        assertMatricesClose(actual, ref[idx], c.label);
      } else if (c.kind === 'isUnitary') {
        ok(
          Matrix.isUnitary(c.aMat, TOL) === ref[idx],
          `${c.label}: isUnitary mismatch`,
        );
      } else if (c.kind === 'frobeniusNormSquared') {
        ok(
          Math.abs(c.aMat.frobeniusNormSquared() - ref[idx]) <= TOL,
          `${c.label}: frobeniusNormSquared mismatch`,
        );
      }
      idx += 1;
    }
  });
}
