// test/cross-validation/qiskit-steptrace.test.js
// -----------------------------------------------------------------------------
// M2 — StepTrace step-by-step vs Qiskit differential comparison.
//
// Runs StepTrace column by column and, at each virtual column boundary,
// compares SimQC's intermediate state against Qiskit's state for the prefix
// circuit (columns 0..k-1). Confirms intermediate states, not just final.
//
// Covers: Bell state (n=2), QFT(n) for n=1..4.
//
// Tolerance: 1e-12 per amplitude component (n <= 8).
//
// Skips gracefully (test marked todo) if python3 or Qiskit unavailable, so
// `node --test` passes in bare environments.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { resolvePythonEnv } from './python_env.js';
import { fromJson, toJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { StepTrace } from '../../src/sim/StepTrace.js';
// Seed the GateRegistry so StepTrace can resolve gate IDs.
import '../../src/main.js';
import { qft } from '../../src/algorithms/qft.js';

const QISKIT_SCRIPT = new URL('./qiskit-differential.py', import.meta.url)
  .pathname;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function runQiskit(circuitJson) {
  const result = spawnSync(python, [QISKIT_SCRIPT], {
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

function compareAmplitudes(qiskitOut, simqcState, numQubits, tolerance, label) {
  strictEqual(
    qiskitOut.qubits,
    numQubits,
    `${label}: qubit count mismatch`,
  );
  strictEqual(
    qiskitOut.amplitudes.length,
    simqcState.size(),
    `${label}: amplitudes length mismatch`,
  );

  const size = simqcState.size();
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

/**
 * Build a prefix circuit JSON from execution columns [0, endCol).
 * Each execution column becomes one circuit column.
 */
function prefixCircuitJson(numQubits, execCols, endCol) {
  const columns = [];
  for (let c = 0; c < endCol; c++) {
    const gateDescs = execCols[c].instructions.map((instr) => {
      const desc = { gate: instr.gateId, target: instr.target };
      if (instr.target2 !== undefined) {
        desc.target2 = instr.target2;
      }
      if (instr.thetaRad !== undefined) {
        desc.thetaRad = instr.thetaRad;
      }
      if (instr.controls && instr.controls.length > 0) {
        desc.controls = instr.controls;
      }
      return desc;
    });
    columns.push(gateDescs);
  }

  return JSON.stringify({
    format: 'simqc-circuit',
    version: 1,
    bitOrder: 'little-endian',
    numQubits,
    columns,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

const pythonEnv = resolvePythonEnv({ packages: ['qiskit', 'numpy'] });
const pythonAvailable = pythonEnv !== null;
const python = pythonEnv?.python;

if (!pythonAvailable) {
  test.todo(
    'StepTrace vs Qiskit step-by-step (python3/Qiskit unavailable)',
  );
} else {
  /* ------------------------------------------------------------------ */
  /*  Bell state step-by-step                                           */
  /* ------------------------------------------------------------------ */

  test('StepTrace: Bell state step-by-step vs Qiskit', () => {
    const circuit = fromJson(JSON.stringify({
      format: 'simqc-circuit',
      version: 1,
      bitOrder: 'little-endian',
      numQubits: 2,
      columns: [
        [{ gate: 'H', target: 0 }],
        [{ gate: 'CNOT', target: 1, controls: [{ row: 0, on: true }] }],
      ],
    }));

    const instructions = flattenCircuit(circuit);
    const schedule = scheduleColumns(instructions);
    const trace = new StepTrace(schedule, 2);
    const tolerance = 1e-12;

    for (let k = 0; k <= schedule.length; k++) {
      trace.seek(k);
      const simqcState = trace.currentState;

      const prefixJson = prefixCircuitJson(2, schedule, k);
      const qiskitOut = runQiskit(prefixJson);

      compareAmplitudes(
        qiskitOut,
        simqcState,
        2,
        tolerance,
        `Bell step ${k}`,
      );
    }
  });

  /* ------------------------------------------------------------------ */
  /*  QFT(n) step-by-step for n=1..4                                    */
  /* ------------------------------------------------------------------ */

  for (const n of [1, 2, 3, 4]) {
    test(`StepTrace: QFT n=${n} step-by-step vs Qiskit`, () => {
      const qftCircuit = qft(n);
      const circuitJson = toJson(qftCircuit);
      const parsed = fromJson(circuitJson);

      const instructions = flattenCircuit(parsed);
      const schedule = scheduleColumns(instructions);
      const trace = new StepTrace(schedule, n);
      const tolerance = 1e-12;

      for (let k = 0; k <= schedule.length; k++) {
        trace.seek(k);
        const simqcState = trace.currentState;

        const prefixJson = prefixCircuitJson(n, schedule, k);
        const qiskitOut = runQiskit(prefixJson);

        compareAmplitudes(
          qiskitOut,
          simqcState,
          n,
          tolerance,
          `QFT n=${n} step ${k}`,
        );
      }
    });
  }
}
