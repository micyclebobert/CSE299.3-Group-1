// test/cross-validation/measurement-vs-qiskit.test.js
// -----------------------------------------------------------------------------
// M1.5 — Measurement Born rule & histogram vs Qiskit counts.
//
// Compares src/measurement/measurement.js (collapse + sampleHistogram) against
// Qiskit measurement outcome probabilities:
//
//   - Always-run analytical/Born-rule tests (no Qiskit needed):
//       * sampleHistogram returns a Map<number,number> summing to `shots`.
//       * sampleHistogram does not mutate the source StateVector.
//       * collapse mutates in place to a basis index consistent with the
//         Born distribution (|+> collapses to 0 or 1; a prob-1 basis state
//         always collapses to that index).
//       * Empirical Born sampling of known superpositions matches analytical
//         probabilities within statistical tolerance.
//   - Qiskit differential tests (skipped gracefully when python3/Qiskit
//     unavailable): Bell state, GHZ state, and a random circuit n=3. Qiskit
//     Statevector probabilities are compared against empirical frequencies
//     from sampleHistogram over N shots within statistical tolerance.
//
// Statistical tolerance: per-bin |empirical_freq - qiskit_prob| <
//   max(6 * sqrt(p(1-p)/N), 0.005) with N = 20000 shots (~6-sigma, non-flaky).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
import { spawnSync } from 'child_process';
import { resolvePythonEnv } from './python_env.js';
import { StateVector } from '../../src/core/StateVector.js';
import { collapse, sampleHistogram } from '../../src/measurement/measurement.js';
import { fromJson } from '../../src/circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';

// Seed the GateRegistry so evaluate() can resolve gate IDs.
import '../../src/main.js';

const QISKIT_SCRIPT = new URL('./qiskit-differential.py', import.meta.url)
  .pathname;
const SHOTS = 20000;

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

