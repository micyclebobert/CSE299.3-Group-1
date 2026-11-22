// test/inspector/InspectorUI.test.js
// Mirrors src/inspector/InspectorUI.js 1:1 per CONVENTIONS.md #224

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { InspectorUI } from '../../src/inspector/InspectorUI.js';

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

test('InspectorUI: probabilities returns currentState.probabilities()', () => {
  const re = new Float64Array([SQRT2_INV, 0, 0, SQRT2_INV]);
  const im = new Float64Array(4);
  const ui = new InspectorUI(stepTrace(re, im, 2));
  const probs = ui.probabilities();
  strictEqual(probs.length, 4, 'probabilities length matches state size');
  ok(Math.abs(probs[0] - 0.5) < 1e-12, 'prob[0] = 0.5');
  ok(Math.abs(probs[3] - 0.5) < 1e-12, 'prob[3] = 0.5');
});

test('InspectorUI: probabilities is a Float64Array', () => {
  const ui = new InspectorUI(stepTrace([1, 0], new Float64Array(2), 1));
  const probs = ui.probabilities();
  ok(probs instanceof Float64Array, 'probabilities returns a Float64Array');
  strictEqual(probs[0], 1, '|0> prob[0] = 1');
  strictEqual(probs[1], 0, '|0> prob[1] = 0');
});

test('InspectorUI: construction requires a stepTrace', () => {
  const ui = new InspectorUI(stepTrace([1, 0], new Float64Array(2), 1));
  ok(ui instanceof InspectorUI, 'InspectorUI instance constructed');
  strictEqual(typeof ui.probabilities, 'function', 'probabilities is a method');
});
