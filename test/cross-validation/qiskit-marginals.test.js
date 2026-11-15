// test/cross-validation/qiskit-marginals.test.js
// -----------------------------------------------------------------------------
// M2 — Sparse summary marginals vs Qiskit partial trace.
//
// Compares SparseSummary.marginals(re, im, n) (rho00, S_L per qubit row)
// against Qiskit partial_trace probabilities for each qubit row across
// Bell, GHZ, and random entangled circuits.
//
// Tolerance: 1e-9.
//
// Skips gracefully (test marked todo) if python3 or Qiskit unavailable, so
// `node --test` passes in bare environments.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { fromJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { marginals } from '../../src/core/SparseSummary.js';
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

function runQiskitMarginals(circuitJson, rows) {
  const rowArg = rows.join(",");
  const result = spawnSync(
    "python3",
    [QISKIT_SCRIPT, rowArg],
    {
      input: circuitJson,
      encoding: "utf-8",
      maxBuffer: 1024 * 1024,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `qiskit-differential.py (marginals) exited with code ${result.status}: ${result.stderr}`,
    );
  }

  return JSON.parse(result.stdout).marginals;
}

function simqcEvaluate(circuitJson) {
  const circuit = fromJson(circuitJson);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

const python3Available = isPython3Available();
const qiskitAvailable = python3Available && isQiskitAvailable();

if (!python3Available || !qiskitAvailable) {
  test.todo(
    'marginals vs Qiskit partial trace (python3/Qiskit unavailable)',
  );
} else {
  const marginalCircuits = [
    {
      name: "Bell state n=2",
      circuit: makeCircuit(2, [
        [gate("H", 0)],
        [gate("CNOT", 1, { controls: [{ row: 0, on: true }] })],
      ]),
    },
    {
      name: "GHZ state n=3",
      circuit: makeCircuit(3, [
        [gate("H", 0)],
        [gate("CNOT", 1, { controls: [{ row: 0, on: true }] })],
        [gate("CNOT", 2, { controls: [{ row: 0, on: true }] })],
      ]),
    },
    {
      name: "Random entangled n=3",
      circuit: makeCircuit(3, [
        [gate("H", 0), gate("H", 1), gate("H", 2)],
        [gate("CNOT", 1, { controls: [{ row: 0, on: true }] })],
        [gate("CZ", 2, { controls: [{ row: 1, on: true }] })],
        [gate("Rx", 2, { thetaRad: 0.7 })],
      ]),
    },
  ];

  for (const { name, circuit } of marginalCircuits) {
    const numQubits = circuit.numQubits;
    const circuitJson = JSON.stringify(circuit);

    // Qiskit partial trace marginals for all qubit rows.
    const qiskitMarginals = runQiskitMarginals(
      circuitJson,
      Array.from({ length: numQubits }, (_, i) => i),
    );

    // SimQC sparse summary marginals.
    const simqcState = simqcEvaluate(circuitJson);
    const simqcMarginals = marginals(
      simqcState.getRawRe(),
      simqcState.getRawIm(),
      numQubits,
    );

    test(`marginals: ${name} vs Qiskit partial trace`, () => {
      strictEqual(
        qiskitMarginals.length,
        numQubits,
        `${name}: marginals count`,
      );
      strictEqual(
        simqcMarginals.length,
        numQubits,
        `${name}: simqc marginals count`,
      );

      const tolerance = 1e-9;
      for (let q = 0; q < numQubits; q++) {
        const qm = qiskitMarginals[q];
        const sm = simqcMarginals[q];

        strictEqual(qm.row, q, `${name}: row ${q} index`);
        strictEqual(sm.row, q, `${name}: simqc row ${q} index`);

        ok(
          Math.abs(qm.rho00 - sm.rho00) < tolerance,
          `${name}: row ${q} rho00 mismatch qiskit=${qm.rho00} simqc=${sm.rho00}`,
        );
        ok(
          Math.abs(qm.rho11 - sm.rho11) < tolerance,
          `${name}: row ${q} rho11 mismatch qiskit=${qm.rho11} simqc=${sm.rho11}`,
        );
        ok(
          Math.abs(qm.S_L - sm.S_L) < tolerance,
          `${name}: row ${q} S_L mismatch qiskit=${qm.S_L} simqc=${sm.S_L}`,
        );
        ok(
          Math.abs(qm.gamma - sm.gamma) < tolerance,
          `${name}: row ${q} gamma mismatch qiskit=${qm.gamma} simqc=${sm.gamma}`,
        );
      }
    });
  }
}
