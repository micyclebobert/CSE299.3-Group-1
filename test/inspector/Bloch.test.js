// test/inspector/Bloch.test.js
// Mirrors src/inspector/Bloch.js 1:1 per CONVENTIONS.md #224

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { Bloch } from '../../src/inspector/Bloch.js';

const TOL = 1e-12;
const SQRT2_INV = 1 / Math.sqrt(2);

function makeMockState(re, im, numQubits) {
  const size = 1 << numQubits;
  return {
    numQubits() { return numQubits; },
    size() { return size; },
    getRe(i) { return re[i]; },
    getIm(i) { return im[i]; },
    probability(i) { const r = re[i]; const ii = im[i]; return r * r + ii * ii; },
    probabilities() {
      const out = new Float64Array(size);
      for (let i = 0; i < size; i += 1) {
        const r = re[i]; const ii = im[i];
        out[i] = r * r + ii * ii;
      }
      return out;
    },
    normSquared() {
      let acc = 0;
      for (let i = 0; i < size; i += 1) {
        const r = re[i]; const ii = im[i];
        acc += r * r + ii * ii;
      }
      return acc;
    },
  };
}

function stepTrace(re, im, numQubits) {
  return { currentState: makeMockState(re, im, numQubits) };
}

function zeroIm(size) {
  return new Float64Array(size);
}

function vecLen(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

test('Bloch: |0> single qubit -> (0, 0, +1)', () => {
  const b = new Bloch(stepTrace([1, 0], zeroIm(2), 1));
  const v = b.vector(0);
  ok(Math.abs(v.x) < TOL, '|0> x ≈ 0');
  ok(Math.abs(v.y) < TOL, '|0> y ≈ 0');
  ok(Math.abs(v.z - 1.0) < TOL, '|0> z ≈ +1');
  ok(Math.abs(vecLen(v) - 1.0) < TOL, '|0> |r| = 1 (sphere surface)');
});

test('Bloch: |1> single qubit -> (0, 0, -1)', () => {
  const b = new Bloch(stepTrace([0, 1], zeroIm(2), 1));
  const v = b.vector(0);
  ok(Math.abs(v.x) < TOL, '|1> x ≈ 0');
  ok(Math.abs(v.y) < TOL, '|1> y ≈ 0');
  ok(Math.abs(v.z - (-1.0)) < TOL, '|1> z ≈ -1');
  ok(Math.abs(vecLen(v) - 1.0) < TOL, '|1> |r| = 1 (sphere surface)');
});

test('Bloch: |+> single qubit -> (+1, 0, 0)', () => {
  const re = new Float64Array([SQRT2_INV, SQRT2_INV]);
  const b = new Bloch(stepTrace(re, zeroIm(2), 1));
  const v = b.vector(0);
  ok(Math.abs(v.x - 1.0) < TOL, '|+> x ≈ +1');
  ok(Math.abs(v.y) < TOL, '|+> y ≈ 0');
  ok(Math.abs(v.z) < TOL, '|+> z ≈ 0');
  ok(Math.abs(vecLen(v) - 1.0) < TOL, '|+> |r| = 1 (sphere surface)');
});

test('Bloch: |-> single qubit -> (-1, 0, 0)', () => {
  const re = new Float64Array([SQRT2_INV, -SQRT2_INV]);
  const b = new Bloch(stepTrace(re, zeroIm(2), 1));
  const v = b.vector(0);
  ok(Math.abs(v.x - (-1.0)) < TOL, '|-> x ≈ -1');
  ok(Math.abs(v.y) < TOL, '|-> y ≈ 0');
  ok(Math.abs(v.z) < TOL, '|-> z ≈ 0');
  ok(Math.abs(vecLen(v) - 1.0) < TOL, '|-> |r| = 1 (sphere surface)');
});

test('Bloch: |i> single qubit -> (0, +1, 0)', () => {
  const re = new Float64Array([SQRT2_INV, 0]);
  const im = new Float64Array([0, SQRT2_INV]);
  const b = new Bloch(stepTrace(re, im, 1));
  const v = b.vector(0);
  ok(Math.abs(v.x) < TOL, '|i> x ≈ 0');
  ok(Math.abs(v.y - 1.0) < TOL, '|i> y ≈ +1');
  ok(Math.abs(v.z) < TOL, '|i> z ≈ 0');
  ok(Math.abs(vecLen(v) - 1.0) < TOL, '|i> |r| = 1 (sphere surface)');
});

test('Bloch: |-i> single qubit -> (0, -1, 0)', () => {
  const re = new Float64Array([SQRT2_INV, 0]);
  const im = new Float64Array([0, -SQRT2_INV]);
  const b = new Bloch(stepTrace(re, im, 1));
  const v = b.vector(0);
  ok(Math.abs(v.x) < TOL, '|-i> x ≈ 0');
  ok(Math.abs(v.y - (-1.0)) < TOL, '|-i> y ≈ -1');
  ok(Math.abs(v.z) < TOL, '|-i> z ≈ 0');
  ok(Math.abs(vecLen(v) - 1.0) < TOL, '|-i> |r| = 1 (sphere surface)');
});

test('Bloch: Bell state -> (0, 0, 0) on both rows, |r| = 0 (origin)', () => {
  const re = new Float64Array([SQRT2_INV, 0, 0, SQRT2_INV]);
  const b = new Bloch(stepTrace(re, zeroIm(4), 2));
  for (const q of [0, 1]) {
    const v = b.vector(q);
    ok(Math.abs(v.x) < TOL, `Bell row ${q} x ≈ 0`);
    ok(Math.abs(v.y) < TOL, `Bell row ${q} y ≈ 0`);
    ok(Math.abs(v.z) < TOL, `Bell row ${q} z ≈ 0`);
    ok(Math.abs(vecLen(v)) < TOL, `Bell row ${q} |r| = 0 (origin)`);
  }
});

test('Bloch: vector writes x, y, z into outBuffer at offset', () => {
  const re = new Float64Array([1, 0]);
  const b = new Bloch(stepTrace(re, zeroIm(2), 1));
  const buf = new Float64Array(6);
  const ret = b.vector(0, buf, 3);
  strictEqual(buf[3], ret.x, 'outBuffer[offset] = x');
  strictEqual(buf[4], ret.y, 'outBuffer[offset + 1] = y');
  strictEqual(buf[5], ret.z, 'outBuffer[offset + 2] = z');
  ok(Math.abs(buf[3]) < TOL, 'outBuffer x ≈ 0');
  ok(Math.abs(buf[4]) < TOL, 'outBuffer y ≈ 0');
  ok(Math.abs(buf[5] - 1.0) < TOL, 'outBuffer z ≈ +1');
});
