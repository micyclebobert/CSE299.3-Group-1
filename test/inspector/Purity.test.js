// test/inspector/Purity.test.js
// Mirrors src/inspector/Purity.js 1:1 per CONVENTIONS.md #224

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { Purity } from '../../src/inspector/Purity.js';

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

test('Purity: |0> single qubit -> gamma=1, S_L=0', () => {
  const p = new Purity(stepTrace([1, 0], zeroIm(2), 1));
  strictEqual(p.gamma(0), 1.0);
  strictEqual(p.linearEntropy(0), 0.0);
});

test('Purity: |+> single qubit -> gamma=1, S_L=0 (pure state)', () => {
  const re = new Float64Array([SQRT2_INV, SQRT2_INV]);
  const p = new Purity(stepTrace(re, zeroIm(2), 1));
  ok(Math.abs(p.gamma(0) - 1.0) < TOL, '|+> gamma(0) ≈ 1');
  ok(Math.abs(p.linearEntropy(0)) < TOL, '|+> S_L(0) ≈ 0');
});

test('Purity: |00> product state -> gamma=1 on both rows, S_L=0', () => {
  const p = new Purity(stepTrace([1, 0, 0, 0], zeroIm(4), 2));
  for (const q of [0, 1]) {
    strictEqual(p.gamma(q), 1.0, `|00> gamma(${q}) = 1`);
    strictEqual(p.linearEntropy(q), 0.0, `|00> S_L(${q}) = 0`);
  }
});

test('Purity: Bell state via mock -> gamma=0.5 on both rows, S_L=0.5', () => {
  const re = new Float64Array([SQRT2_INV, 0, 0, SQRT2_INV]);
  const p = new Purity(stepTrace(re, zeroIm(4), 2));
  for (const q of [0, 1]) {
    ok(Math.abs(p.gamma(q) - 0.5) < TOL, `Bell gamma(${q}) ≈ 0.5, got ${p.gamma(q)}`);
    ok(Math.abs(p.linearEntropy(q) - 0.5) < TOL, `Bell S_L(${q}) ≈ 0.5, got ${p.linearEntropy(q)}`);
  }
});

test('Purity: 3-qubit GHZ via mock -> gamma=0.5 on all rows, S_L=0.5', () => {
  const re = new Float64Array(8);
  re[0] = SQRT2_INV;
  re[7] = SQRT2_INV;
  const p = new Purity(stepTrace(re, zeroIm(8), 3));
  for (const q of [0, 1, 2]) {
    ok(Math.abs(p.gamma(q) - 0.5) < TOL, `GHZ gamma(${q}) ≈ 0.5, got ${p.gamma(q)}`);
    ok(Math.abs(p.linearEntropy(q) - 0.5) < TOL, `GHZ S_L(${q}) ≈ 0.5, got ${p.linearEntropy(q)}`);
  }
});

test('Purity: computeAll writes gamma into outBuffer for all rows', () => {
  const re = new Float64Array([SQRT2_INV, 0, 0, SQRT2_INV]);
  const p = new Purity(stepTrace(re, zeroIm(4), 2));
  const buf = new Float64Array(2);
  const out = p.computeAll(buf);
  strictEqual(out, buf, 'computeAll returns the same buffer');
  strictEqual(out.length, 2, 'buffer length matches numQubits');
  ok(Math.abs(out[0] - 0.5) < TOL, `computeAll gamma[0] ≈ 0.5, got ${out[0]}`);
  ok(Math.abs(out[1] - 0.5) < TOL, `computeAll gamma[1] ≈ 0.5, got ${out[1]}`);
});
