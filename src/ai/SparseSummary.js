// =============================================================================
// src/ai/SparseSummary.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: pure JS sparse Top-k state summarizer for AI
// grounding. DOM-free; runs in bare Node.js. Imported exclusively by main.js
// via the ai/ leaf. Imports core/ and circuit/ only.
// =============================================================================

const PROB_THRESHOLD_DEFAULT = 1e-4;
const TOP_K_DEFAULT = 16;

/**
 * Format a little-endian basis index as a big-endian ket label.
 * Row 0 (LSB) is the rightmost character; row n-1 is the leftmost.
 * @param {number} index - little-endian basis index i (0 <= i < 2^n)
 * @param {number} numQubits
 * @returns {string} e.g. "|011>"
 */
function ketLabel(index, numQubits) {
  let bits = '';
  for (let p = numQubits - 1; p >= 0; p -= 1) {
    bits += (index >>> p) & 1;
  }
  return `|${bits}>`;
}

/**
 * Compute per-qubit marginal rho00(q) and linear entropy S_L(q) using
 * stride-2^q iteration over the split re/im buffers. Mirrors the inspector
 * purity math (CONVENTIONS.md §10) but lives in ai/ and is independent.
 *
 * For each row q:
 *   rho00 = sum over bit q = 0 of (re^2 + im^2)
 *   rho11 = 1 - rho00
 *   rho01 = sum over bit q = 0 of alpha_i * alpha_j^*, j = i ^ (1 << q)
 *   gamma = rho00^2 + rho11^2 + 2*(re[rho01]^2 + im[rho01]^2)
 *   sl = 1 - gamma
 *
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {number} numQubits
 * @returns {Array<{row: number, rho00: number, sl: number}>}
 */
function computeMarginals(re, im, numQubits) {
  const size = re.length;
  const marginals = new Array(numQubits);
  for (let q = 0; q < numQubits; q += 1) {
    const halfBlock = 1 << q;
    const fullBlock = 2 << q;
    let rho00 = 0.0;
    let rho01Re = 0.0;
    let rho01Im = 0.0;
    for (let blockStart = 0; blockStart < size; blockStart += fullBlock) {
      for (let offset = 0; offset < halfBlock; offset += 1) {
        const i0 = blockStart + offset;
        const i1 = i0 | halfBlock;
        const a0r = re[i0];
        const a0i = im[i0];
        const a1r = re[i1];
        const a1i = im[i1];
        const p0 = a0r * a0r + a0i * a0i;
        rho00 += p0;
        // alpha_i0 * alpha_i1^*
        rho01Re += a0r * a1r + a0i * a1i;
        rho01Im += a0i * a1r - a0r * a1i;
      }
    }
    const rho11 = 1.0 - rho00;
    const gamma = rho00 * rho00 + rho11 * rho11 + 2.0 * (rho01Re * rho01Re + rho01Im * rho01Im);
    marginals[q] = { row: q, rho00, sl: 1.0 - gamma };
  }
  return marginals;
}

/**
 * Build a Sparse Top-k state summary for AI prompting.
 *
 * @param {{ getRe(i): number, getIm(i): number, size(): number, numQubits(): number }} state
 * @param {number} [k=16] - max number of top terms
 * @param {number} [probThreshold=1e-4] - minimum probability to include
 * @returns {{ topK: Array<{label, index, probability, amplitude: [number,number], phase}>, marginals: Array<{row, rho00, sl}> }}
 */
function sparseSummary(state, k = TOP_K_DEFAULT, probThreshold = PROB_THRESHOLD_DEFAULT) {
  const numQubits = state.numQubits();
  const size = state.size();
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    re[i] = state.getRe(i);
    im[i] = state.getIm(i);
  }

  const entries = [];
  for (let i = 0; i < size; i += 1) {
    const r = re[i];
    const ii = im[i];
    const p = r * r + ii * ii;
    if (p > probThreshold) {
      entries.push({
        index: i,
        probability: p,
        amplitude: [r, ii],
        phase: Math.atan2(ii, r),
      });
    }
  }

  entries.sort((a, b) => b.probability - a.probability);
  const topK = entries.slice(0, k).map((e) => ({
    label: ketLabel(e.index, numQubits),
    index: e.index,
    probability: e.probability,
    amplitude: e.amplitude,
    phase: e.phase,
  }));

  const marginals = computeMarginals(re, im, numQubits);

  return { topK, marginals };
}

/**
 * Primary export matching the base filename (SparseSummary.js -> SparseSummary).
 * Static facade over sparseSummary / computeMarginals.
 */
export class SparseSummary {
  /**
   * Build a Sparse Top-k state summary for AI prompting.
   * @param {object} state - read-only state vector facade
   * @param {number} [k=16]
   * @param {number} [probThreshold=1e-4]
   * @returns {object} { topK, marginals }
   */
  static summarize(state, k = TOP_K_DEFAULT, probThreshold = PROB_THRESHOLD_DEFAULT) {
    return sparseSummary(state, k, probThreshold);
  }

  /**
   * Compute per-qubit marginal rho00 and linear entropy S_L.
   * @param {Float64Array} re
   * @param {Float64Array} im
   * @param {number} numQubits
   * @returns {Array<{row, rho00, sl}>}
   */
  static marginals(re, im, numQubits) {
    return computeMarginals(re, im, numQubits);
  }
}
