// =============================================================================
// test/sim/analytic.test.js
// -----------------------------------------------------------------------------
// Mirrors src/sim/analytic.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import {
  bellState,
  ghzState,
  qftState,
  teleportationResource,
  expectation,
} from '../../src/sim/analytic.js';

const INV_SQRT2 = 1 / Math.sqrt(2);

// ---------------------------------------------------------------------------
// bellState
// ---------------------------------------------------------------------------

test('bellState has amplitude 1/sqrt(2) at indices 0 and 3', () => {
  const { re, im } = bellState();
  strictEqual(re.length, 4);
  strictEqual(im.length, 4);
  ok(Math.abs(re[0] - INV_SQRT2) <= 1e-15);
  ok(Math.abs(re[3] - INV_SQRT2) <= 1e-15);
  strictEqual(re[1], 0);
  strictEqual(re[2], 0);
  for (let i = 0; i < 4; i++) {
    strictEqual(im[i], 0);
  }
});

test('bellState is normalized', () => {
  const { re, im } = bellState();
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    sum += re[i] * re[i] + im[i] * im[i];
  }
  ok(Math.abs(sum - 1.0) <= 1e-15);
});

// ---------------------------------------------------------------------------
// ghzState
// ---------------------------------------------------------------------------

test('ghzState(2) equals bellState', () => {
  const a = bellState();
  const b = ghzState(2);
  for (let i = 0; i < 4; i++) {
    ok(Math.abs(a.re[i] - b.re[i]) <= 1e-15);
    ok(Math.abs(a.im[i] - b.im[i]) <= 1e-15);
  }
});

test('ghzState(3) has amplitude 1/sqrt(2) at indices 0 and 7', () => {
  const { re, im } = ghzState(3);
  strictEqual(re.length, 8);
  ok(Math.abs(re[0] - INV_SQRT2) <= 1e-15);
  ok(Math.abs(re[7] - INV_SQRT2) <= 1e-15);
  for (let i = 1; i < 7; i++) {
    strictEqual(re[i], 0);
  }
  for (let i = 0; i < 8; i++) {
    strictEqual(im[i], 0);
  }
});

test('ghzState(4) has amplitude 1/sqrt(2) at indices 0 and 15', () => {
  const { re } = ghzState(4);
  strictEqual(re.length, 16);
  ok(Math.abs(re[0] - INV_SQRT2) <= 1e-15);
  ok(Math.abs(re[15] - INV_SQRT2) <= 1e-15);
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    sum += re[i] * re[i];
  }
  ok(Math.abs(sum - 1.0) <= 1e-15);
});

// ---------------------------------------------------------------------------
// qftState
// ---------------------------------------------------------------------------

test('qftState(1, 0) equals |+> state', () => {
  const { re, im } = qftState(1, 0);
  strictEqual(re.length, 2);
  ok(Math.abs(re[0] - INV_SQRT2) <= 1e-15);
  ok(Math.abs(re[1] - INV_SQRT2) <= 1e-15);
  strictEqual(im[0], 0);
  strictEqual(im[1], 0);
});

test('qftState(2, 0) is uniform superposition over 4 states', () => {
  const { re, im } = qftState(2, 0);
  strictEqual(re.length, 4);
  const norm = 1 / Math.sqrt(4);
  for (let j = 0; j < 4; j++) {
    ok(Math.abs(re[j] - norm) <= 1e-15);
    strictEqual(im[j], 0);
  }
});

test('qftState phase formula matches exp(2*pi*i*k*j/2^n)', () => {
  const n = 3;
  const k = 2;
  const size = 1 << n;
  const { re, im } = qftState(n, k);
  const norm = 1 / Math.sqrt(size);
  const twoPi = 2 * Math.PI;
  for (let j = 0; j < size; j++) {
    const angle = (twoPi * k * j) / size;
    ok(Math.abs(re[j] - norm * Math.cos(angle)) <= 1e-15, `re[${j}]`);
    ok(Math.abs(im[j] - norm * Math.sin(angle)) <= 1e-15, `im[${j}]`);
  }
});

test('qftState is normalized', () => {
  const { re, im } = qftState(5, 7);
  let sum = 0;
  for (let i = 0; i < 32; i++) {
    sum += re[i] * re[i] + im[i] * im[i];
  }
  ok(Math.abs(sum - 1.0) <= 1e-12);
});

// ---------------------------------------------------------------------------
// teleportationResource
// ---------------------------------------------------------------------------

test('teleportationResource equals bellState', () => {
  const a = teleportationResource();
  const b = bellState();
  for (let i = 0; i < 4; i++) {
    ok(Math.abs(a.re[i] - b.re[i]) <= 1e-15);
    ok(Math.abs(a.im[i] - b.im[i]) <= 1e-15);
  }
});

// ---------------------------------------------------------------------------
// expectation helper
// ---------------------------------------------------------------------------

test('expectation(null) returns null', () => {
  strictEqual(expectation(null), null);
});

test('expectation(function) returns the function', () => {
  const fn = (step, n) => null;
  strictEqual(expectation(fn), fn);
});

test('expectation throws on non-function non-null', () => {
  throws(() => expectation(42), TypeError);
});

test('ghzState throws on invalid n', () => {
  throws(() => ghzState(0), TypeError);
  throws(() => ghzState(-1), TypeError);
  throws(() => ghzState(2.5), TypeError);
});

test('qftState throws on invalid n', () => {
  throws(() => qftState(0), TypeError);
  throws(() => qftState(-1), TypeError);
  throws(() => qftState(2.5), TypeError);
});

test('qftState throws on invalid k', () => {
  throws(() => qftState(2, -1), RangeError);
  throws(() => qftState(2, 4), RangeError);
  throws(() => qftState(2, 2.5), RangeError);
});
