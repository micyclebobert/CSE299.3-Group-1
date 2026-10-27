// =============================================================================
// test/algorithms/qft.test.js
// -----------------------------------------------------------------------------
// Mirrors src/algorithms/qft.js 1:1 per CONVENTIONS.md #224
//
// Verifies the QFT circuit builder against src/sim/analytic.js qftState(n, k)
// within 1e-12 (n <= 8).
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import { qft } from '../../src/algorithms/qft.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';
import { StepTrace } from '../../src/sim/StepTrace.js';
import { qftState } from '../../src/sim/analytic.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';

// Seed the GateRegistry so evaluate() can resolve 'Cu1' and 'SWAP'.
import '../../src/main.js';

const TOL = 1e-12;

function approxEqual(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

function statesEqual(actual, expected, tol = TOL) {
  const size = expected.re.length;
  strictEqual(actual.size(), size);
  let normSq = 0;
  for (let i = 0; i < size; i++) {
    approxEqual(actual.getRe(i), expected.re[i], tol);
    approxEqual(actual.getIm(i), expected.im[i], tol);
    normSq += actual.getRe(i) ** 2 + actual.getIm(i) ** 2;
  }
  ok(Math.abs(normSq - 1.0) <= 1e-9, 'state must remain normalized');
}

/**
 * Build a circuit that prepares |k> (little-endian) then applies QFT(n).
 * X gates on the set bits of k share one column (disjoint rows).
 */
function qftOnK(n, k) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(`qftOnK expects a positive integer n`);
  }
  if (!Number.isInteger(k) || k < 0 || k >= 1 << n) {
    throw new RangeError(`k must be in [0, ${1 << n})`);
  }
  const columns = [];
  const xGates = [];
  for (let q = 0; q < n; q++) {
    if ((k >>> q) & 1) {
      xGates.push(new Gate({ name: 'X', target: q }));
    }
  }
  if (xGates.length > 0) {
    columns.push(new GateColumn({ gates: xGates }));
  }
  const qfc = qft(n);
  for (let c = 0; c < qfc.columns.length; c++) {
    columns.push(qfc.columns[c]);
  }
  return new Circuit({ numQubits: n, columns });
}

function run(circuit) {
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

// ---------------------------------------------------------------------------
// Circuit shape
// ---------------------------------------------------------------------------

test('qft(1) is a single Hadamard column', () => {
  const circuit = qft(1);
  strictEqual(circuit.numQubits, 1);
  strictEqual(circuit.columns.length, 1);
  strictEqual(circuit.columns[0].gates.length, 1);
  const gate = circuit.columns[0].gates[0];
  strictEqual(gate.name, 'H');
  strictEqual(gate.target, 0);
});

test('qft(2) column layout: H(1), Cu1(pi/2 c=0,t=1), H(0), SWAP(0,1)', () => {
  const circuit = qft(2);
  strictEqual(circuit.columns.length, 4);

  const g0 = circuit.columns[0].gates[0];
  strictEqual(g0.name, 'H');
  strictEqual(g0.target, 1);

  const g1 = circuit.columns[1].gates[0];
  strictEqual(g1.name, 'Cu1');
  strictEqual(g1.target, 1);
  strictEqual(g1.controls.length, 1);
  strictEqual(g1.controls[0].row, 0);
  strictEqual(g1.controls[0].on, true);
  approxEqual(g1.thetaRad, Math.PI / 2);

  const g2 = circuit.columns[2].gates[0];
  strictEqual(g2.name, 'H');
  strictEqual(g2.target, 0);

  const g3 = circuit.columns[3].gates[0];
  strictEqual(g3.name, 'SWAP');
  strictEqual(g3.target, 0);
  strictEqual(g3.target2, 1);
});

test('qft column count matches n + n(n-1)/2 + floor(n/2)', () => {
  for (let n = 1; n <= 6; n++) {
    const expected = n + (n * (n - 1)) / 2 + Math.floor(n / 2);
    strictEqual(qft(n).columns.length, expected, `n=${n}`);
  }
});

test('qft throws on invalid n', () => {
  throws(() => qft(0), TypeError);
  throws(() => qft(-3), TypeError);
  throws(() => qft(2.5), TypeError);
  throws(() => qft('x'), TypeError);
});

// ---------------------------------------------------------------------------
// QFT|0> is the uniform superposition = qftState(n, 0)
// ---------------------------------------------------------------------------

test('QFT|0> equals qftState(n, 0) for n = 1..5', () => {
  for (let n = 1; n <= 5; n++) {
    const state = run(qft(n));
    statesEqual(state, qftState(n, 0));
    const norm = 1 / Math.sqrt(1 << n);
    for (let i = 0; i < 1 << n; i++) {
      approxEqual(state.getRe(i), norm);
      strictEqual(state.getIm(i), 0);
    }
  }
});

// ---------------------------------------------------------------------------
// QFT|k> matches analytic phase expectations
// ---------------------------------------------------------------------------

test('QFT|k> matches qftState(n, k) across basis inputs (n = 3)', () => {
  for (let k of [0, 1, 2, 3, 5, 7]) {
    const state = run(qftOnK(3, k));
    statesEqual(state, qftState(3, k));
  }
});

test('QFT|k> matches qftState(n, k) for n = 4 and n = 5 (spot checks)', () => {
  const cases = [
    [4, 0],
    [4, 1],
    [4, 7],
    [4, 15],
    [5, 3],
    [5, 17],
    [5, 31],
  ];
  for (const [n, k] of cases) {
    const state = run(qftOnK(n, k));
    statesEqual(state, qftState(n, k));
  }
});

// ---------------------------------------------------------------------------
// StepTrace.verify against analytic expectation at the final step
// ---------------------------------------------------------------------------

test('StepTrace.verify confirms QFT|k> equals qftState(n, k) at final step', () => {
  for (let n of [1, 2, 3, 4]) {
    for (let k = 0; k < 1 << n; k++) {
      const circuit = qftOnK(n, k);
      const instructions = flattenCircuit(circuit);
      const schedule = scheduleColumns(instructions);
      const trace = new StepTrace(schedule, n);
      const finalStep = schedule.length;
      const result = trace.verify((step) => {
        if (step === finalStep) {
          return qftState(n, k);
        }
        return null;
      });
      ok(result.ok, `verify failed for n=${n} k=${k}: ${JSON.stringify(result.failures)}`);
    }
  }
});

test('qftOnK input validation', () => {
  throws(() => qftOnK(3, 8), RangeError);
  throws(() => qftOnK(3, -1), RangeError);
});
