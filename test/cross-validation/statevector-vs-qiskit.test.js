// test/cross-validation/statevector-vs-qiskit.test.js
// -----------------------------------------------------------------------------
// M1.4 — StateVector cross-validation vs Qiskit `Statevector`.
//
// Compares src/core/StateVector.js against Qiskit:
//   - `new StateVector(n)` init to |0…0⟩ vs Qiskit Statevector.from_label('0'*n)
//   - `probability(i)`, `probabilities()`, `normSquared()` vs Qiskit Statevector
//     probabilities for random circuits n=1..6.
//
// Tolerance: 1e-12 (n <= 8). Skips gracefully if Qiskit unavailable, so
// `node --test` passes in bare environments.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';
import { StateVector } from '../../src/core/StateVector.js';
import { fromJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

const QISKIT_SCRIPT = new URL('./qiskit-differential.py', import.meta.url)
  .pathname;
const TOL = 1e-12;

/* ------------------------------------------------------------------ */
/*  Deterministic seeded PRNG (mulberry32)                            */
/* ------------------------------------------------------------------ */

let rngSeed = 0x243f6a88;
function randUint32() {
  rngSeed = (rngSeed + 0x9e3779b9) | 0;
  let z = rngSeed;
  z = (z ^ (z >>> 16)) >>> 0;
  z = Math.imul(z, 0x21f0aa8d) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

function randFloat(min, max) {
  return min + (randUint32() / 0xffffffff) * (max - min);
}

function randChoice(arr) {
  return arr[randUint32() % arr.length];
}

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

function runQiskit(circuit) {
  const result = spawnSync('python3', [QISKIT_SCRIPT], {
    input: JSON.stringify(circuit),
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `qiskit-differential.py exited ${result.status}: ${result.stderr.toString()}`,
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

function compareStateVectorToQiskit(qiskitOut, sv, numQubits, label) {
  strictEqual(qiskitOut.qubits, numQubits, `${label}: qubit count`);
  strictEqual(
    qiskitOut.probabilities.length,
    sv.size(),
    `${label}: probabilities length`,
  );

  let probSum = 0;
  for (let i = 0; i < sv.size(); i += 1) {
    const qProb = qiskitOut.probabilities[i];
    const sProb = sv.probability(i);
    ok(
      Math.abs(qProb - sProb) < TOL,
      `${label}: probability[${i}] mismatch qiskit=${qProb} simqc=${sProb}`,
    );
    probSum += sProb;
  }

  // probabilities() array matches individual probability(i) calls.
  const probs = sv.probabilities();
  strictEqual(probs.length, sv.size(), `${label}: probabilities() length`);
  for (let i = 0; i < sv.size(); i += 1) {
    ok(
      Math.abs(probs[i] - sv.probability(i)) < TOL,
      `${label}: probabilities()[${i}] != probability(${i})`,
    );
  }

  // normSquared == 1 within tolerance.
  ok(
    Math.abs(sv.normSquared() - 1.0) < TOL,
    `${label}: normSquared ≈ 1, got ${sv.normSquared()}`,
  );

  // Probabilities sum to 1.
  ok(
    Math.abs(probSum - 1.0) < TOL,
    `${label}: probabilities sum to 1, got ${probSum}`,
  );
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
/*  1. Hand-computed analytical values (always run)                   */
/* ------------------------------------------------------------------ */

test('StateVector init: new StateVector(n) is |0…0⟩', () => {
  for (const n of [1, 2, 3, 4, 6]) {
    const sv = new StateVector(n);
    strictEqual(sv.numQubits(), n, `init n=${n}: numQubits`);
    strictEqual(sv.size(), 1 << n, `init n=${n}: size`);
    strictEqual(sv.getRe(0), 1.0, `init n=${n}: re[0] = 1`);
    strictEqual(sv.getIm(0), 0.0, `init n=${n}: im[0] = 0`);
    for (let i = 1; i < sv.size(); i += 1) {
      strictEqual(sv.getRe(i), 0.0, `init n=${n}: re[${i}] = 0`);
      strictEqual(sv.getIm(i), 0.0, `init n=${n}: im[${i}] = 0`);
    }
  }
});

test('StateVector probability: |0…0⟩ has probability 1 at index 0', () => {
  const sv = new StateVector(3);
  strictEqual(sv.probability(0), 1.0, 'probability(0) = 1');
  for (let i = 1; i < 8; i += 1) {
    strictEqual(sv.probability(i), 0.0, `probability(${i}) = 0`);
  }
});

test('StateVector probabilities(): returns array for |0…0⟩', () => {
  const sv = new StateVector(3);
  const probs = sv.probabilities();
  strictEqual(probs.length, 8, 'probabilities() length');
  strictEqual(probs[0], 1.0, 'probabilities()[0] = 1');
  for (let i = 1; i < 8; i += 1) {
    strictEqual(probs[i], 0.0, `probabilities()[${i}] = 0`);
  }
});

test('StateVector normSquared: |0…0⟩ has norm 1', () => {
  for (const n of [1, 2, 3, 6]) {
    strictEqual(new StateVector(n).normSquared(), 1.0, `normSquared n=${n}`);
  }
});

/* ------------------------------------------------------------------ */
/*  2. Qiskit reference (skipped when python3/Qiskit unavailable)     */
/* ------------------------------------------------------------------ */

if (!python3Available || !qiskitAvailable) {
  test.todo('StateVector vs Qiskit (python3/Qiskit unavailable)');
} else {
  /* Empty circuit |0…0⟩ matches Qiskit Statevector.from_label('0'*n) */

  for (const n of [1, 2, 3, 4]) {
    test(`StateVector vs Qiskit: empty circuit n=${n} matches from_label`, () => {
      const sv = new StateVector(n);
      const circuit = makeCircuit(n, []);
      const circuitJson = JSON.stringify(circuit);
      const qiskitOut = runQiskit(circuitJson);
      compareStateVectorToQiskit(qiskitOut, sv, n, `empty n=${n}`);
    });
  }

  /* Bell state: H(0) -> CNOT(0->1) */

  test('StateVector vs Qiskit: Bell state probabilities match', () => {
    const circuit = makeCircuit(2, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const qiskitOut = runQiskit(circuitJson);
    const sv = simqcEvaluate(circuitJson);
    compareStateVectorToQiskit(qiskitOut, sv, 2, 'Bell state');
  });

  /* 3-qubit GHZ state */

  test('StateVector vs Qiskit: GHZ state probabilities match', () => {
    const circuit = makeCircuit(3, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
      [gate('CNOT', 2, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const qiskitOut = runQiskit(circuitJson);
    const sv = simqcEvaluate(circuitJson);
    compareStateVectorToQiskit(qiskitOut, sv, 3, 'GHZ state');
  });

  /* Random circuits n=1..6 */

  const singleQubitGates = ['H', 'X', 'Y', 'Z', 'S', 'T'];
  const rotationGates = ['Rx', 'Ry', 'Rz'];

  for (const n of [1, 2, 3, 4, 5, 6]) {
    test(`StateVector vs Qiskit: random circuit n=${n} matches`, () => {
      const numCols = 1 + (randUint32() % 5);
      const columns = [];
      for (let c = 0; c < numCols; c += 1) {
        const colGates = [];
        const usedRows = new Set();
        const numGates = 1 + (randUint32() % n);
        for (let g = 0; g < numGates; g += 1) {
          const target = randUint32() % n;
          if (usedRows.has(target)) continue;
          usedRows.add(target);
          const gateName = randChoice(
            randUint32() % 2 === 0 ? singleQubitGates : rotationGates,
          );
          const entry = { gate: gateName, target };
          if (rotationGates.includes(gateName)) {
            entry.thetaRad = randFloat(-Math.PI, Math.PI);
          }
          colGates.push(entry);
        }
        if (colGates.length > 0) {
          columns.push(colGates);
        }
      }
      const circuit = makeCircuit(n, columns);
      const circuitJson = JSON.stringify(circuit);
      const qiskitOut = runQiskit(circuitJson);
      const sv = simqcEvaluate(circuitJson);
      compareStateVectorToQiskit(qiskitOut, sv, n, `random n=${n}`);
    });
  }
}
