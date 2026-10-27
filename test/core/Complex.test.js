// =============================================================================
// test/core/Complex.test.js
// -----------------------------------------------------------------------------
// Mirrors src/core/Complex.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { Complex } from '../../src/core/Complex.js';

const TOL = 1e-12;

function approx(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

test('Complex constructor defaults imaginary to 0', () => {
  const c = new Complex(3);
  strictEqual(c.real, 3);
  strictEqual(c.imaginary, 0);
});

test('Complex add', () => {
  const c = new Complex(1, 2).add(new Complex(3, 4));
  strictEqual(c.real, 4);
  strictEqual(c.imaginary, 6);
});

test('Complex sub', () => {
  const c = new Complex(5, 7).sub(new Complex(2, 3));
  strictEqual(c.real, 3);
  strictEqual(c.imaginary, 4);
});

test('Complex multiply', () => {
  const c = new Complex(1, 2).multiply(new Complex(3, 4));
  // (1+2i)(3+4i) = 3 + 4i + 6i + 8i^2 = -5 + 10i
  strictEqual(c.real, -5);
  strictEqual(c.imaginary, 10);
});

test('Complex conjugate', () => {
  const c = new Complex(3, -4).conjugate();
  strictEqual(c.real, 3);
  strictEqual(c.imaginary, 4);
});

test('Complex magnitudeSquared', () => {
  strictEqual(new Complex(3, 4).magnitudeSquared(), 25);
});

test('Complex magnitude', () => {
  approx(new Complex(3, 4).magnitude(), 5);
});

test('Complex phase', () => {
  approx(new Complex(1, 0).phase(), 0);
  approx(new Complex(0, 1).phase(), Math.PI / 2);
});

test('Complex from number', () => {
  const c = Complex.from(5);
  strictEqual(c.real, 5);
  strictEqual(c.imaginary, 0);
});

test('Complex fromPolar', () => {
  const c = Complex.fromPolar(2, 0);
  approx(c.real, 2);
  approx(c.imaginary, 0);
});
