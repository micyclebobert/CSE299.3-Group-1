// test/algorithms/grover.test.js
// -----------------------------------------------------------------------------
// Mirrors src/algorithms/grover.js 1:1 per CONVENTIONS.md #224
// Verifies Grover's search circuit builder: validation, circuit shape, and
// peak amplification probability against theory.
// Peak probability tolerance (n <= 8): <= 1e-12 per CONVENTIONS.md #226.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import { grover } from '../../src/algorithms/grover.js';
import { flattenCircuit } from '../../src/circuit/Flatten.js';
import { scheduleColumns } from '../../src/circuit/Flatten.js';
import { evaluate } from '../../src/sim/Evaluator.js';
import { Gate } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';

// Seed the GateRegistry so evaluate() can resolve gate IDs.
import '../../src/main.js';

const TOL = 1e-12;

function approx(a, b, tol = TOL) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

function run(circuit) {
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return evaluate(schedule, circuit.numQubits);
}

// ---- Oracle builders -------------------------------------------------------

// Phase oracle marking |11> (index 3): CZ applies phase -1 when q0=1&q1=1.
function mark11Gates() {
  return [
    new Gate({ name: 'CZ', target: 1, controls: [{ row: 0, on: true }] }),
  ];
}

// Diffusion operator for n=2: H^2 X^2 CZ X^2 H^2 = 2|0><0| - I (up to global phase).
function diffusion2Gates() {
  return [
    new Gate({ name: 'H', target: 0 }),
    new Gate({ name: 'H', target: 1 }),
    new Gate({ name: 'X', target: 0 }),
    new Gate({ name: 'X', target: 1 }),
    new Gate({ name: 'CZ', target: 1, controls: [{ row: 0, on: true }] }),
    new Gate({ name: 'X', target: 0 }),
    new Gate({ name: 'X', target: 1 }),
    new Gate({ name: 'H', target: 0 }),
    new Gate({ name: 'H', target: 1 }),
  ];
}

// Phase oracle marking |111> (index 7): CCZ = H·Toffoli·H gives phase -1 on |111>.
function mark111Gates() {
  return [
    new Gate({ name: 'H', target: 2 }),
    new Gate({ name: 'Toffoli', target: 2, controls: [{ row: 0, on: true }, { row: 1, on: true }] }),
    new Gate({ name: 'H', target: 2 }),
  ];
}

