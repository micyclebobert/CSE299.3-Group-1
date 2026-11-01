// =============================================================================
// src/measurement/measurement.js
// -----------------------------------------------------------------------------
// Member 4 — Non-unitary measurement module.
//
// Measurement is a module in measurement/, NEVER a gate in gates/. It performs
// single-shot Born-rule collapse and repeated-shot histogram sampling.
//
// Layering: imports core/ and circuit/ only. DOM-free.
// =============================================================================

import { StateVector } from '../core/StateVector.js';

/**
 * Draw a single basis index i according to Born probabilities
 * P(i) = re[i]^2 + im[i]^2, then collapse the state vector in place:
 *   re[i] = 1.0, im[i] = 0.0, all other entries 0.0.
 *
 * @param {StateVector} state
 * @returns {number} the collapsed basis index
 */
export function collapse(state) {
  if (!(state instanceof StateVector)) {
    throw new TypeError('collapse expects a StateVector instance');
  }
  const probs = state.probabilities();
  const size = probs.length;

  // Inverse transform sampling.
  const r = Math.random();
  let acc = 0.0;
  let chosen = size - 1;
  for (let i = 0; i < size; i++) {
    acc += probs[i];
    if (r < acc) {
      chosen = i;
      break;
    }
  }

  const re = state.getRawRe();
  const im = state.getRawIm();
  for (let i = 0; i < size; i++) {
    if (i === chosen) {
      re[i] = 1.0;
      im[i] = 0.0;
    } else {
      re[i] = 0.0;
      im[i] = 0.0;
    }
  }
  return chosen;
}

/**
 * Repeated-shot histogram sampling. Clones the state once, then draws S
 * independent samples from the pre-collapse distribution.
 *
 * @param {StateVector} state
 * @param {number} shots
 * @returns {Map<number, number>} basis index -> count
 */
export function sampleHistogram(state, shots) {
  if (!(state instanceof StateVector)) {
    throw new TypeError('sampleHistogram expects a StateVector instance');
  }
  if (!Number.isInteger(shots) || shots < 1) {
    throw new TypeError('shots must be a positive integer');
  }
  const probs = state.probabilities();
  const size = probs.length;
  const hist = new Map();

  // Build cumulative distribution for sampling.
  const cdf = new Float64Array(size);
  let acc = 0.0;
  for (let i = 0; i < size; i++) {
    acc += probs[i];
    cdf[i] = acc;
  }

  for (let s = 0; s < shots; s++) {
    const r = Math.random();
    let chosen = size - 1;
    for (let i = 0; i < size; i++) {
      if (r < cdf[i]) {
        chosen = i;
        break;
      }
    }
    hist.set(chosen, (hist.get(chosen) || 0) + 1);
  }
  return hist;
}
