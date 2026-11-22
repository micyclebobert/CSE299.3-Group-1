// test/inspector/Histogram.test.js
// Mirrors src/inspector/Histogram.js 1:1 per CONVENTIONS.md #224

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { Histogram } from '../../src/inspector/Histogram.js';

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

test('Histogram: |0> state samples only index 0', () => {
  const h = new Histogram(stepTrace([1, 0], new Float64Array(2), 1));
  const counts = h.sample(100);
  ok(counts instanceof Map, 'sample returns a Map');
  strictEqual(counts.size, 1, 'only one basis index observed');
  strictEqual(counts.get(0), 100, 'all 100 shots at index 0');
  let total = 0;
  for (const c of counts.values()) total += c;
  strictEqual(total, 100, 'total counts equal shots');
});

test('Histogram: |1> state samples only index 1', () => {
  const h = new Histogram(stepTrace([0, 1], new Float64Array(2), 1));
  const counts = h.sample(50);
  strictEqual(counts.size, 1, 'only one basis index observed');
  strictEqual(counts.get(1), 50, 'all 50 shots at index 1');
});

test('Histogram: |+> state with deterministic rng splits evenly', () => {
  const invSqrt2 = 1 / Math.sqrt(2);
  const re = new Float64Array([invSqrt2, invSqrt2]);
  const h = new Histogram(stepTrace(re, new Float64Array(2), 1));
  let calls = 0;
  const counts = h.sample(100, () => {
    calls += 1;
    return calls % 2 === 1 ? 0.25 : 0.75;
  });
  strictEqual(calls, 100, 'rng invoked once per shot');
  strictEqual(counts.get(0), 50, '50 shots at index 0');
  strictEqual(counts.get(1), 50, '50 shots at index 1');
});

test('Histogram: rng=0 picks lowest index with nonzero cumulative probability', () => {
  const invSqrt2 = 1 / Math.sqrt(2);
  const re = new Float64Array([0, invSqrt2, invSqrt2, 0]);
  const h = new Histogram(stepTrace(re, new Float64Array(4), 2));
  const counts = h.sample(10, () => 0);
  strictEqual(counts.size, 1, 'single index selected');
  strictEqual(counts.get(1), 10, 'rng=0 lands on index 1 (first cumulative > 0)');
});

test('Histogram: total counts always equal shots', () => {
  const invSqrt2 = 1 / Math.sqrt(2);
  const re = new Float64Array([invSqrt2, 0, 0, invSqrt2]);
  const h = new Histogram(stepTrace(re, new Float64Array(4), 2));
  const counts = h.sample(1000);
  let total = 0;
  for (const c of counts.values()) total += c;
  strictEqual(total, 1000, 'empirical total equals shots');
  ok(counts.get(0) !== undefined || counts.get(3) !== undefined, 'only indices 0 and 3 have nonzero probability');
});
