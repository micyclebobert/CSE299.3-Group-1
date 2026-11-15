// =============================================================================
// src/core/SparseSummary.js
// -----------------------------------------------------------------------------
// Sparse state summary for AI grounding and entanglement diagnostics.
//
// Computes per-qubit single-qubit reduced density matrix marginals from the
// split Float64Array state-vector buffers (re[], im[]). For each qubit row q:
//
//   rho00 = sum_{i: bit q of i = 0} |alpha_i|^2
//   rho11 = 1 - rho00
//   rho01 = sum_{i: bit q of i = 0} alpha_i * conj(alpha_{i XOR 2^q})
//
// gamma_q = Tr(rho_q^2) = rho00^2 + rho11^2 + 2*|rho01|^2
// S_L(q)  = 1 - gamma_q       (linear entropy, entanglement measure)
//
// Used by inspector/ (per-qubit Bloch spheres, row-glow purity) and by
// ai/ (sparse Top-k state grounding). Zero heap allocation inside loops.
// DOM-free, runs in bare Node.js.
// =============================================================================

/**
 * Compute per-qubit single-qubit reduced density matrix marginals.
 *
 * @param {Float64Array} re - real amplitudes, length 2^n
 * @param {Float64Array} im - imaginary amplitudes, length 2^n
 * @param {number} n - qubit count
 * @returns {Array<{row: number, rho00: number, rho11: number,
 *   rho01: {re: number, im: number}, gamma: number, S_L: number}>}
 */
export function marginals(re, im, n) {
  const size = 1 << n;
  const result = new Array(n);

  for (let q = 0; q < n; q++) {
    const mask = 1 << q;
    let rho00 = 0.0;
    let rho01re = 0.0;
    let rho01im = 0.0;

    for (let i = 0; i < size; i++) {
      if ((i & mask) === 0) {
        const j = i | mask;
        const aiRe = re[i];
        const aiIm = im[i];
        const ajRe = re[j];
        const ajIm = im[j];

        // |alpha_i|^2 contributes to rho00 (bit q of i is 0).
        rho00 += aiRe * aiRe + aiIm * aiIm;

        // alpha_i * conj(alpha_j):
        //   (aiRe + i*aiIm)(ajRe - i*ajIm)
        // = (aiRe*ajRe + aiIm*ajIm) + i(aiIm*ajRe - aiRe*ajIm)
        rho01re += aiRe * ajRe + aiIm * ajIm;
        rho01im += aiIm * ajRe - aiRe * ajIm;
      }
    }

    const rho11 = 1.0 - rho00;
    const gamma =
      rho00 * rho00 + rho11 * rho11 + 2.0 * (rho01re * rho01re + rho01im * rho01im);
    const S_L = 1.0 - gamma;

    result[q] = {
      row: q,
      rho00,
      rho11,
      rho01: { re: rho01re, im: rho01im },
      gamma,
      S_L,
    };
  }

  return result;
}
