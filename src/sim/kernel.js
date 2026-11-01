// =============================================================================
// src/sim/kernel.js
// -----------------------------------------------------------------------------
// Member 1 — Hot-path scalar kernels for state-vector simulation.
//
// Every function mutating state-vector buffers obeys CONVENTIONS.md §7:
//   1. Bare module functions (never static class methods).
//   2. Zero heap allocation inside loops.
//   3. Canonical unrolled 2x2 scalar update over flat 8-number tuples.
//   4. Stride-2^t block iteration (single visit per pair).
//   5. Controlled / anti-controlled bit-identical pass-through.
//   6. Control/target disjointness assertions.
//
// Gate Isolation: sim/ imports core/ and circuit/ only. This module imports
// nothing external (pure functions operating on Float64Array buffers).
// =============================================================================

export function apply1QubitOp(re, im, n, target, gateFlat, controlMask, antiControlMask) {
  const halfBlock = 1 << target;
  const fullBlock = 2 << target;
  const size = 1 << n;
  const g00re = gateFlat[0];
  const g00im = gateFlat[1];
  const g01re = gateFlat[2];
  const g01im = gateFlat[3];
  const g10re = gateFlat[4];
  const g10im = gateFlat[5];
  const g11re = gateFlat[6];
  const g11im = gateFlat[7];
  for (let blockStart = 0; blockStart < size; blockStart += fullBlock) {
    for (let offset = 0; offset < halfBlock; offset++) {
      const i0 = blockStart + offset;
      if ((i0 & controlMask) === controlMask && (i0 & antiControlMask) === 0) {
        const i1 = i0 | halfBlock;
        const a0r = re[i0];
        const a0i = im[i0];
        const a1r = re[i1];
        const a1i = im[i1];
        re[i0] = g00re * a0r - g00im * a0i + g01re * a1r - g01im * a1i;
        im[i0] = g00re * a0i + g00im * a0r + g01re * a1i + g01im * a1r;
        re[i1] = g10re * a0r - g10im * a0i + g11re * a1r - g11im * a1i;
        im[i1] = g10re * a0i + g10im * a0r + g11re * a1i + g11im * a1r;
      }
    }
  }
}

export function applyCnot(re, im, n, control, target) {
  const size = 1 << n;
  const maskC = 1 << control;
  const maskT = 1 << target;
  if ((maskC & maskT) !== 0) {
    throw new Error("control and target qubit rows must be disjoint");
  }
  for (let i = 0; i < size; i++) {
    if ((i & maskC) === maskC) {
      const j = i ^ maskT;
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
  }
}

export function applyCz(re, im, n, control, target) {
  const size = 1 << n;
  const maskC = 1 << control;
  const maskT = 1 << target;
  if ((maskC & maskT) !== 0) {
    throw new Error("control and target qubit rows must be disjoint");
  }
  for (let i = 0; i < size; i++) {
    if ((i & maskC) === maskC && (i & maskT) === maskT) {
      re[i] = -re[i];
      im[i] = -im[i];
    }
  }
}

export function applyToffoli(re, im, n, c0, c1, target) {
  const size = 1 << n;
  const maskC0 = 1 << c0;
  const maskC1 = 1 << c1;
  const maskT = 1 << target;
  if (((maskC0 | maskC1) & maskT) !== 0) {
    throw new Error("control and target qubit rows must be disjoint");
  }
  for (let i = 0; i < size; i++) {
    if ((i & maskC0) === maskC0 && (i & maskC1) === maskC1) {
      const j = i ^ maskT;
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
  }
}

export function applySwap(re, im, n, q0, q1) {
  const size = 1 << n;
  const mask0 = 1 << q0;
  const mask1 = 1 << q1;
  for (let i = 0; i < size; i++) {
    const b0 = (i & mask0) >>> q0;
    const b1 = (i & mask1) >>> q1;
    if (b0 !== b1) {
      const j = i ^ mask0 ^ mask1;
      if (i < j) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
  }
}
