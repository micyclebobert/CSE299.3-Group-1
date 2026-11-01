// =============================================================================
// src/sim/analytic.js
// -----------------------------------------------------------------------------
// Curated closed-form state expectations used by StepTrace.verify() to assert
// that simulated trace states match textbook quantum algorithms within
// 1e-12 (n <= 8) / 1e-9 (n > 8).
//
// Every function returns { re: Float64Array, im: Float64Array } indexed by
// little-endian basis-state index i (0 <= i < 2^n).
// =============================================================================

const INV_SQRT2 = 1 / Math.sqrt(2);

/**
 * 2-qubit Bell state: (|00> + |11>) / sqrt(2)
 * Little-endian: amplitude at index 0 (|00>) and index 3 (|11>).
 * @returns {{ re: Float64Array, im: Float64Array }}
 */
export function bellState() {
  const re = new Float64Array(4);
  const im = new Float64Array(4);
  re[0] = INV_SQRT2;
  re[3] = INV_SQRT2;
  return { re, im };
}

/**
 * n-qubit GHZ state: (|00...0> + |11...1>) / sqrt(2)
 * Little-endian: amplitude at index 0 and index (2^n - 1).
 * @param {number} n - qubit count
 * @returns {{ re: Float64Array, im: Float64Array }}
 */
export function ghzState(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(`analytic.ghzState expects a positive integer n, got: ${String(n)}`);
  }
  const size = 1 << n;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re[0] = INV_SQRT2;
  re[size - 1] = INV_SQRT2;
  return { re, im };
}

/**
 * QFT on basis state |k>:
 *   1/sqrt(2^n) * sum_{j=0}^{2^n-1} exp(2*pi*i*k*j/2^n) |j>
 * @param {number} n - qubit count
 * @param {number} k - input basis-state index (0 <= k < 2^n)
 * @returns {{ re: Float64Array, im: Float64Array }}
 */
export function qftState(n, k) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(`analytic.qftState expects a positive integer n, got: ${String(n)}`);
  }
  if (!Number.isInteger(k) || k < 0 || k >= (1 << n)) {
    throw new RangeError(
      `analytic.qftState expects k in [0, ${1 << n}), got: ${String(k)}`,
    );
  }
  const size = 1 << n;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const norm = 1 / Math.sqrt(size);
  const twoPi = 2 * Math.PI;
  const denom = size;
  for (let j = 0; j < size; j++) {
    const angle = (twoPi * k * j) / denom;
    re[j] = norm * Math.cos(angle);
    im[j] = norm * Math.sin(angle);
  }
  return { re, im };
}

/**
 * Bell-pair resource state used by quantum teleportation (same as bellState).
 * @returns {{ re: Float64Array, im: Float64Array }}
 */
export function teleportationResource() {
  return bellState();
}

/**
 * Build an analyticExpectation predicate function for StepTrace.verify().
 * The returned function maps (step, numQubits) to an expected state or null
 * when no expectation exists for that step.
 *
 * @param {((step: number, numQubits: number) => { re: Float64Array, im: Float64Array } | null) | null} expectation
 *   - null: no expectation (verify passes trivially)
 *   - Function: called per step; null skips that step
 * @returns {(step: number, numQubits: number) => { re: Float64Array, im: Float64Array } | null}
 */
export function expectation(expectationFn) {
  if (expectationFn !== null && typeof expectationFn !== 'function') {
    throw new TypeError(
      `analytic.expectation expects a function or null, got: ${typeof expectationFn}`,
    );
  }
  return expectationFn;
}
