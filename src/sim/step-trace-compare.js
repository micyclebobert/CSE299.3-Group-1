// =============================================================================
// src/sim/step-trace-compare.js
// -----------------------------------------------------------------------------
// Tolerance and state-vector comparison helpers for StepTrace verification.
// Pure functions; no external imports.
// =============================================================================

const NORM_TOL_DENSE = 1e-12;
const NORM_TOL_SPARSE = 1e-9;

export function toleranceFor(n) {
  return n <= 8 ? NORM_TOL_DENSE : NORM_TOL_SPARSE;
}

export function compareStates(reA, imA, reB, imB, tol) {
  const size = reA.length;
  for (let i = 0; i < size; i++) {
    const dr = Math.abs(reA[i] - reB[i]);
    const di = Math.abs(imA[i] - imB[i]);
    if (dr > tol || di > tol) {
      return { ok: false, index: i, msg: `index ${i}: expected (${reB[i]}, ${imB[i]}) got (${reA[i]}, ${imA[i]}) tol ${tol}` };
    }
  }
  return { ok: true };
}
