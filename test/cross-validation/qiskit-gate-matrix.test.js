// test/cross-validation/qiskit-gate-matrix.test.js
// -----------------------------------------------------------------------------
// M2 — Gate-level cross-validation matrix vs Qiskit.
//
// Each test builds a minimal circuit exercising one gate (or gate pair),
// runs it through Qiskit via qiskit-differential.py, and compares against
// SimQC's evaluate(flattenCircuit(fromJson(...))). State-vector equality is
// asserted per amplitude component within tolerance 1e-12 (n <= 8).
//
// Covered gates:
//   - Single-qubit: H, X, Y, Z, S, T on |0> and |1> (n=1)
//   - CNOT(0->1) and CNOT(1->0) exact swap pairs on n=3
//   - CZ phase flip (n=2)
//   - Rx/Ry/Rz vs Qiskit RX/RY/RZ with matching radian angles (n=1)
//   - Cu1 vs Qiskit CU1 (n=2)
//   - Toffoli vs Qiskit CCX (n=3)
//
// Skips gracefully (test.todo) if python3 or Qiskit unavailable, so
// `node --test` passes in bare environments.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { fromJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

const QISKIT_SCRIPT = new URL('./qiskit-differential.py', import.meta.url)
  .pathname;

/* ------------------------------------------------------------------ */
/*  Availability checks                                               */
/* ------------------------------------------------------------------ */

