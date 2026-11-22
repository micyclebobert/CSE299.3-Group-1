// test/inspector/Inspector.test.js
// Mirrors src/inspector/Inspector.js 1:1 per CONVENTIONS.md #224

import { test } from 'node:test';
import { ok, strictEqual, deepStrictEqual } from 'assert';
import { Inspector } from '../../src/inspector/Inspector.js';

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

test('Inspector: amplitudes returns one entry per basis index', () => {
  const re = new Float64Array([1, 0, 0, 0]);
  const im = new Float64Array(4);
  const insp = new Inspector(stepTrace(re, im, 2));
  const amps = insp.amplitudes();
  strictEqual(amps.length, 4, 'one entry per basis index (2^n)');
  deepStrictEqual(amps[0], { index: 0, re: 1, im: 0, prob: 1 });
  deepStrictEqual(amps[1], { index: 1, re: 0, im: 0, prob: 0 });
  deepStrictEqual(amps[2], { index: 2, re: 0, im: 0, prob: 0 });
  deepStrictEqual(amps[3], { index: 3, re: 0, im: 0, prob: 0 });
});

test('Inspector: probabilities delegates to currentState.probabilities()', () => {
  const re = new Float64Array([SQRT2_INV, 0, 0, SQRT2_INV]);
  const im = new Float64Array(4);
  const insp = new Inspector(stepTrace(re, im, 2));
  const probs = insp.probabilities();
  strictEqual(probs.length, 4, 'probabilities length matches state size');
  ok(Math.abs(probs[0] - 0.5) < 1e-12, 'prob[0] = 0.5');
  ok(Math.abs(probs[1]) < 1e-12, 'prob[1] = 0');
  ok(Math.abs(probs[2]) < 1e-12, 'prob[2] = 0');
  ok(Math.abs(probs[3] - 0.5) < 1e-12, 'prob[3] = 0.5');
});

test('Inspector: ketLabels returns little-endian binary labels for 2 qubits', () => {
  const insp = new Inspector(stepTrace([1, 0, 0, 0], new Float64Array(4), 2));
  const labels = insp.ketLabels();
  deepStrictEqual(labels, ['|00>', '|01>', '|10>', '|11>']);
});

test('Inspector: ketLabels returns little-endian binary labels for 1 qubit', () => {
  const insp = new Inspector(stepTrace([1, 0], new Float64Array(2), 1));
  const labels = insp.ketLabels();
  deepStrictEqual(labels, ['|0>', '|1>']);
});

test('Inspector: amplitudes includes correct probability for superposition', () => {
  const re = new Float64Array([SQRT2_INV, SQRT2_INV]);
  const im = new Float64Array(2);
  const insp = new Inspector(stepTrace(re, im, 1));
  const amps = insp.amplitudes();
  strictEqual(amps.length, 2, 'one entry per basis index (2^1)');
  ok(Math.abs(amps[0].prob - 0.5) < 1e-12, '|+> prob[0] = 0.5');
  ok(Math.abs(amps[1].prob - 0.5) < 1e-12, '|+> prob[1] = 0.5');
  strictEqual(amps[0].re, SQRT2_INV, '|+> re[0] = 1/sqrt(2)');
  strictEqual(amps[0].im, 0, '|+> im[0] = 0');
});
