// test/cross-validation/qiskit-vs-simqc.test.js
// -----------------------------------------------------------------------------
// M2 — Qiskit vs SimQC differential comparison.
//
// For each M1 fixture: spawn python3 qiskit-differential.py with fixture JSON
// on stdin; capture stdout; compare against evaluate(flattenCircuit(fromJson(
// fixture)), numQubits) from SimQC.
//
// Tolerance: 1e-12 per amplitude component (n <= 8) / 1e-9 (n > 8).
//
// Skips gracefully (test marked todo) if python3 or Qiskit unavailable, so
// `node --test` passes in bare environments.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { fromJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

const FIXTURE_DIR = new URL('./fixtures', import.meta.url).pathname;
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
/*  Fixture collection                                                */
/* ------------------------------------------------------------------ */

function collectFixtures() {
  const fixtures = [];
  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const path = new URL(file, FIXTURE_DIR).pathname;
    let content;
    try {
      content = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue; // skip unparseable fixtures
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.format === 'simqc-circuit') {
          fixtures.push({ source: file, circuit: item });
        }
      }
    } else if (parsed && parsed.format === 'simqc-circuit') {
      fixtures.push({ source: file, circuit: parsed });
    }
    // Objects without 'format' (e.g. analytic_states.json) are skipped.
  }

  return fixtures;
}

/* ------------------------------------------------------------------ */
/*  Qiskit runner                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  SimQC evaluator                                                   */
/* ------------------------------------------------------------------ */

function simqcEvaluate(circuitJson) {
  const circuit = fromJson(circuitJson);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

/* ------------------------------------------------------------------ */
/*  Comparison                                                        */
/* ------------------------------------------------------------------ */

function compareAmplitudes(qiskitOut, simqcState, numQubits, tolerance) {
  strictEqual(
    qiskitOut.qubits,
    numQubits,
    'qubit count mismatch',
  );
  strictEqual(
    qiskitOut.probabilities.length,
    simqcState.size(),
    'probabilities length mismatch',
  );
  strictEqual(
    qiskitOut.amplitudes.length,
    simqcState.size(),
    'amplitudes length mismatch',
  );

  const size = simqcState.size();
  for (let i = 0; i < size; i++) {
    const qRe = qiskitOut.amplitudes[i].re;
    const qIm = qiskitOut.amplitudes[i].im;
    const sRe = simqcState.getRe(i);
    const sIm = simqcState.getIm(i);

    ok(
      Math.abs(qRe - sRe) < tolerance,
      `amplitude[${i}] re mismatch: qiskit=${qRe} simqc=${sRe}`,
    );
    ok(
      Math.abs(qIm - sIm) < tolerance,
      `amplitude[${i}] im mismatch: qiskit=${qIm} simqc=${sIm}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

const python3Available = isPython3Available();
const qiskitAvailable = python3Available && isQiskitAvailable();
const fixtures = collectFixtures();

if (!python3Available || !qiskitAvailable) {
  test.todo(
    'qiskit vs simqc: differential comparison (python3/Qiskit unavailable)',
  );
} else {
  test('qiskit vs simqc: all M1 fixtures match within tolerance', async (t) => {
    for (const { source, circuit } of fixtures) {
      const numQubits = circuit.numQubits;
      const tolerance = numQubits <= 8 ? 1e-12 : 1e-9;
      const fixtureName = `${source}[${numQubits}q]`;

      await t.test(fixtureName, async () => {
        const circuitJson = JSON.stringify(circuit);
        const qiskitOut = runQiskit(circuitJson);
        const simqcState = simqcEvaluate(circuitJson);
        compareAmplitudes(qiskitOut, simqcState, numQubits, tolerance);
      });
    }
  });
}