function simqcEvaluate(circuitJson) {
  const circuit = fromJson(circuitJson);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

/* ------------------------------------------------------------------ */
/*  Statistical tolerance helpers                                     */
/* ------------------------------------------------------------------ */

/* Per-bin tolerance for empirical frequency vs Qiskit probability.
 * 6-sigma bound on the sampling error of a Binomial(N, p) proportion,
 * with a small floor so zero-probability bins are still checked. */
function statTol(p, n = SHOTS) {
  const sigma = Math.sqrt((p * (1.0 - p)) / n);
  return Math.max(6 * sigma, 0.005);
}

function assertHistogramMatches(hist, qiskitProbs, label) {
  let total = 0;
  for (const count of hist.values()) total += count;
  strictEqual(total, SHOTS, `${label}: histogram counts sum to shots`);

  const size = qiskitProbs.length;
  for (let i = 0; i < size; i += 1) {
    const p = qiskitProbs[i];
    const freq = (hist.get(i) || 0) / SHOTS;
    const tol = statTol(p);
    ok(
      Math.abs(freq - p) < tol,
      `${label}: index ${i} empirical freq=${freq.toFixed(4)} ` +
        `vs qiskit p=${p.toFixed(4)} (tol=${tol.toFixed(4)})`,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Availability checks                                               */
/* ------------------------------------------------------------------ */

const pythonEnv = resolvePythonEnv({ packages: ['qiskit', 'numpy'] });
const pythonAvailable = pythonEnv !== null;
const python = pythonEnv?.python;

/* ------------------------------------------------------------------ */
/*  1. Always-run: structural & analytical Born-rule tests            */
/* ------------------------------------------------------------------ */

test('sampleHistogram returns a Map whose counts sum to shots', () => {
  const state = new StateVector(2);
  state.getRawRe()[0] = 0.5;
  state.getRawRe()[1] = 0.5;
  state.getRawRe()[2] = 0.5;
  state.getRawRe()[3] = 0.5;
  // normalize: each prob = 0.25
  const hist = sampleHistogram(state, 1000);
  ok(hist instanceof Map, 'returns a Map');
  let total = 0;
  for (const count of hist.values()) {
    ok(Number.isInteger(count), 'each count is an integer');
    total += count;
  }
  strictEqual(total, 1000, 'counts sum to shots');
  for (const key of hist.keys()) {
    ok(
      Number.isInteger(key) && key >= 0 && key < 4,
      `histogram key ${key} is a valid basis index`,
    );
  }
});

test('sampleHistogram does not mutate the source state', () => {
  const state = new StateVector(2);
  state.getRawRe()[0] = 1 / Math.sqrt(2);
  state.getRawRe()[1] = 1 / Math.sqrt(2);
  const beforeRe = Array.from(state.getRawRe());
  const beforeIm = Array.from(state.getRawIm());

  sampleHistogram(state, 10000);

  let reEqual = true;
  let imEqual = true;
  for (let i = 0; i < 4; i += 1) {
    if (state.getRe(i) !== beforeRe[i]) reEqual = false;
    if (state.getIm(i) !== beforeIm[i]) imEqual = false;
  }
  ok(reEqual, 're buffer unchanged after sampling');
  ok(imEqual, 'im buffer unchanged after sampling');
});

test('collapse mutates in place to a valid Born-distributed index', () => {
  const seen = new Set();
  for (let s = 0; s < 50; s += 1) {
    // Re-prepare |+> each trial so the Born distribution is sampled afresh.
    const state = new StateVector(1);
    state.getRawRe()[0] = 1 / Math.sqrt(2);
    state.getRawRe()[1] = 1 / Math.sqrt(2);

    const idx = collapse(state);
    ok(idx === 0 || idx === 1, `collapse index ${idx} must be 0 or 1`);
    seen.add(idx);
    // After collapse the state is a basis state; re-collapse yields same idx.
    strictEqual(collapse(state), idx, `re-collapse must return ${idx}`);
  }
  ok(seen.size === 2, `|+> collapse must produce both outcomes over 50 trials`);
});

test('collapse on a prob-1 basis state always yields that index', () => {
  for (const target of [0, 1, 2, 3]) {
    const state = new StateVector(2);
    for (let i = 0; i < 4; i += 1) {
      state.getRawRe()[i] = i === target ? 1.0 : 0.0;
      state.getRawIm()[i] = 0.0;
    }
    for (let s = 0; s < 20; s += 1) {
      strictEqual(collapse(state), target, `collapse must yield ${target}`);
      strictEqual(state.getRe(target), 1.0, `re[${target}] = 1 after collapse`);
      for (let i = 0; i < 4; i += 1) {
        if (i === target) continue;
        strictEqual(state.getRe(i), 0.0, `re[${i}] = 0 after collapse`);
        strictEqual(state.getIm(i), 0.0, `im[${i}] = 0 after collapse`);
      }
    }
  }
});

test('Born sampling of |+> matches analytical 50/50 within statistical tolerance', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = 1 / Math.sqrt(2);
  state.getRawRe()[1] = 1 / Math.sqrt(2);

  const hist = sampleHistogram(state, SHOTS);
  assertHistogramMatches(hist, [0.5, 0.5], '|+> Born sampling');
});

test('Born sampling of a non-uniform superposition matches analytical probs', () => {
  // amp = sqrt(0.7)|0> + sqrt(0.3)|1>
  const r0 = Math.sqrt(0.7);
  const r1 = Math.sqrt(0.3);
  const state = new StateVector(1);
  state.getRawRe()[0] = r0;
  state.getRawRe()[1] = r1;
  ok(Math.abs(state.normSquared() - 1.0) < 1e-12, 'state is normalized');

  const hist = sampleHistogram(state, SHOTS);
  assertHistogramMatches(hist, [0.7, 0.3], 'non-uniform superposition');
});

/* ------------------------------------------------------------------ */
/*  2. Qiskit reference (skipped when python3/Qiskit unavailable)     */
/* ------------------------------------------------------------------ */

if (!pythonAvailable) {
  test.todo('Measurement vs Qiskit (python3/Qiskit unavailable)');
} else {
  /* Bell state: H(0) -> CNOT(0->1) => probs [0.5, 0, 0, 0.5] */

  test('measurement: Bell state histogram matches Qiskit probabilities', () => {
    const circuit = makeCircuit(2, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const qiskitOut = runQiskit(circuitJson);
    strictEqual(qiskitOut.qubits, 2, 'qubit count');

    const sv = simqcEvaluate(circuitJson);
    const hist = sampleHistogram(sv, SHOTS);
    assertHistogramMatches(hist, qiskitOut.probabilities, 'Bell state');

    // Source state must be unmodified by sampling.
    for (let i = 0; i < 4; i += 1) {
      ok(
        Math.abs(sv.getRe(i) * sv.getRe(i) + sv.getIm(i) * sv.getIm(i) -
                 qiskitOut.probabilities[i]) < 1e-12,
        `Bell: source probability[${i}] unchanged`,
      );
    }
  });

  /* 3-qubit GHZ state => probs [0.5, 0, 0, 0, 0, 0, 0, 0.5] */

  test('measurement: GHZ state histogram matches Qiskit probabilities', () => {
    const circuit = makeCircuit(3, [
      [gate('H', 0)],
      [gate('CNOT', 1, { controls: [{ row: 0, on: true }] })],
      [gate('CNOT', 2, { controls: [{ row: 0, on: true }] })],
    ]);
    const circuitJson = JSON.stringify(circuit);
    const qiskitOut = runQiskit(circuitJson);
    strictEqual(qiskitOut.qubits, 3, 'qubit count');

    const sv = simqcEvaluate(circuitJson);
    const hist = sampleHistogram(sv, SHOTS);
    assertHistogramMatches(hist, qiskitOut.probabilities, 'GHZ state');
  });

  /* Random circuit n=3 */

  test('measurement: random circuit n=3 histogram matches Qiskit', () => {
    const singleQubitGates = ['H', 'X', 'Y', 'Z', 'S', 'T'];
    const rotationGates = ['Rx', 'Ry', 'Rz'];
    const n = 3;
    const numCols = 1 + (randUint32() % 4);
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
    strictEqual(qiskitOut.qubits, n, 'qubit count');

    const sv = simqcEvaluate(circuitJson);
    const hist = sampleHistogram(sv, SHOTS);
    assertHistogramMatches(hist, qiskitOut.probabilities, `random n=${n}`);
  });
}