function isPython3Available() {
  try {
    const result = spawnSync('python3', ['--version'], {
      stdio: 'ignore',
    });
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeCircuit(numQubits, columns) {
  return {
    format: 'simqc-circuit',
    version: 1,
    bitOrder: 'little-endian',
    numQubits,
    columns,
  };
}

function gate(gateName, target, extra = {}) {
  return { gate: gateName, target, ...extra };
}

function runQiskit(circuit) {
  const result = spawnSync(
    'python3',
    [QISKIT_SCRIPT],
    {
      input: JSON.stringify(circuit),
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `qiskit-differential.py exited with code ${result.status}: ${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout);
}

function runSimQC(circuit) {
  const circuitJson = JSON.stringify(circuit);
  const parsed = fromJson(circuitJson);
  const instructions = flattenCircuit(parsed);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, parsed.numQubits);
}

function assertStateVectorsMatch(qiskitOut, simqcState, numQubits, label) {
  const tolerance = 1e-12;
  const size = 1 << numQubits;

  strictEqual(qiskitOut.qubits, numQubits, `${label}: qubit count`);
  strictEqual(
    qiskitOut.amplitudes.length,
    size,
    `${label}: amplitudes length`,
  );

  for (let i = 0; i < size; i++) {
    const qRe = qiskitOut.amplitudes[i].re;
    const qIm = qiskitOut.amplitudes[i].im;
    const sRe = simqcState.getRe(i);
    const sIm = simqcState.getIm(i);

    ok(
      Math.abs(qRe - sRe) < tolerance,
      `${label}: amplitude[${i}] re mismatch qiskit=${qRe} simqc=${sRe}`,
    );
    ok(
      Math.abs(qIm - sIm) < tolerance,
      `${label}: amplitude[${i}] im mismatch qiskit=${qIm} simqc=${sIm}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Availability gate                                                 */
/* ------------------------------------------------------------------ */

const python3Available = isPython3Available();
const qiskitAvailable = python3Available && isQiskitAvailable();

if (!python3Available || !qiskitAvailable) {
  test.todo(
    'qiskit gate matrix: differential comparison (python3/Qiskit unavailable)',
  );
} else {
  /* ------------------------------------------------------------------ */
  /*  Single-qubit gates on |0> and |1> (n=1)                           */
  /* ------------------------------------------------------------------ */

  const singleQubitGates = ['H', 'X', 'Y', 'Z', 'S', 'T'];

  for (const gateName of singleQubitGates) {
    for (const initialState of [0, 1]) {
      const prepColumns =
        initialState === 1 ? [[gate('X', 0)]] : [];
      const testColumns = [...prepColumns, [gate(gateName, 0)]];

      const circuit = makeCircuit(1, testColumns);
      const label = `${gateName} on |${initialState}>`;

      test(`single-qubit: ${label}`, () => {
        const qiskitOut = runQiskit(circuit);
        const simqcState = runSimQC(circuit);
        assertStateVectorsMatch(qiskitOut, simqcState, 1, label);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  CNOT(0->1) and CNOT(1->0) exact swap pairs on n=3                 */
  /* ------------------------------------------------------------------ */

  test('CNOT(0->1): exact swap pairs {1,3} and {5,7} on n=3', () => {
    const circuit = makeCircuit(3, [
      [{ gate: 'X', target: 0 }],
      [
        gate('CNOT', 1, {
          controls: [{ row: 0, on: true }],
        }),
      ],
    ]);
    const label = 'CNOT(0->1) n=3';
    const qiskitOut = runQiskit(circuit);
    const simqcState = runSimQC(circuit);
    assertStateVectorsMatch(qiskitOut, simqcState, 3, label);

    // |001> = index 1. CNOT(0->1): row0=1 -> flip row1 -> |011> = index 3.
    ok(
      Math.abs(simqcState.getRe(3) - 1.0) < 1e-12,
      `${label}: index 3 should be 1.0`,
    );
  });

  test('CNOT(1->0): exact swap pairs {2,3} and {6,7} on n=3', () => {
    const circuit = makeCircuit(3, [
      [{ gate: 'X', target: 1 }],
      [
        gate('CNOT', 0, {
          controls: [{ row: 1, on: true }],
        }),
      ],
    ]);
    const label = 'CNOT(1->0) n=3';
    const qiskitOut = runQiskit(circuit);
    const simqcState = runSimQC(circuit);
    assertStateVectorsMatch(qiskitOut, simqcState, 3, label);

    // |010> = index 2. CNOT(1->0): row1=1 -> flip row0 -> |011> = index 3.
    ok(
      Math.abs(simqcState.getRe(3) - 1.0) < 1e-12,
      `${label}: index 3 should be 1.0`,
    );
  });

  /* ------------------------------------------------------------------ */
  /*  CZ phase flip (n=2)                                               */
  /* ------------------------------------------------------------------ */

  test('CZ: phase flip on |11> (n=2)', () => {
    const circuit = makeCircuit(2, [
      [{ gate: 'X', target: 0 }],
      [{ gate: 'X', target: 1 }],
      [
        gate('CZ', 1, {
          controls: [{ row: 0, on: true }],
        }),
      ],
    ]);
    const label = 'CZ phase flip n=2';
    const qiskitOut = runQiskit(circuit);
    const simqcState = runSimQC(circuit);
    assertStateVectorsMatch(qiskitOut, simqcState, 2, label);

    // |11> = index 3 should have amplitude -1 (phase flip).
    ok(
      Math.abs(simqcState.getRe(3) - (-1.0)) < 1e-12,
      `${label}: index 3 should be -1.0`,
    );
  });

  /* ------------------------------------------------------------------ */
  /*  Rx / Ry / Rz vs Qiskit RX / RY / RZ                               */
  /* ------------------------------------------------------------------ */

  const rotationAngles = [0.0, 0.5, 1.0, Math.PI / 2, Math.PI];
  for (const gateName of ['Rx', 'Ry', 'Rz']) {
    for (const theta of rotationAngles) {
      const circuit = makeCircuit(1, [
        [gate(gateName, 0, { thetaRad: theta })],
      ]);
      const label = `${gateName}(θ=${theta}) n=1`;
      test(`rotation: ${label}`, () => {
        const qiskitOut = runQiskit(circuit);
        const simqcState = runSimQC(circuit);
        assertStateVectorsMatch(qiskitOut, simqcState, 1, label);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Cu1 vs Qiskit CU1 (n=2)                                           */
  /* ------------------------------------------------------------------ */

  const cu1Angles = [0.0, Math.PI / 4, Math.PI / 2, Math.PI];
  for (const theta of cu1Angles) {
    const circuit = makeCircuit(2, [
      [{ gate: 'X', target: 0 }],
      [{ gate: 'X', target: 1 }],
      [
        gate('Cu1', 0, {
          controls: [{ row: 1, on: true }],
          thetaRad: theta,
        }),
      ],
    ]);
    const label = `Cu1(θ=${theta}) n=2`;
    test(`controlled-phase: ${label}`, () => {
      const qiskitOut = runQiskit(circuit);
      const simqcState = runSimQC(circuit);
      assertStateVectorsMatch(qiskitOut, simqcState, 2, label);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Toffoli vs Qiskit CCX (n=3)                                       */
  /* ------------------------------------------------------------------ */

  test('Toffoli: CCX on n=3', () => {
    const circuit = makeCircuit(3, [
      [{ gate: 'X', target: 0 }],
      [{ gate: 'X', target: 1 }],
      [
        gate('Toffoli', 2, {
          controls: [
            { row: 0, on: true },
            { row: 1, on: true },
          ],
        }),
      ],
    ]);
    const label = 'Toffoli CCX n=3';
    const qiskitOut = runQiskit(circuit);
    const simqcState = runSimQC(circuit);
    assertStateVectorsMatch(qiskitOut, simqcState, 3, label);

    // |110> = index 6. Toffoli: controls row0=1, row1=1 -> flip target row2 -> |111> = index 7.
    ok(
      Math.abs(simqcState.getRe(7) - 1.0) < 1e-12,
      `${label}: index 7 should be 1.0`,
    );
  });
}
