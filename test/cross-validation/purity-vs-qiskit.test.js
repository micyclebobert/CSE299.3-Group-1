// test/cross-validation/purity-vs-qiskit.test.js
// -----------------------------------------------------------------------------
// M1.6 — Purity (gamma / linear entropy) vs Qiskit partial trace.
//
// Compares src/inspector/Purity.js (single-qubit gamma and linear entropy)
// against Qiskit's independent partial_trace + Tr(rho^2):
//
//   - Always-run analytical tests (no Qiskit needed):
//       * |0> and |+> single-qubit states: gamma = 1.0, S_L = 0 (pure).
//       * |00> product state (n=2): gamma = 1.0 on both rows, S_L = 0.
//       * SimQC-evaluated Bell state: gamma = 0.5 on both rows, S_L = 0.5.
//       * SimQC-evaluated 3-qubit GHZ state: gamma = 0.5 on all rows.
//   - Qiskit differential tests (skipped gracefully when python3/Qiskit
//     unavailable): product state |00>, Bell pair, and 3-qubit GHZ. Expected
//     purities come from Qiskit partial_trace per qubit, compared against
//     Purity.gamma(q) / Purity.linearEntropy(q) within tolerance 1e-9.
//
// Qiskit flow: qiskit-differential.py emits amplitudes; partial_trace_ref.py
// reconstructs a Qiskit Statevector from those amplitudes and computes
// per-qubit Tr(rho^2) via partial_trace, emitting { purities: [...] }.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { StateVector } from '../../src/core/StateVector.js';
import { Purity } from '../../src/inspector/Purity.js';
import { fromJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

// Seed the GateRegistry so evaluate() can resolve gate IDs.
import '../../src/main.js';

const QISKIT_SCRIPT = new URL('./qiskit-differential.py', import.meta.url)
  .pathname;
const PARTIAL_TRACE_SCRIPT = new URL('./partial_trace_ref.py', import.meta.url)
  .pathname;
const TOL = 1e-9;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function gate(gateName, target, extra = {}) {
  return { gate: gateName, target, ...extra };
}

function makeCircuit(numQubits, columns) {
  return {
    format: 'simqc-circuit',
    version: 1,
    bitOrder: 'little-endian',
    numQubits,
    columns,
  };
}

function runQiskit(circuitJson) {
  const result = spawnSync('python3', [QISKIT_SCRIPT], {
    input: circuitJson,
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `qiskit-differential.py exited with code ${result.status}: ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout);
}

function runPartialTrace(amplitudes, numQubits) {
  const result = spawnSync('python3', [PARTIAL_TRACE_SCRIPT], {
    input: JSON.stringify({ amplitudes, numQubits }),
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `partial_trace_ref.py exited with code ${result.status}: ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout);
}

function simqcEvaluate(circuitJson) {
  const circuit = fromJson(circuitJson);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

/* Build a Purity instance reading from a StateVector as the current state.
 * Purity only accesses stepTrace.currentState.{numQubits,size,getRe,getIm},
 * all of which StateVector provides. */
function purityOf(state) {
  return new Purity({ currentState: state });
}

function assertAmplitudes(state, expected, label) {
  strictEqual(state.size(), expected.length, `${label}: size`);
  for (let i = 0; i < expected.length; i += 1) {
    ok(
      Math.abs(state.getRe(i) - expected[i].re) < TOL,
      `${label}: re[${i}] mismatch`,
    );
    ok(
      Math.abs(state.getIm(i) - expected[i].im) < TOL,
      `${label}: im[${i}] mismatch`,
    );
  }
}

function assertPuritiesClose(actual, expected, label) {
  strictEqual(actual.length, expected.length, `${label}: purity count`);
  for (let q = 0; q < actual.length; q += 1) {
    ok(
      Math.abs(actual[q] - expected[q]) < TOL,
      `${label}: gamma[${q}] mismatch actual=${actual[q]} expected=${expected[q]}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Availability checks                                               */
/* ------------------------------------------------------------------ */

function isPython3Available() {
  try {
    const result = spawnSync('python3', ['--version'], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
}

function isQiskitAvailable() {
  try {
    const result = spawnSync(
      'python3',
      ['-c', 'import qiskit; import numpy'],
      { stdio: 'ignore' },
    );
    return result.status === 0;
  } catch {
    return false;
  }
}

const python3Available = isPython3Available();
const qiskitAvailable = python3Available && isQiskitAvailable();

/* ------------------------------------------------------------------ */
/*  1. Always-run: analytical purity tests                            */
/* ------------------------------------------------------------------ */

test('purity: |0> single qubit -> gamma=1, S_L=0', () => {
  const state = new StateVector(1);
  const p = purityOf(state);
  strictEqual(p.gamma(0), 1.0, '|0> gamma(0) = 1');
  strictEqual(p.linearEntropy(0), 0.0, '|0> S_L(0) = 0');
});

test('purity: |+> single qubit -> gamma=1, S_L=0 (pure state)', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = 1 / Math.sqrt(2);
  state.getRawRe()[1] = 1 / Math.sqrt(2);
  const p = purityOf(state);
  ok(Math.abs(p.gamma(0) - 1.0) < TOL, '|+> gamma(0) ≈ 1');
  ok(Math.abs(p.linearEntropy(0)) < TOL, '|+> S_L(0) ≈ 0');
});

test('purity: |00> product state -> gamma=1 on both rows, S_L=0', () => {
  const state = new StateVector(2);
  const p = purityOf(state);
  for (const q of [0, 1]) {
    strictEqual(p.gamma(q), 1.0, `|00> gamma(${q}) = 1`);
    strictEqual(p.linearEntropy(q), 0.0, `|00> S_L(${q}) = 0`);
  }
});

test('purity: Bell state via SimQC -> gamma=0.5 on both rows, S_L=0.5', () => {
  const sv = simqcEvaluate(
    JSON.stringify(
      makeCircuit(2, [
        [gate('H', 0)],
        [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
      ]),
    ),
  );
  assertAmplitudes(
    sv,
    [
      { re: 1 / Math.sqrt(2), im: 0 },
      { re: 0, im: 0 },
      { re: 0, im: 0 },
      { re: 1 / Math.sqrt(2), im: 0 },
    ],
    'Bell state amplitudes',
  );
  const p = purityOf(sv);
  for (const q of [0, 1]) {
    ok(
      Math.abs(p.gamma(q) - 0.5) < TOL,
      `Bell gamma(${q}) ≈ 0.5, got ${p.gamma(q)}`,
    );
    ok(
      Math.abs(p.linearEntropy(q) - 0.5) < TOL,
      `Bell S_L(${q}) ≈ 0.5, got ${p.linearEntropy(q)}`,
    );
  }
});

test('purity: 3-qubit GHZ via SimQC -> gamma=0.5 on all rows', () => {
  const sv = simqcEvaluate(
    JSON.stringify(
      makeCircuit(3, [
        [gate('H', 0)],
        [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
        [gate('CNOT', 2, { controls: [{ row: 0, on: true }] })],
      ]),
    ),
  );
  assertAmplitudes(
    sv,
    [
      { re: 1 / Math.sqrt(2), im: 0 },
      { re: 0, im: 0 },
      { re: 0, im: 0 },
      { re: 0, im: 0 },
      { re: 0, im: 0 },
      { re: 0, im: 0 },
      { re: 0, im: 0 },
      { re: 1 / Math.sqrt(2), im: 0 },
    ],
    'GHZ state amplitudes',
  );
  const p = purityOf(sv);
  for (const q of [0, 1, 2]) {
    ok(
      Math.abs(p.gamma(q) - 0.5) < TOL,
      `GHZ gamma(${q}) ≈ 0.5, got ${p.gamma(q)}`,
    );
    ok(
      Math.abs(p.linearEntropy(q) - 0.5) < TOL,
      `GHZ S_L(${q}) ≈ 0.5, got ${p.linearEntropy(q)}`,
    );
  }
});

/* ------------------------------------------------------------------ */
/*  2. Qiskit reference (skipped when python3/Qiskit unavailable)     */
/* ------------------------------------------------------------------ */

if (!python3Available || !qiskitAvailable) {
  test.todo('Purity vs Qiskit (python3/Qiskit unavailable)');
} else {
  /* Product state |00> -> Qiskit partial trace purity = 1.0 on both rows */

  test('purity: product state |00> matches Qiskit partial trace', () => {
    const circuit = makeCircuit(2, []);
    const circuitJson = JSON.stringify(circuit);
    const qiskitOut = runQiskit(circuitJson);
    const ref = runPartialTrace(qiskitOut.amplitudes, 2);
    strictEqual(ref.qubits, 2, 'qubit count');
    assertPuritiesClose(ref.purities, [1.0, 1.0], '|00> product state');

    const sv = simqcEvaluate(circuitJson);
    const p = purityOf(sv);
    assertPuritiesClose(
      [p.gamma(0), p.gamma(1)],
      ref.purities,
      '|00> SimQC vs Qiskit gamma',
    );
    assertPuritiesClose(
      [p.linearEntropy(0), p.linearEntropy(1)],
      ref.purities.map((g) => 1.0 - g),
      '|00> SimQC vs Qiskit S_L',
    );
  });

  /* Bell pair -> Qiskit partial trace purity = 0.5 on both rows */

  test('purity: Bell pair matches Qiskit partial trace', () => {
    const circuit = makeCircuit(2, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const qiskitOut = runQiskit(circuitJson);
    const ref = runPartialTrace(qiskitOut.amplitudes, 2);
    assertPuritiesClose(ref.purities, [0.5, 0.5], 'Bell pair Qiskit purity');

    const sv = simqcEvaluate(circuitJson);
    const p = purityOf(sv);
    assertPuritiesClose(
      [p.gamma(0), p.gamma(1)],
      ref.purities,
      'Bell SimQC vs Qiskit gamma',
    );
    assertPuritiesClose(
      [p.linearEntropy(0), p.linearEntropy(1)],
      ref.purities.map((g) => 1.0 - g),
      'Bell SimQC vs Qiskit S_L',
    );
  });

  /* 3-qubit GHZ -> Qiskit partial trace purity = 0.5 on all rows */

  test('purity: GHZ state matches Qiskit partial trace', () => {
    const circuit = makeCircuit(3, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
      [gate('CNOT', 2, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const qiskitOut = runQiskit(circuitJson);
    const ref = runPartialTrace(qiskitOut.amplitudes, 3);
    assertPuritiesClose(ref.purities, [0.5, 0.5, 0.5], 'GHZ Qiskit purity');

    const sv = simqcEvaluate(circuitJson);
    const p = purityOf(sv);
    assertPuritiesClose(
      [p.gamma(0), p.gamma(1), p.gamma(2)],
      ref.purities,
      'GHZ SimQC vs Qiskit gamma',
    );
    assertPuritiesClose(
      [p.linearEntropy(0), p.linearEntropy(1), p.linearEntropy(2)],
      ref.purities.map((g) => 1.0 - g),
      'GHZ SimQC vs Qiskit S_L',
    );
  });
}
