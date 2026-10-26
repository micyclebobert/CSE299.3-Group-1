// =============================================================================
// test/kernel.test.js
// -----------------------------------------------------------------------------
// Member 4 — Hot-path kernel unit tests for src/core/kernel.js.
//
// Covers the Milestone 1 exit checks:
//   * H on |0> -> |+>  (~[0.707106, 0.707106])
//   * CNOT(0->1) on |+0> -> Bell state (~[0.707106, 0, 0, 0.707106])
//   * Bidirectional CNOT swaps {1,3}&{5,7} for (0->1) and {2,3}&{6,7} for (1->0)
//   * Norm preservation after each gate (||psi||^2 in 1.0 +/- 1e-9)
//   * Bit-identical (Object.is) pass-through for control-missed amplitudes
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual } from 'assert';
import { StateVector } from '../src/core/StateVector.js';
import * as Kernel from '../src/core/kernel.js';
import { H, X } from '../src/core/basis.js';

const INV_SQRT2 = 1 / Math.sqrt(2);
const NORM_TOL = 1e-9;

function approx(a, b, tol = 1e-12) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

function fresh(n) {
  return new StateVector(n);
}

// Zero every amplitude then set the given index->value map.
function prepared(n, values) {
  const state = fresh(n);
  const re = state.getRawRe();
  const im = state.getRawIm();
  for (let i = 0; i < 1 << n; i++) {
    re[i] = 0.0;
    im[i] = 0.0;
  }
  for (const [i, v] of Object.entries(values)) {
    re[Number(i)] = v;
  }
  return state;
}

test('apply1QubitOp H on |0> produces |+> amplitudes', () => {
  const state = fresh(1);
  Kernel.apply1QubitOp(state.getRawRe(), state.getRawIm(), 1, 0, H, 0, 0);
  approx(state.getRe(0), INV_SQRT2);
  approx(state.getRe(1), INV_SQRT2);
  strictEqual(state.getIm(0), 0);
  strictEqual(state.getIm(1), 0);
  approx(state.normSquared(), 1.0, NORM_TOL);
});

test('apply1QubitOp H on |1> produces |-> amplitudes', () => {
  const state = prepared(1, { '1': 1.0 });
  Kernel.apply1QubitOp(state.getRawRe(), state.getRawIm(), 1, 0, H, 0, 0);
  approx(state.getRe(0), INV_SQRT2);
  approx(state.getRe(1), -INV_SQRT2);
  strictEqual(state.getIm(0), 0);
  strictEqual(state.getIm(1), 0);
});

test('CNOT(0->1) on |+0> produces the Bell state', () => {
  const state = fresh(2);
  const re = state.getRawRe();
  const im = state.getRawIm();
  Kernel.apply1QubitOp(re, im, 2, 0, H, 0, 0); // |+0>
  Kernel.applyCnot(re, im, 2, 0, 1); // CNOT(control 0, target 1)
  approx(re[0], INV_SQRT2);
  strictEqual(re[1], 0);
  strictEqual(re[2], 0);
  approx(re[3], INV_SQRT2);
  strictEqual(im[0], 0);
  strictEqual(im[3], 0);
  approx(state.normSquared(), 1.0, NORM_TOL);
});

test('CNOT(0->1) swaps exact index pairs {1,3} and {5,7} (n=3)', () => {
  const state = prepared(3, { '1': 1.0, '5': 1.0 });
  const re = state.getRawRe();
  const im = state.getRawIm();
  const before = [];
  for (let i = 0; i < 8; i++) before[i] = re[i];

  Kernel.applyCnot(re, im, 3, 0, 1);

  strictEqual(re[1], 0);
  strictEqual(re[3], 1);
  strictEqual(re[5], 0);
  strictEqual(re[7], 1);
  // Control-missed / non-swapped indices stay bit-identical.
  for (let i = 0; i < 8; i++) {
    if (i !== 1 && i !== 3 && i !== 5 && i !== 7) {
      ok(Object.is(re[i], before[i]), `index ${i} should be bit-identical`);
    }
  }
});

test('CNOT(1->0) swaps exact index pairs {2,3} and {6,7} (n=3)', () => {
  const state = prepared(3, { '2': 1.0, '6': 1.0 });
  const re = state.getRawRe();
  const im = state.getRawIm();
  const before = [];
  for (let i = 0; i < 8; i++) before[i] = re[i];

  Kernel.applyCnot(re, im, 3, 1, 0);

  strictEqual(re[2], 0);
  strictEqual(re[3], 1);
  strictEqual(re[6], 0);
  strictEqual(re[7], 1);
  for (let i = 0; i < 8; i++) {
    if (i !== 2 && i !== 3 && i !== 6 && i !== 7) {
      ok(Object.is(re[i], before[i]), `index ${i} should be bit-identical`);
    }
  }
});

test('controlled gate leaves control-missed amplitudes bit-identical', () => {
  // re[0]=1 (control qubit0 = 0 -> missed), re[1]=1 (control qubit0 = 1 -> hit).
  const state = prepared(2, { '0': 1.0, '1': 1.0 });
  const re = state.getRawRe();
  const im = state.getRawIm();
  const before0 = re[0];
  const before0im = im[0];

  // H on target 1, control = qubit 0.
  // Pair (0,2): i0=0 has bit0=0 -> control missed -> untouched.
  // Pair (1,3): i0=1 has bit0=1 -> control hit -> H applied.
  Kernel.apply1QubitOp(re, im, 2, 1, H, 1 << 0, 0);

  ok(Object.is(re[0], before0), 'index 0 (control missed) bit-identical');
  ok(Object.is(im[0], before0im), 'index 0 imag bit-identical');
  // Control-hit pair (1,3) updated by H.
  approx(re[1], INV_SQRT2);
  approx(re[3], INV_SQRT2);
});

test('norm is preserved after a sequence of gates (n=4)', () => {
  const state = fresh(4);
  const re = state.getRawRe();
  const im = state.getRawIm();
  Kernel.apply1QubitOp(re, im, 4, 0, H, 0, 0);
  Kernel.apply1QubitOp(re, im, 4, 2, H, 0, 0);
  Kernel.applyCnot(re, im, 4, 0, 2);
  Kernel.apply1QubitOp(re, im, 4, 1, X, 0, 0);
  approx(state.normSquared(), 1.0, NORM_TOL);
});

test('applySwap exchanges amplitudes directly with no multiplication', () => {
  const state = prepared(2, { '1': 3.0, '2': 5.0 });
  const re = state.getRawRe();
  const im = state.getRawIm();
  im[1] = 4.0;
  im[2] = 6.0;

  Kernel.applySwap(re, im, 2, 0, 1); // swap qubit rows 0 and 1

  // index 1 (01_2) <-> index 2 (10_2)
  strictEqual(re[1], 5.0);
  strictEqual(im[1], 6.0);
  strictEqual(re[2], 3.0);
  strictEqual(im[2], 4.0);
  // Other indices untouched and bit-identical (zero).
  strictEqual(Object.is(re[0], 0), true);
  strictEqual(Object.is(im[0], 0), true);
  strictEqual(Object.is(re[3], 0), true);
  strictEqual(Object.is(im[3], 0), true);
});
