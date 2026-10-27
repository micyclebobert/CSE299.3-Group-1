// =============================================================================
// test/measurement/measurement.test.js
// -----------------------------------------------------------------------------
// Mirrors src/measurement/measurement.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { StateVector } from '../../src/core/StateVector.js';
import { collapse, sampleHistogram } from '../../src/measurement/measurement.js';

test('collapse on |0> yields index 0', () => {
  const state = new StateVector(2);
  const idx = collapse(state);
  strictEqual(idx, 0);
  strictEqual(state.getRe(0), 1);
  strictEqual(state.getIm(0), 0);
  for (let i = 1; i < 4; i++) {
    strictEqual(state.getRe(i), 0);
    strictEqual(state.getIm(i), 0);
  }
});

test('collapse on |11> (index 3) yields index 3', () => {
  const state = new StateVector(2);
  state.getRawRe()[0] = 0.0; // zero the |0> amplitude set by constructor
  state.getRawRe()[3] = 1.0;
  const idx = collapse(state);
  strictEqual(idx, 3);
  strictEqual(state.getRe(3), 1);
  for (let i = 0; i < 3; i++) {
    strictEqual(state.getRe(i), 0);
    strictEqual(state.getIm(i), 0);
  }
});

test('sampleHistogram returns a Map with counts summing to shots', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = 1 / Math.sqrt(2);
  state.getRawRe()[1] = 1 / Math.sqrt(2);
  const hist = sampleHistogram(state, 100);
  ok(hist instanceof Map);
  let total = 0;
  for (const v of hist.values()) total += v;
  strictEqual(total, 100);
});

test('sampleHistogram throws on invalid shots', () => {
  const state = new StateVector(1);
  let threw = false;
  try { sampleHistogram(state, 0); } catch { threw = true; }
  strictEqual(threw, true);
});
