// test/cross-validation/bloch-vs-qiskit.test.js
// -----------------------------------------------------------------------------
// M1.7 — Bloch vector vs Qiskit Bloch-sphere coordinates.
//
// Compares src/inspector/Bloch.js (single-qubit Bloch vector r = (x, y, z))
// against Qiskit's independent partial_trace + density-matrix Bloch formula:
//
//   r = (2*Re(rho01), -2*Im(rho01), rho00 - rho11)
//
//   - Always-run analytical tests (no Qiskit needed):
//       * |0> -> (0, 0, +1)
//       * |1> -> (0, 0, -1)
//       * |+> -> (+1, 0, 0)
//       * |-> -> (-1, 0, 0)
//       * |i> -> (0, +1, 0)
//       * |-i> -> (0, -1, 0)
//   - Qiskit differential tests (skipped gracefully when python3/Qiskit
//     unavailable): Bell state, 3-qubit GHZ, and a random entangled circuit.
//     Expected Bloch coordinates come from Qiskit partial_trace per qubit,
//     compared against Bloch.vector(q) within tolerance 1e-9.
//
// Qiskit flow: qiskit-differential.py emits amplitudes; bloch_ref.py
// reconstructs a Qiskit Statevector from those amplitudes and computes
// per-qubit Bloch coordinates via partial_trace, emitting { bloch: [...] }.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { StateVector } from '../../src/core/StateVector.js';
import { Bloch } from '../../src/inspector/Bloch.js';
import { fromJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

// Seed the GateRegistry so evaluate() can resolve gate IDs.
import '../../src/main.js';

const BLOCH_SCRIPT = new URL('./bloch_ref.py', import.meta.url).pathname;
const TOL = 1e-9;
const SQRT2_INV = 1 / Math.sqrt(2);

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

function runBloch(amplitudes, numQubits) {
  const result = spawnSync('python3', [BLOCH_SCRIPT], {
    input: JSON.stringify({ amplitudes, numQubits }),
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `bloch_ref.py exited with code ${result.status}: ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout).bloch;
}

function simqcEvaluate(circuitJson) {
  const circuit = fromJson(circuitJson);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

/* Build a Bloch instance reading from a StateVector as the current state.
 * Bloch only accesses stepTrace.currentState.{numQubits,size,getRe,getIm},
 * all of which StateVector provides. */
function blochOf(state) {
  return new Bloch({ currentState: state });
}

function assertBlochClose(actual, expected, label) {
  strictEqual(actual.length, expected.length, `${label}: bloch count`);
  for (let q = 0; q < actual.length; q += 1) {
    const a = actual[q];
    const e = expected[q];
    ok(
      Math.abs(a.x - e.x) < TOL,
      `${label}: row ${q} x mismatch actual=${a.x} expected=${e.x}`,
    );
    ok(
      Math.abs(a.y - e.y) < TOL,
      `${label}: row ${q} y mismatch actual=${a.y} expected=${e.y}`,
    );
    ok(
      Math.abs(a.z - e.z) < TOL,
      `${label}: row ${q} z mismatch actual=${a.z} expected=${e.z}`,
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
/*  1. Always-run: analytical Bloch tests                             */
/* ------------------------------------------------------------------ */

test('bloch: |0> single qubit -> (0, 0, +1)', () => {
  const state = new StateVector(1);
  const b = blochOf(state);
  ok(Math.abs(b.vector(0).x) < TOL, '|0> x ≈ 0');
  ok(Math.abs(b.vector(0).y) < TOL, '|0> y ≈ 0');
  ok(Math.abs(b.vector(0).z - 1.0) < TOL, '|0> z ≈ +1');
});

test('bloch: |1> single qubit -> (0, 0, -1)', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = 0.0;
  state.getRawRe()[1] = 1.0;
  const b = blochOf(state);
  ok(Math.abs(b.vector(0).x) < TOL, '|1> x ≈ 0');
  ok(Math.abs(b.vector(0).y) < TOL, '|1> y ≈ 0');
  ok(Math.abs(b.vector(0).z - (-1.0)) < TOL, '|1> z ≈ -1');
});

test('bloch: |+> single qubit -> (+1, 0, 0)', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = SQRT2_INV;
  state.getRawRe()[1] = SQRT2_INV;
  const b = blochOf(state);
  ok(Math.abs(b.vector(0).x - 1.0) < TOL, '|+> x ≈ +1');
  ok(Math.abs(b.vector(0).y) < TOL, '|+> y ≈ 0');
  ok(Math.abs(b.vector(0).z) < TOL, '|+> z ≈ 0');
});

test('bloch: |-> single qubit -> (-1, 0, 0)', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = SQRT2_INV;
  state.getRawRe()[1] = -SQRT2_INV;
  const b = blochOf(state);
  ok(Math.abs(b.vector(0).x - (-1.0)) < TOL, '|-> x ≈ -1');
  ok(Math.abs(b.vector(0).y) < TOL, '|-> y ≈ 0');
  ok(Math.abs(b.vector(0).z) < TOL, '|-> z ≈ 0');
});

test('bloch: |i> single qubit -> (0, +1, 0)', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = SQRT2_INV;
  state.getRawIm()[1] = SQRT2_INV;
  const b = blochOf(state);
  ok(Math.abs(b.vector(0).x) < TOL, '|i> x ≈ 0');
  ok(Math.abs(b.vector(0).y - 1.0) < TOL, '|i> y ≈ +1');
  ok(Math.abs(b.vector(0).z) < TOL, '|i> z ≈ 0');
});

test('bloch: |-i> single qubit -> (0, -1, 0)', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = SQRT2_INV;
  state.getRawIm()[1] = -SQRT2_INV;
  const b = blochOf(state);
  ok(Math.abs(b.vector(0).x) < TOL, '|-i> x ≈ 0');
  ok(Math.abs(b.vector(0).y - (-1.0)) < TOL, '|-i> y ≈ -1');
  ok(Math.abs(b.vector(0).z) < TOL, '|-i> z ≈ 0');
});

/* ------------------------------------------------------------------ */
/*  2. Qiskit reference (skipped when python3/Qiskit unavailable)     */
/* ------------------------------------------------------------------ */

if (!python3Available || !qiskitAvailable) {
  test.todo('Bloch vs Qiskit (python3/Qiskit unavailable)');
} else {
  /* Bell state n=2 -> each qubit maximally mixed -> Bloch = (0, 0, 0) */

  test('bloch: Bell state matches Qiskit partial trace', () => {
    const circuit = makeCircuit(2, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const sv = simqcEvaluate(circuitJson);
    const amplitudes = [];
    for (let i = 0; i < sv.size(); i += 1) {
      amplitudes.push([sv.getRe(i), sv.getIm(i)]);
    }
    const ref = runBloch(amplitudes, 2);
    strictEqual(ref.length, 2, 'Bell: bloch count');

    const b = blochOf(sv);
    assertBlochClose(
      [b.vector(0), b.vector(1)],
      [{ row: 0, x: 0, y: 0, z: 0 }, { row: 1, x: 0, y: 0, z: 0 }],
      'Bell SimQC vs Qiskit',
    );
    for (const entry of ref) {
      ok(
        Math.abs(entry.x) < TOL && Math.abs(entry.y) < TOL && Math.abs(entry.z) < TOL,
        `Bell Qiskit row ${entry.row} ≈ (0, 0, 0), got (${entry.x}, ${entry.y}, ${entry.z})`,
      );
    }
  });

  /* 3-qubit GHZ -> each qubit maximally mixed -> Bloch = (0, 0, 0) */

  test('bloch: GHZ state matches Qiskit partial trace', () => {
    const circuit = makeCircuit(3, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
      [gate('CNOT', 2, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const sv = simqcEvaluate(circuitJson);
    const amplitudes = [];
    for (let i = 0; i < sv.size(); i += 1) {
      amplitudes.push([sv.getRe(i), sv.getIm(i)]);
    }
    const ref = runBloch(amplitudes, 3);
    strictEqual(ref.length, 3, 'GHZ: bloch count');

    const b = blochOf(sv);
    const simqc = [b.vector(0), b.vector(1), b.vector(2)];
    assertBlochClose(
      simqc,
      [
        { row: 0, x: 0, y: 0, z: 0 },
        { row: 1, x: 0, y: 0, z: 0 },
        { row: 2, x: 0, y: 0, z: 0 },
      ],
      'GHZ SimQC vs Qiskit',
    );
    for (const entry of ref) {
      ok(
        Math.abs(entry.x) < TOL && Math.abs(entry.y) < TOL && Math.abs(entry.z) < TOL,
        `GHZ Qiskit row ${entry.row} ≈ (0, 0, 0), got (${entry.x}, ${entry.y}, ${entry.z})`,
      );
    }
  });

  /* Random entangled n=3 -> compare SimQC Bloch vs Qiskit partial trace */

  test('bloch: random entangled n=3 matches Qiskit partial trace', () => {
    const circuit = makeCircuit(3, [
      [gate('H', 0), gate('H', 1), gate('H', 2)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
      [gate('CZ', 2, { controls: [{ row: 1, on: true }] })],
      [gate('Rx', 2, { thetaRad: 0.7 })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const sv = simqcEvaluate(circuitJson);
    const amplitudes = [];
    for (let i = 0; i < sv.size(); i += 1) {
      amplitudes.push([sv.getRe(i), sv.getIm(i)]);
    }
    const ref = runBloch(amplitudes, 3);
    strictEqual(ref.length, 3, 'random: bloch count');

    const b = blochOf(sv);
    for (let q = 0; q < 3; q += 1) {
      const actual = b.vector(q);
      const expected = ref[q];
      strictEqual(expected.row, q, `random: row ${q} index`);
      ok(
        Math.abs(actual.x - expected.x) < TOL,
        `random: row ${q} x mismatch simqc=${actual.x} qiskit=${expected.x}`,
      );
      ok(
        Math.abs(actual.y - expected.y) < TOL,
        `random: row ${q} y mismatch simqc=${actual.y} qiskit=${expected.y}`,
      );
      ok(
        Math.abs(actual.z - expected.z) < TOL,
        `random: row ${q} z mismatch simqc=${actual.z} qiskit=${expected.z}`,
      );
    }
  });
}
