// test/cross-validation/differential-harness.test.js
// -----------------------------------------------------------------------------
// M1.8 — Differential CLI pipe harness tests.
//
// Verifies the runCli() helper: valid canonical v1 JSON on stdin yields valid
// deterministic JSON on stdout with an empty stderr; malformed input is
// rejected with a non-zero exit. This harness is the gate M2's Qiskit
// comparison builds on.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok, rejects } from 'assert';
import { runCli } from './harness_helpers.js';

const BELL_JSON = JSON.stringify({
  format: 'simqc-circuit',
  version: 1,
  bitOrder: 'little-endian',
  numQubits: 2,
  columns: [
    [{ gate: 'H', target: 0 }],
    [{ gate: 'CNOT', target: 1, controls: [{ row: 0, on: true }] }],
  ],
});

const INVALID_JSON = '{ not valid json ';

test('runCli: valid bell circuit yields valid JSON stdout, empty stderr', async () => {
  const out = await runCli(BELL_JSON);

  strictEqual(out.qubits, 2);
  strictEqual(out.probabilities.length, 1 << 2);
  strictEqual(out.amplitudes.length, 1 << 2);

  // Bell state (|00> + |11>)/sqrt(2): amplitude mass on indices 0 and 3 only.
  const p0 = out.probabilities[0];
  const p3 = out.probabilities[3];
  ok(p0 > 0.49 && p0 < 0.51, `probability[0] ≈ 0.5, got ${p0}`);
  ok(p3 > 0.49 && p3 < 0.51, `probability[3] ≈ 0.5, got ${p3}`);
  for (let i = 0; i < out.probabilities.length; i++) {
    if (i === 0 || i === 3) continue;
    strictEqual(out.probabilities[i], 0, `probability[${i}] must be 0`);
  }

  // Probabilities sum to 1.
  let sum = 0;
  for (let i = 0; i < out.probabilities.length; i++) sum += out.probabilities[i];
  ok(Math.abs(sum - 1) < 1e-9, `probabilities sum to 1, got ${sum}`);
});

test('runCli: output amplitudes match probabilities (re^2 + im^2)', async () => {
  const out = await runCli(BELL_JSON);
  for (let i = 0; i < out.probabilities.length; i++) {
    const { re, im } = out.amplitudes[i];
    const expected = re * re + im * im;
    ok(
      Math.abs(expected - out.probabilities[i]) < 1e-12,
      `amplitude[${i}] prob mismatch: re^2+im^2=${expected} vs probability=${out.probabilities[i]}`,
    );
  }
});

test('runCli: invalid JSON input is rejected (non-zero exit, stderr)', async () => {
  await rejects(
    () => runCli(INVALID_JSON),
    (err) => err instanceof Error && err.message.includes('exited with code'),
    'invalid JSON should cause a non-zero cli exit',
  );
});

test('runCli: empty stdin is rejected (non-zero exit)', async () => {
  await rejects(
    () => runCli(''),
    (err) => err instanceof Error,
    'empty stdin should cause a non-zero cli exit',
  );
});