// Diffusion operator for n=3: H^3 X^3 CCZ X^3 H^3.
function diffusion3Gates() {
  return [
    new Gate({ name: 'H', target: 0 }),
    new Gate({ name: 'H', target: 1 }),
    new Gate({ name: 'H', target: 2 }),
    new Gate({ name: 'X', target: 0 }),
    new Gate({ name: 'X', target: 1 }),
    new Gate({ name: 'X', target: 2 }),
    new Gate({ name: 'H', target: 2 }),
    new Gate({ name: 'Toffoli', target: 2, controls: [{ row: 0, on: true }, { row: 1, on: true }] }),
    new Gate({ name: 'H', target: 2 }),
    new Gate({ name: 'X', target: 0 }),
    new Gate({ name: 'X', target: 1 }),
    new Gate({ name: 'X', target: 2 }),
    new Gate({ name: 'H', target: 0 }),
    new Gate({ name: 'H', target: 1 }),
    new Gate({ name: 'H', target: 2 }),
  ];
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test('grover throws on invalid n', () => {
  throws(() => grover(0, [], [], 1), TypeError);
  throws(() => grover(-3, [], [], 1), TypeError);
  throws(() => grover(2.5, [], [], 1), TypeError);
  throws(() => grover('x', [], [], 1), TypeError);
});

test('grover throws on invalid oracleGates', () => {
  throws(() => grover(2, null, [], 1), TypeError);
  throws(() => grover(2, [null], [], 1), TypeError);
  throws(() => grover(2, [{ name: 'H', target: 0 }], [], 1), TypeError);
});

test('grover throws on invalid diffusionGates', () => {
  throws(() => grover(2, [], null, 1), TypeError);
  throws(() => grover(2, [], ['nope'], 1), TypeError);
});

test('grover throws on invalid iterations', () => {
  throws(() => grover(2, [], [], -1), TypeError);
  throws(() => grover(2, [], [], 2.5), TypeError);
  throws(() => grover(2, [], [], 'x'), TypeError);
});

// ---------------------------------------------------------------------------
// Circuit shape
// ---------------------------------------------------------------------------

test('grover returns a Circuit with numQubits = n', () => {
  const circuit = grover(2, mark11Gates(), diffusion2Gates(), 1);
  ok(circuit instanceof Circuit, 'grover should return a Circuit');
  strictEqual(circuit.numQubits, 2);
  ok(circuit.columns.length > 0, 'circuit has at least one column');
});

test('grover first column applies H to every row', () => {
  const circuit = grover(3, mark111Gates(), diffusion3Gates(), 1);
  const firstCol = circuit.columns[0];
  strictEqual(firstCol.gates.length, 3);
  for (let q = 0; q < 3; q++) {
    strictEqual(firstCol.gates[q].name, 'H');
    strictEqual(firstCol.gates[q].target, q);
  }
});

test('grover alternates oracle then diffusion for each iteration', () => {
  const circuit = grover(2, mark11Gates(), diffusion2Gates(), 2);
  // init(1) + 2 iterations * (oracle 1 col + diffusion 5 cols)
  strictEqual(circuit.columns.length, 1 + 2 * (1 + 5), 'expected column count for n=2, 2 iterations');
});

// ---------------------------------------------------------------------------
// Peak amplification vs theory
// ---------------------------------------------------------------------------

// Grover n=2 marking |11>: one iteration drives |11> to probability 1.
test('Grover n=2 marking |11>: peak probability at |11> is 1 after 1 iteration', () => {
  const circuit = grover(2, mark11Gates(), diffusion2Gates(), 1);
  const state = run(circuit);
  approx(state.probability(3), 1.0);
  ok(state.probability(0) <= 1e-9);
  ok(state.probability(1) <= 1e-9);
  ok(state.probability(2) <= 1e-9);
  ok(Math.abs(state.normSquared() - 1.0) <= 1e-9);
});

// Grover n=3 marking |111>: two iterations concentrate on |111>.
test('Grover n=3 marking |111>: peak probability at |111> dominates after 2 iterations', () => {
  const circuit = grover(3, mark111Gates(), diffusion3Gates(), 2);
  const state = run(circuit);
  ok(state.getRe(7) ** 2 + state.getIm(7) ** 2 > 0.9, `peak at |111> should dominate, got ${state.getRe(7) ** 2 + state.getIm(7) ** 2}`);
});

// Grover with zero iterations is just the uniform superposition.
test('Grover with 0 iterations yields uniform superposition', () => {
  const circuit = grover(2, mark11Gates(), diffusion2Gates(), 0);
  const state = run(circuit);
  const norm = 1 / Math.sqrt(4);
  for (let i = 0; i < 4; i++) {
    approx(state.getRe(i), norm);
    strictEqual(state.getIm(i), 0);
  }
  ok(Math.abs(state.normSquared() - 1.0) <= 1e-9);
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test('evaluate is bit-deterministic across repeated grover runs', () => {
  const circuit = grover(3, mark111Gates(), diffusion3Gates(), 2);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const a = evaluate(schedule, circuit.numQubits);
  const b = evaluate(schedule, circuit.numQubits);
  const size = 1 << circuit.numQubits;
  const ra = a.getRawRe();
  const ia = a.getRawIm();
  const rb = b.getRawRe();
  const ib = b.getRawIm();
  for (let i = 0; i < size; i++) {
    ok(Object.is(ra[i], rb[i]), `re[${i}] not bit-identical across runs`);
    ok(Object.is(ia[i], ib[i]), `im[${i}] not bit-identical across runs`);
  }
});
