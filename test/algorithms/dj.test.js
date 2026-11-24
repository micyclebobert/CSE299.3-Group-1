// test/algorithms/dj.test.js
// -----------------------------------------------------------------------------
// Mirrors src/algorithms/dj.js 1:1 per CONVENTIONS.md #224
// Verifies the Deutsch–Jozsa circuit builder: validation, circuit shape, and
// algorithmic behavior (constant vs balanced oracle) against theory.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import { deutschJozsa } from '../../src/algorithms/dj.js';
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

// Constant oracle f(x) = 0: identity (no oracle gates).
function constantZeroGates() {
  return [];
}

// Constant oracle f(x) = 1: X on ancilla (global phase kickback only).
function constantOneGates() {
  return [new Gate({ name: 'X', target: 1 })];
}

// Balanced oracle f(x) = x: CNOT(control=input row 0, target=ancilla row 1).
function balancedGates() {
  return [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })];
}

// ---- Validation ------------------------------------------------------------

test('deutschJozsa throws on invalid n', () => {
  throws(() => deutschJozsa(0, []), TypeError);
  throws(() => deutschJozsa(-1, []), TypeError);
  throws(() => deutschJozsa(2.5, []), TypeError);
  throws(() => deutschJozsa('x', []), TypeError);
});

test('deutschJozsa throws on invalid oracleGates', () => {
  throws(() => deutschJozsa(1, null), TypeError);
  throws(() => deutschJozsa(1, [null]), TypeError);
});

// ---- Circuit shape ---------------------------------------------------------

test('deutschJozsa returns a Circuit with numQubits = n + 1', () => {
  const circuit = deutschJozsa(1, constantZeroGates());
  ok(circuit instanceof Circuit);
  strictEqual(circuit.numQubits, 2);
});

test('deutschJozsa column structure for n=1', () => {
  const circuit = deutschJozsa(1, balancedGates());
  // columns: [H(0)], [X(1)], [H(1)], [CNOT], [H(0)]
  strictEqual(circuit.columns.length, 5);

  const c0 = circuit.columns[0];
  strictEqual(c0.gates.length, 1);
  strictEqual(c0.gates[0].name, 'H');
  strictEqual(c0.gates[0].target, 0);

  const c1 = circuit.columns[1];
  strictEqual(c1.gates.length, 1);
  strictEqual(c1.gates[0].name, 'X');
  strictEqual(c1.gates[0].target, 1);

  const c2 = circuit.columns[2];
  strictEqual(c2.gates.length, 1);
  strictEqual(c2.gates[0].name, 'H');
  strictEqual(c2.gates[0].target, 1);

  const c3 = circuit.columns[3];
  strictEqual(c3.gates.length, 1);
  strictEqual(c3.gates[0].name, 'CNOT');
  strictEqual(c3.gates[0].target, 1);
  strictEqual(c3.gates[0].controls[0].row, 0);
  strictEqual(c3.gates[0].controls[0].on, true);

  const c4 = circuit.columns[4];
  strictEqual(c4.gates.length, 1);
  strictEqual(c4.gates[0].name, 'H');
  strictEqual(c4.gates[0].target, 0);
});

test('deutschJozsa constant oracle column 3 is empty', () => {
  const circuit = deutschJozsa(1, constantZeroGates());
  strictEqual(circuit.columns.length, 5);
  strictEqual(circuit.columns[3].gates.length, 0);
});

// ---- Algorithm behavior ----------------------------------------------------

// q0=0 input indices: 0 (|00>_LE), 2 (|01>_LE)
// q0=1 input indices: 1 (|10>_LE), 3 (|11>_LE)

test('DJ n=1 constant oracle f=0: input qubit measures |0>', () => {
  const circuit = deutschJozsa(1, constantZeroGates());
  const state = run(circuit);
  const pInput0 = state.probability(0) + state.probability(2);
  const pInput1 = state.probability(1) + state.probability(3);
  approx(pInput0, 1.0);
  approx(pInput1, 0.0);
  ok(Math.abs(state.normSquared() - 1.0) <= 1e-9);
});

test('DJ n=1 constant oracle f=1: input qubit measures |0>', () => {
  const circuit = deutschJozsa(1, constantOneGates());
  const state = run(circuit);
  const pInput0 = state.probability(0) + state.probability(2);
  const pInput1 = state.probability(1) + state.probability(3);
  approx(pInput0, 1.0);
  approx(pInput1, 0.0);
  ok(Math.abs(state.normSquared() - 1.0) <= 1e-9);
});

test('DJ n=1 balanced oracle f=x: input qubit measures |1>', () => {
  const circuit = deutschJozsa(1, balancedGates());
  const state = run(circuit);
  const pInput0 = state.probability(0) + state.probability(2);
  const pInput1 = state.probability(1) + state.probability(3);
  approx(pInput0, 0.0);
  approx(pInput1, 1.0);
  ok(Math.abs(state.normSquared() - 1.0) <= 1e-9);
});

// ---- Determinism -----------------------------------------------------------

test('evaluate is bit-deterministic across repeated DJ runs', () => {
  const circuit = deutschJozsa(1, balancedGates());
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
