// =============================================================================
// test/sim/step-trace-apply.test.js
// -----------------------------------------------------------------------------
// Mirrors src/sim/step-trace-apply.js 1:1 per CONVENTIONS.md #224
// Column application: H then CNOT on 2 qubits.
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import { applyColumn } from '../../src/sim/step-trace-apply.js';
import { flattenCircuit } from '../../src/circuit/Flatten.js';
import { scheduleColumns } from '../../src/circuit/Flatten.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';

// Seed the GateRegistry so applyColumn can resolve gate IDs.
import '../../src/main.js';

const INV_SQRT2 = 1 / Math.sqrt(2);

function approx(a, b, tol = 1e-12) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

function bellSchedule(n = 2) {
  const columns = [
    new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] }),
    new GateColumn({ gates: [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })] }),
  ];
  const circuit = new Circuit({ numQubits: n, columns });
  const instructions = flattenCircuit(circuit);
  return scheduleColumns(instructions);
}

test('applyColumn H then CNOT builds the Bell state on 2 qubits', () => {
  const schedule = bellSchedule(2);
  const n = 2;
  const size = 1 << n;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re[0] = 1.0;

  applyColumn(re, im, n, schedule[0]);
  strictEqual(re[0], INV_SQRT2);
  strictEqual(re[1], INV_SQRT2);
  strictEqual(re[2], 0);
  strictEqual(re[3], 0);
  strictEqual(im[0], 0);
  strictEqual(im[1], 0);
  strictEqual(im[2], 0);
  strictEqual(im[3], 0);

  applyColumn(re, im, n, schedule[1]);
  approx(re[0], INV_SQRT2);
  approx(re[3], INV_SQRT2);
  strictEqual(re[1], 0);
  strictEqual(re[2], 0);
  strictEqual(im[0], 0);
  strictEqual(im[1], 0);
  strictEqual(im[2], 0);
  strictEqual(im[3], 0);
});

test('applyColumn unknown gate throws', () => {
  const n = 2;
  const size = 1 << n;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re[0] = 1.0;

  const badColumn = { instructions: [{ gateId: 'NoSuchGate', target: 0, controls: [] }] };
  throws(() => applyColumn(re, im, n, badColumn), Error);
});

test('applyColumn CNOT with wrong control count throws', () => {
  const re = new Float64Array(4);
  const im = new Float64Array(4);
  re[0] = 1.0;
  const badColumn = {
    instructions: [{ gateId: 'CNOT', target: 1, controls: [] }],
  };
  throws(() => applyColumn(re, im, 2, badColumn), Error);
});
