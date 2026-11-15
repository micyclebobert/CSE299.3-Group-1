// test/cross-validation/qiskit-vs-simqc.test.js
// -----------------------------------------------------------------------------
// M2 — Qiskit vs SimQC differential comparison.
//
// For each M1 fixture: spawn python3 qiskit-differential.py with fixture JSON
// on stdin; capture stdout; compare against evaluate(flattenCircuit(fromJson(
// fixture)), numQubits) from SimQC.
//
// Also includes algorithm-level cross-validation: Bell state, GHZ state,
// QFT(n) for n=1..4, Deutsch–Jozsa constant/balanced, Grover n=2, and Shor
// order-finding (15,7), (21,2), (35,2).
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
import { fromJson, toJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { Gate } from '../../src/circuit/GateColumn.js';
import { evaluate } from '../../src/sim/Evaluator.js';
import { qft } from '../../src/algorithms/qft.js';
import { deutschJozsa } from '../../src/algorithms/dj.js';
import { grover } from '../../src/algorithms/grover.js';
import { shor } from '../../src/algorithms/shor.js';

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

function simqcEvaluate(circuitJson) {
  const circuit = fromJson(circuitJson);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

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
  /* ------------------------------------------------------------------ */
  /*  M1 fixture comparison                                             */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
  /*  Algorithm-level cross-validation                                  */
  /* ------------------------------------------------------------------ */

  const INV_SQRT2 = 1 / Math.sqrt(2);

  // Bell state: H(0) -> CNOT(0->1) => (1/sqrt(2), 0, 0, 1/sqrt(2))
  test('algorithm: Bell state matches Qiskit', () => {
    const circuit = makeCircuit(2, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
    ]);
    const label = 'Bell state n=2';
    const qiskitOut = runQiskit(circuit);
    const simqcState = runSimQC(circuit);
    compareAmplitudes(qiskitOut, simqcState, 2, 1e-12);

    ok(
      Math.abs(simqcState.getRe(0) - INV_SQRT2) < 1e-12,
      `${label}: re[0] ≈ 1/sqrt(2)`,
    );
    ok(
      Math.abs(simqcState.getRe(3) - INV_SQRT2) < 1e-12,
      `${label}: re[3] ≈ 1/sqrt(2)`,
    );
  });

  // 3-qubit GHZ state: H(0) -> CNOT(0->1) -> CNOT(0->2)
  test('algorithm: GHZ state matches Qiskit', () => {
    const circuit = makeCircuit(3, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
      [gate('CNOT', 2, { controls: [{ row: 0, on: true }] })],
    ]);
    const label = 'GHZ state n=3';
    const qiskitOut = runQiskit(circuit);
    const simqcState = runSimQC(circuit);
    compareAmplitudes(qiskitOut, simqcState, 3, 1e-12);

    ok(
      Math.abs(simqcState.getRe(0) - INV_SQRT2) < 1e-12,
      `${label}: re[0] ≈ 1/sqrt(2)`,
    );
    ok(
      Math.abs(simqcState.getRe(7) - INV_SQRT2) < 1e-12,
      `${label}: re[7] ≈ 1/sqrt(2)`,
    );
  });

  // QFT(n) for n=1..4 vs Qiskit
  for (const n of [1, 2, 3, 4]) {
    test(`algorithm: QFT n=${n} matches Qiskit`, () => {
      const qftCircuit = qft(n);
      const circuitJson = toJson(qftCircuit);
      const qiskitOut = runQiskit(circuitJson);
      const simqcState = simqcEvaluate(circuitJson);
      compareAmplitudes(qiskitOut, simqcState, n, 1e-12);
    });
  }

  // Deutsch–Jozsa: constant f(x)=0 and balanced f(x)=x_0
  for (const n of [1, 2, 3]) {
    // Constant f(x) = 0: no oracle gates
    test(`algorithm: DJ constant n=${n} matches Qiskit`, () => {
      const label = `DJ constant n=${n}`;
      const djCircuit = deutschJozsa(n, []);
      const circuitJson = toJson(djCircuit);
      const qiskitOut = runQiskit(circuitJson);
      const simqcState = simqcEvaluate(circuitJson);
      compareAmplitudes(qiskitOut, simqcState, n + 1, 1e-12);

      // All input qubits measure |0...0>: probability mass on indices 0 and 1
      // (ancilla free, all input bits = 0). For n+1 qubits, indices 0 and 1
      // correspond to |0...0⟩|0⟩ and |0...0⟩|1⟩.
      const pInputZero = simqcState.probability(0) + simqcState.probability(1);
      ok(
        Math.abs(pInputZero - 1.0) < 1e-9,
        `${label}: input qubits not all |0⟩ (mass=${pInputZero})`,
      );
    });

    // Balanced f(x) = x_0: CNOT from input qubit 0 to ancilla
    const balancedOracle = [
      new Gate({ name: 'CNOT', target: n, controls: [{ row: 0, on: true }] }),
    ];
    test(`algorithm: DJ balanced n=${n} matches Qiskit`, () => {
      const djCircuit = deutschJozsa(n, balancedOracle);
      const circuitJson = toJson(djCircuit);
      const qiskitOut = runQiskit(circuitJson);
      const simqcState = simqcEvaluate(circuitJson);
      compareAmplitudes(qiskitOut, simqcState, n + 1, 1e-12);

      // At least one input qubit measures non-zero (balanced -> not |0...0>)
      let allZero = true;
      for (let i = 1; i < 1 << n; i++) {
        if (simqcState.probability(i) > 0.5) {
          allZero = false;
          break;
        }
      }
      ok(!allZero, `DJ balanced n=${n}: not all-zero as expected`);
    });
  }

  // Grover n=2: mark |11>, one iteration, peak at |11>
  test('algorithm: Grover n=2 matches Qiskit', () => {
    const oracleGates = [
      gate('X', 0),
      gate('X', 1),
      gate('CZ', 1, { controls: [{ row: 0, on: true }] }),
      gate('X', 0),
      gate('X', 1),
    ];
    const diffusionGates = [
      gate('H', 0),
      gate('H', 1),
      gate('X', 0),
      gate('X', 1),
      gate('CZ', 1, { controls: [{ row: 0, on: true }] }),
      gate('X', 0),
      gate('X', 1),
      gate('H', 0),
      gate('H', 1),
    ];
    const groverCircuit = grover(2, oracleGates, diffusionGates, 1);
    const circuitJson = toJson(groverCircuit);
    const qiskitOut = runQiskit(circuitJson);
    const simqcState = simqcEvaluate(circuitJson);
    compareAmplitudes(qiskitOut, simqcState, 2, 1e-12);

    // Peak amplitude at |11> (index 3)
    ok(
      simqcState.probability(3) > 0.9,
      'Grover n=2: peak probability at |11> > 0.9',
    );
  });

  // Shor order-finding: (15,7), (21,2), (35,2)
  for (const [N, a] of [[15, 7], [21, 2], [35, 2]]) {
    test(`algorithm: Shor N=${N}, a=${a} matches Qiskit`, () => {
      const t = Math.min(2 * Math.ceil(Math.log2(N)), 8);
      const shorCircuit = shor(N, a, { t });
      const numQubits = shorCircuit.numQubits;

      // Skip if too large for memory
      if (numQubits > 20) {
        ok(true, `Shor N=${N},a=${a}: skipped (${numQubits} qubits, too large)`);
        return;
      }

      const circuitJson = toJson(shorCircuit);
      const qiskitOut = runQiskit(circuitJson);
      const simqcState = simqcEvaluate(circuitJson);
      compareAmplitudes(qiskitOut, simqcState, numQubits, 1e-12);
    });
  }

  function runSimQC(circuit) {
    const circuitJson = JSON.stringify(circuit);
    return simqcEvaluate(circuitJson);
  }
}
