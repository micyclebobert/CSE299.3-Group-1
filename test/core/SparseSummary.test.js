// test/core/SparseSummary.test.js
// -----------------------------------------------------------------------------
// Mirrors src/core/SparseSummary.js 1:1 per CONVENTIONS.md #224
// Verifies marginals(re, im, n): per-qubit single-qubit reduced density matrix
// marginals (rho00, rho11, rho01, gamma, S_L) from split Float64Array buffers.
// No DOM, no network. Runs via node --test.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { marginals } from '../../src/core/SparseSummary.js';

const TOL = 1e-12;

function approx(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

test('marginals returns array of length n', () => {
  const re = new Float64Array([1, 0, 0, 0]);
  const im = new Float64Array(4);
  const result = marginals(re, im, 2);
  strictEqual(result.length, 2);
});

test('marginals row indices are 0..n-1', () => {
  const re = new Float64Array([1, 0, 0, 0, 0, 0, 0, 0]);
  const im = new Float64Array(8);
  const result = marginals(re, im, 3);
  strictEqual(result.length, 3);
  for (let q = 0; q < 3; q++) {
    strictEqual(result[q].row, q);
  }
});

test('marginals for |00> state (n=2): all separable, rho00=1, S_L=0', () => {
  const re = new Float64Array([1, 0, 0, 0]);
  const im = new Float64Array(4);
  const result = marginals(re, im, 2);
  strictEqual(result.length, 2);
  for (const m of result) {
    approx(m.rho00, 1);
    approx(m.rho11, 0);
    approx(m.rho01.re, 0);
    approx(m.rho01.im, 0);
    approx(m.gamma, 1);
    approx(m.S_L, 0);
  }
});

test('marginals for |0> state (n=1): rho00=1, S_L=0', () => {
  const re = new Float64Array([1, 0]);
  const im = new Float64Array(2);
  const result = marginals(re, im, 1);
  strictEqual(result.length, 1);
  approx(result[0].rho00, 1);
  approx(result[0].rho11, 0);
  approx(result[0].rho01.re, 0);
  approx(result[0].rho01.im, 0);
  approx(result[0].gamma, 1);
  approx(result[0].S_L, 0);
});

test('marginals for |+> state (n=1): separable, S_L=0, gamma=1', () => {
  const invSqrt2 = 1 / Math.sqrt(2);
  const re = new Float64Array([invSqrt2, invSqrt2]);
  const im = new Float64Array(2);
  const result = marginals(re, im, 1);
  strictEqual(result.length, 1);
  approx(result[0].rho00, 0.5);
  approx(result[0].rho11, 0.5);
  approx(result[0].rho01.re, 0.5);
  approx(result[0].rho01.im, 0);
  approx(result[0].gamma, 1);
  approx(result[0].S_L, 0);
});

test('marginals for Bell state (n=2): rho00=0.5, S_L=0.5 on both rows', () => {
  const invSqrt2 = 1 / Math.sqrt(2);
  const re = new Float64Array([invSqrt2, 0, 0, invSqrt2]);
  const im = new Float64Array(4);
  const result = marginals(re, im, 2);
  strictEqual(result.length, 2);
  for (const m of result) {
    approx(m.rho00, 0.5);
    approx(m.rho11, 0.5);
    approx(m.rho01.re, 0);
    approx(m.rho01.im, 0);
    approx(m.gamma, 0.5);
    approx(m.S_L, 0.5);
  }
});

test('marginals for GHZ state (n=3): rho00=0.5, S_L=0.5 on all rows', () => {
  const invSqrt2 = 1 / Math.sqrt(2);
  const re = new Float64Array([invSqrt2, 0, 0, 0, 0, 0, 0, invSqrt2]);
  const im = new Float64Array(8);
  const result = marginals(re, im, 3);
  strictEqual(result.length, 3);
  for (const m of result) {
    approx(m.rho00, 0.5);
    approx(m.rho11, 0.5);
    approx(m.rho01.re, 0);
    approx(m.rho01.im, 0);
    approx(m.gamma, 0.5);
    approx(m.S_L, 0.5);
  }
});

test('marginals rho00 + rho11 = 1 for every row', () => {
  const re = new Float64Array([0.5, 0.5, 0, 0]);
  const im = new Float64Array(4);
  const result = marginals(re, im, 2);
  strictEqual(result.length, 2);
  for (const m of result) {
    approx(m.rho00 + m.rho11, 1);
  }
});
