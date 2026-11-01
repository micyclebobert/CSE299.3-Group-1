// =============================================================================
// test/sim/Evaluator.test.js
// -----------------------------------------------------------------------------
// Mirrors src/sim/Evaluator.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import { evaluate } from '../../src/sim/Evaluator.js';
import { flattenCircuit } from '../../src/circuit/Flatten.js';
import { scheduleColumns } from '../../src/circuit/Flatten.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { StateVector } from '../../src/core/StateVector.js';
import * as Kernel from '../../src/sim/kernel.js';

// Seed the GateRegistry so evaluate() can resolve gate IDs.
import '../../src/main.js';

const INV_SQRT2 = 1 / Math.sqrt(2);

function approx(a, b, tol = 1e-12) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

function circuitFromOps(ops, n) {
  const columns = ops.map(
    (op) =>
      new GateColumn({
        gates: [
          new Gate({
            name: op.gateId,
            target: op.target,
            controls: op.controls || [],
            thetaRad: op.theta,
          }),
        ],
      }),
  );
  return new Circuit({ numQubits: n, columns });
}

test('evaluate Bell state produces correct amplitudes', () => {
  const circuit = circuitFromOps(
    [
      { gateId: 'H', target: 0, controls: [] },
      { gateId: 'CNOT', target: 1, controls: [{ row: 0, on: true }] },
    ],
    2,
  );
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const state = evaluate(schedule, 2);
  approx(state.getRe(0), INV_SQRT2);
  strictEqual(state.getRe(1), 0);
  strictEqual(state.getRe(2), 0);
  approx(state.getRe(3), INV_SQRT2);
});

test('evaluate throws on unknown gate', () => {
  const circuit = circuitFromOps([{ gateId: 'Nope', target: 0, controls: [] }], 1);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  throws(() => evaluate(schedule, 1), /Unknown gate: Nope/);
});

test('evaluate CNOT(1->0) swaps {2,3} and {6,7} via full pipeline (n=3)', () => {
  // Prepare |010> = index 2 (little-endian: row1=1), then CNOT(1->0) swaps 2<->3.
  const circuit = circuitFromOps(
    [
      { gateId: 'X', target: 1, controls: [] },
      { gateId: 'CNOT', target: 0, controls: [{ row: 1, on: true }] },
    ],
    3,
  );
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const state = evaluate(schedule, 3);
  strictEqual(state.getRe(2), 0);
  strictEqual(state.getRe(3), 1);
  strictEqual(state.getRe(6), 0);
  strictEqual(state.getRe(7), 0);
});

test('evaluate preserves norm', () => {
  const circuit = circuitFromOps(
    [
      { gateId: 'H', target: 0, controls: [] },
      { gateId: 'H', target: 2, controls: [] },
      { gateId: 'CNOT', target: 3, controls: [{ row: 0, on: true }] },
      { gateId: 'X', target: 1, controls: [] },
      { gateId: 'Z', target: 4, controls: [] },
      { gateId: 'CZ', target: 2, controls: [{ row: 4, on: true }] },
      { gateId: 'H', target: 3, controls: [] },
    ],
    5,
  );
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const state = evaluate(schedule, 5);
  ok(Math.abs(state.normSquared() - 1.0) <= 1e-12);
});

test('evaluate throws on non-array schedule', () => {
  const circuit = circuitFromOps([{ gateId: 'H', target: 0 }], 2);
  const schedule = scheduleColumns(flattenCircuit(circuit));
  throws(() => evaluate('not a schedule', 2), TypeError);
  throws(() => evaluate(null, 2), TypeError);
  throws(() => evaluate({ length: 0 }, 2), TypeError);
  strictEqual(evaluate(schedule, 2) instanceof StateVector, true);
});

test('evaluate throws on invalid numQubits', () => {
  const circuit = circuitFromOps([{ gateId: 'H', target: 0 }], 2);
  const schedule = scheduleColumns(flattenCircuit(circuit));
  throws(() => evaluate(schedule, 0), /positive integer/);
  throws(() => evaluate(schedule, -1), /positive integer/);
  throws(() => evaluate(schedule, 2.5), /positive integer/);
});

test('evaluate Rx(pi/2) on |0> through pipeline', () => {
  const circuit = circuitFromOps([{ gateId: 'Rx', target: 0, theta: Math.PI / 2, controls: [] }], 1);
  const state = evaluate(scheduleColumns(flattenCircuit(circuit)), 1);
  approx(state.getRe(0), INV_SQRT2);
  strictEqual(state.getRe(1), 0);
  strictEqual(state.getIm(0), 0);
  approx(state.getIm(1), -INV_SQRT2);
});

test('evaluate Ry(pi/2) on |0> through pipeline', () => {
  const circuit = circuitFromOps([{ gateId: 'Ry', target: 0, theta: Math.PI / 2, controls: [] }], 1);
  const state = evaluate(scheduleColumns(flattenCircuit(circuit)), 1);
  approx(state.getRe(0), INV_SQRT2);
  approx(state.getRe(1), INV_SQRT2);
  strictEqual(state.getIm(0), 0);
  strictEqual(state.getIm(1), 0);
});

test('evaluate Rz(pi) on |0> gives -i phase through pipeline', () => {
  const circuit = circuitFromOps([{ gateId: 'Rz', target: 0, theta: Math.PI, controls: [] }], 1);
  const state = evaluate(scheduleColumns(flattenCircuit(circuit)), 1);
  approx(state.getRe(0), 0);
  approx(state.getIm(0), -1);
});

test('evaluate Cu1(pi/2) phases only |11> through pipeline', () => {
  const circuit = circuitFromOps(
    [
      { gateId: 'X', target: 0, controls: [] },
      { gateId: 'X', target: 1, controls: [] },
      { gateId: 'Cu1', target: 1, controls: [{ row: 0, on: true }], theta: Math.PI / 2 },
    ],
    2,
  );
  const state = evaluate(scheduleColumns(flattenCircuit(circuit)), 2);
  approx(state.getRe(3), 0);
  strictEqual(state.getIm(3), 1);
});

test('evaluate anti-control (on===false) leaves target bit-identical when control missed', () => {
  const circuit = circuitFromOps(
    [
      { gateId: 'X', target: 1, controls: [] },
      { gateId: 'X', target: 0, controls: [{ row: 1, on: false }] },
    ],
    2,
  );
  const state = evaluate(scheduleColumns(flattenCircuit(circuit)), 2);
  strictEqual(state.getRe(2), 1);
  strictEqual(state.getRe(0), 0);
  strictEqual(state.getRe(1), 0);
  strictEqual(state.getRe(3), 0);
});
