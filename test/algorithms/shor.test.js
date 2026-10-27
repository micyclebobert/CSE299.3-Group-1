// ============================================================================
// test/algorithms/shor.test.js
// -----------------------------------------------------------------------------
// Mirrors src/algorithms/shor.js 1:1 per CONVENTIONS.md #224
// Verifies Shor's order-finding circuit builder: classical helpers, circuit
// structure, and peak probability against theory.
//
// Peak probability tolerance (n > 8): <= 1e-9 per CONVENTIONS.md #226.
// ============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import {
  gcd,
  modExp,
  findOrder,
  shor,
} from '../../src/algorithms/shor.js';
import { flattenCircuit } from '../../src/circuit/Flatten.js';
import { scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';
import { Gate } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';

// Seed the GateRegistry so evaluate() can resolve gate IDs.
import '../../src/main.js';

const TOL = 1e-9;

// ---------------------------------------------------------------------------
// Classical number theory helpers
// ---------------------------------------------------------------------------

test('gcd computes greatest common divisor', () => {
  strictEqual(gcd(7, 15), 1);
  strictEqual(gcd(12, 18), 6);
  strictEqual(gcd(0, 5), 5);
  strictEqual(gcd(7, 0), 7);
  strictEqual(gcd(0, 0), 0);
});

test('gcd throws on invalid input', () => {
  throws(() => gcd(-1, 5), TypeError);
  throws(() => gcd(5, -3), TypeError);
  throws(() => gcd(2.5, 5), TypeError);
});

test('modExp computes base^exp mod N', () => {
  strictEqual(modExp(7, 4, 15), 1); // 7^4 = 2401 = 1 mod 15
  strictEqual(modExp(2, 10, 1000), 24);
  strictEqual(modExp(3, 0, 7), 1);
  strictEqual(modExp(0, 5, 7), 0);
});

test('modExp throws on invalid input', () => {
  throws(() => modExp(-1, 2, 5), TypeError);
  throws(() => modExp(2, -1, 5), TypeError);
  throws(() => modExp(2, 2, 0), TypeError);
});

test('findOrder returns multiplicative order', () => {
  strictEqual(findOrder(7, 15), 4); // 7^4 = 1 mod 15
  strictEqual(findOrder(11, 15), 2); // 11^2 = 1 mod 15
  strictEqual(findOrder(2, 15), 4); // 2^4 = 16 = 1 mod 15
});

test('findOrder returns null when gcd(a,N) != 1', () => {
  strictEqual(findOrder(3, 15), null);
  strictEqual(findOrder(5, 15), null);
  strictEqual(findOrder(6, 15), null);
});

test('findOrder throws on invalid input', () => {
  throws(() => findOrder(0, 15), TypeError);
  throws(() => findOrder(7, 1), TypeError);
});

// ---------------------------------------------------------------------------
// shor() input validation
// ---------------------------------------------------------------------------

test('shor throws on invalid N', () => {
  throws(() => shor(2, 1), TypeError);   // even
  throws(() => shor(1, 1), TypeError);   // < 3
  throws(() => shor(9, 1), TypeError);   // a <= 1
  throws(() => shor(9, 9), TypeError);   // a >= N
  throws(() => shor(9, 3), Error);       // gcd(3,9)=3
  throws(() => shor(2.5, 7), TypeError);
  throws(() => shor('x', 7), TypeError);
});

test('shor throws on invalid options.t', () => {
  throws(() => shor(15, 7, { t: 0 }), TypeError);
  throws(() => shor(15, 7, { t: -1 }), TypeError);
  throws(() => shor(15, 7, { t: 2.5 }), TypeError);
});

// ---------------------------------------------------------------------------
// Circuit structure
// ---------------------------------------------------------------------------

test('shor(15, 7) builds circuit with expected qubit count', () => {
  // t = 2*ceil(log2(15)) = 8, n = ceil(log2(15)) = 4
  // numQubits = t + n + 2 flags + (n-1) mcxAnc = 8 + 4 + 2 + 3 = 17
  const circuit = shor(15, 7);
  strictEqual(circuit.numQubits, 17);
  ok(circuit.columns.length > 0, 'circuit has at least one column');
});

test('shor initializes work register to |1> and applies H to count[0]', () => {
  const circuit = shor(15, 7, { t: 6 });
  const firstCol = circuit.columns[0];
  const xGate = firstCol.gates.find((g) => g.name === 'X');
  ok(xGate, 'first column contains an X gate');
  strictEqual(xGate.target, 6); // work[0] is row t = 6

  const hGate = circuit.columns.find((c) =>
    c.gates.some((g) => g.name === 'H' && g.target === 0),
  );
  ok(hGate, 'count[0] receives an H gate');
});

test('shor default t = 2*ceil(log2(N))', () => {
  const circuit = shor(15, 7);
  const n = Math.ceil(Math.log2(15)); // 4
  const expected = 2 * n + n + 2 + (n - 1); // t + work + flags + mcxAnc
  strictEqual(circuit.numQubits, expected);
});

// ---------------------------------------------------------------------------
// Peak probability vs theory
// ---------------------------------------------------------------------------

function runShor(N, a, t) {
  const circuit = shor(N, a, { t });
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

function countProbabilities(state, t, totalQubits) {
  const size = 1 << t;
  const probs = new Float64Array(size);
  const mask = size - 1;
  for (let i = 0; i < 1 << totalQubits; i++) {
    probs[i & mask] += state.getRe(i) ** 2 + state.getIm(i) ** 2;
  }
  return probs;
}

test('Shor(15, 7) peaks at multiples of 2^t/r = 64 (r=4)', () => {
  const t = 8;
  const state = runShor(15, 7, t);
  const probs = countProbabilities(state, t, 17);
  const peaks = [0, 64, 128, 192];
  let peakMass = 0;
  for (const p of peaks) peakMass += probs[p];
  ok(Math.abs(peakMass - 1.0) <= TOL, `peak mass should be 1, got ${peakMass}`);
  for (const p of peaks) {
    ok(Math.abs(probs[p] - 0.25) <= TOL, `peak at ${p} should be 0.25, got ${probs[p]}`);
  }
  // All non-peak values are ~0.
  let offPeakMass = 0;
  for (let v = 0; v < 256; v++) {
    if (!peaks.includes(v)) offPeakMass += probs[v];
  }
  ok(offPeakMass <= TOL, `off-peak mass should be 0, got ${offPeakMass}`);
});

test('Shor(15, 11) peaks at multiples of 2^t/r = 128 (r=2)', () => {
  const t = 8;
  const state = runShor(15, 11, t);
  const probs = countProbabilities(state, t, 17);
  const peaks = [0, 128];
  let peakMass = 0;
  for (const p of peaks) peakMass += probs[p];
  ok(Math.abs(peakMass - 1.0) <= TOL, `peak mass should be 1, got ${peakMass}`);
  for (const p of peaks) {
    ok(Math.abs(probs[p] - 0.5) <= TOL, `peak at ${p} should be 0.5, got ${probs[p]}`);
  }
});

test('Shor(15, 13) peaks at multiples of 64 (r=4)', () => {
  const t = 8;
  const state = runShor(15, 13, t);
  const probs = countProbabilities(state, t, 17);
  const peaks = [0, 64, 128, 192];
  let peakMass = 0;
  for (const p of peaks) peakMass += probs[p];
  ok(Math.abs(peakMass - 1.0) <= TOL, `peak mass should be 1, got ${peakMass}`);
  for (const p of peaks) {
    ok(Math.abs(probs[p] - 0.25) <= TOL, `peak at ${p} should be 0.25, got ${probs[p]}`);
  }
});

test('shor returns a Circuit instance', () => {
  const circuit = shor(15, 7);
  ok(circuit instanceof Circuit, 'shor should return a Circuit');
});
