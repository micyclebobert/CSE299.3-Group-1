// =============================================================================
// src/sim/limits.js
// -----------------------------------------------------------------------------
// Qubit-ceiling thresholds governing StepTrace storage strategy and evaluate()
// advisory policy.
//
// Exports:
//   MAX_DENSE_QUBITS     = 12   (Dense Mode: snapshots at column boundaries)
//   MAX_EPHEMERAL_QUBITS = 20   (Ephemeral Replay Mode upper bound)
//   HARD_CLI_CAP         = 24   (bare Node CLI hard refusal above this)
//   evaluate(n)          -> { mode, advisory, numQubits }
//                           mode: 'dense' | 'ephemeral'
//                           advisory: string | null (15 <= n <= 20)
// =============================================================================

export const MAX_DENSE_QUBITS = 12;
export const MAX_EPHEMERAL_QUBITS = 20;
export const HARD_CLI_CAP = 24;

/**
 * Evaluate qubit-count policy. Returns the StepTrace storage mode and an
 * advisory warning string for the 15..20 qubit range. Throws above the hard
 * CLI cap.
 *
 * @param {number} n - qubit count
 * @returns {{ mode: 'dense' | 'ephemeral', advisory: string | null, numQubits: number }}
 */
export function evaluate(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(
      `limits.evaluate expects a positive integer qubit count, got: ${String(n)}`,
    );
  }
  if (n > HARD_CLI_CAP) {
    throw new Error(
      `limits.evaluate: qubit count ${n} exceeds hard cap ${HARD_CLI_CAP}`,
    );
  }

  const mode = n <= MAX_DENSE_QUBITS ? 'dense' : 'ephemeral';
  let advisory = null;
  if (n >= 15 && n <= MAX_EPHEMERAL_QUBITS) {
    advisory = `Advisory: ${n} qubits may be slow on the browser main thread`;
    console.warn(`limits: ${advisory}`);
  }

  return { mode, advisory, numQubits: n };
}
