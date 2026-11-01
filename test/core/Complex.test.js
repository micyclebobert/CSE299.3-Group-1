// =============================================================================
// test/core/Complex.test.js
// -----------------------------------------------------------------------------
// Mirrors src/core/Complex.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
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

test('Complex divide', () => {
  // (1+2i)/(3+4i) = (1+2i)(3-4i) / (3^2 + 4^2) = (11+2i)/25 = 0.44 + 0.08i
  const result = new Complex(1, 2).divide(new Complex(3, 4));
  approx(result.real, 11 / 25);
  approx(result.imaginary, 2 / 25);
});

test('Complex divide by zero throws RangeError', () => {
  throws(() => new Complex(1, 2).divide(new Complex(0, 0)), RangeError);
});

test('Complex divide NaN and Infinity edge cases', () => {
  const nanResult = new Complex(NaN, 1).divide(new Complex(1, 0));
  ok(Number.isNaN(nanResult.real) && Number.isNaN(nanResult.imaginary));
  const infResult = new Complex(Infinity, 0).divide(new Complex(1, 0));
  strictEqual(infResult.real, Infinity);
  ok(Number.isNaN(infResult.imaginary));
});

test('Complex scale throws TypeError for non-number scalar', () => {
  throws(() => new Complex(1, 2).scale('2'), TypeError);
  throws(() => new Complex(1, 2).scale(null), TypeError);
  throws(() => new Complex(1, 2).scale(undefined), TypeError);
  throws(() => new Complex(1, 2).scale({}), TypeError);
});

test('Complex from throws TypeError for non-number, non-Complex', () => {
  throws(() => Complex.from({}), TypeError);
  throws(() => Complex.from('5'), TypeError);
  throws(() => Complex.from(null), TypeError);
  throws(() => Complex.from(undefined), TypeError);
  strictEqual(Complex.from(5).real, 5);
  strictEqual(Complex.from(new Complex(2, 3)).imaginary, 3);
});

test('Complex subtract is an alias for sub', () => {
  const a = new Complex(5, 7);
  const b = new Complex(2, 3);
  strictEqual(a.subtract(b).real, a.sub(b).real);
  strictEqual(a.subtract(b).imaginary, a.sub(b).imaginary);
});

test('Complex scale NaN and Infinity edge cases', () => {
  const nanScaled = new Complex(1, 2).scale(NaN);
  ok(Number.isNaN(nanScaled.real) && Number.isNaN(nanScaled.imaginary));
  const infScaled = new Complex(1, 2).scale(Infinity);
  ok(!Number.isFinite(infScaled.real) || !Number.isFinite(infScaled.imaginary));
});
