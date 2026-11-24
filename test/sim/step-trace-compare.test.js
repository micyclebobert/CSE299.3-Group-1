// =============================================================================
// test/sim/step-trace-compare.test.js
// -----------------------------------------------------------------------------
// Mirrors src/sim/step-trace-compare.js 1:1 per CONVENTIONS.md #224
// Tolerance selection and component-wise state comparison.
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { toleranceFor, compareStates } from '../../src/sim/step-trace-compare.js';

test('toleranceFor returns 1e-12 for n <= 8', () => {
  strictEqual(toleranceFor(1), 1e-12);
  strictEqual(toleranceFor(8), 1e-12);
});

test('toleranceFor returns 1e-9 for n > 8', () => {
  strictEqual(toleranceFor(9), 1e-9);
  strictEqual(toleranceFor(13), 1e-9);
  strictEqual(toleranceFor(24), 1e-9);
});

test('compareStates identical vectors returns ok true', () => {
  const re = new Float64Array([0.5, 0.5, 0, 0]);
  const im = new Float64Array([0.5, 0.5, 0, 0]);
  const result = compareStates(re, im, re, im, 1e-12);
  strictEqual(result.ok, true);
  strictEqual(result.index, undefined);
});

test('compareStates differing vectors returns ok false with first index', () => {
  const reA = new Float64Array([0.5, 0.5, 0, 0]);
  const imA = new Float64Array([0.5, 0.5, 0, 0]);
  const reB = new Float64Array([0.5, 0.5, 0, 1e-6]);
  const imB = new Float64Array([0.5, 0.5, 0, 0]);
  const result = compareStates(reA, imA, reB, imB, 1e-12);
  strictEqual(result.ok, false);
  strictEqual(result.index, 3);
  ok(typeof result.msg === 'string' && result.msg.length > 0);
});

test('compareStates within tolerance returns ok true', () => {
  const reA = new Float64Array([0.5, 0.5]);
  const imA = new Float64Array([0.5, 0.5]);
  const reB = new Float64Array([0.5, 0.5000000000001]);
  const imB = new Float64Array([0.5, 0.5]);
  const result = compareStates(reA, imA, reB, imB, 1e-9);
  strictEqual(result.ok, true);
});