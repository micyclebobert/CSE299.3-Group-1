// =============================================================================
// test/circuit/Flatten.test.js
// -----------------------------------------------------------------------------
// Mirrors src/circuit/Flatten.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { Flatten, flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';

test('Flatten class exists and wraps flattenCircuit', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 1, columns: [column] });
  const instrs = Flatten.flattenCircuit(circuit);
  strictEqual(instrs.length, 1);
  strictEqual(instrs[0].gateId, 'H');
});

test('flattenCircuit emits instructions in column order', () => {
  const c1 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const c2 = new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] });
  const circuit = new Circuit({ numQubits: 1, columns: [c1, c2] });
  const instrs = flattenCircuit(circuit);
  strictEqual(instrs.length, 2);
  strictEqual(instrs[0].virtualColumn, 0);
  strictEqual(instrs[1].virtualColumn, 1);
  strictEqual(instrs[0].column, 0);
  strictEqual(instrs[1].column, 1);
});

test('scheduleColumns groups by virtualColumn', () => {
  const instrs = [
    { gateId: 'H', target: 0, controls: [], thetaRad: undefined, column: 0, virtualColumn: 0, subcircuit: undefined },
    { gateId: 'X', target: 0, controls: [], thetaRad: undefined, column: 0, virtualColumn: 0, subcircuit: undefined },
    { gateId: 'H', target: 1, controls: [], thetaRad: undefined, column: 1, virtualColumn: 1, subcircuit: undefined },
  ];
  const cols = scheduleColumns(instrs);
  strictEqual(cols.length, 2);
  strictEqual(cols[0].virtualColumn, 0);
  strictEqual(cols[0].instructions.length, 2);
  strictEqual(cols[1].virtualColumn, 1);
  strictEqual(cols[1].instructions.length, 1);
});

test('scheduleColumns sorts ascending by virtualColumn', () => {
  const instrs = [
    { gateId: 'H', target: 0, controls: [], thetaRad: undefined, column: 0, virtualColumn: 2, subcircuit: undefined },
    { gateId: 'X', target: 0, controls: [], thetaRad: undefined, column: 0, virtualColumn: 0, subcircuit: undefined },
  ];
  const cols = scheduleColumns(instrs);
  strictEqual(cols[0].virtualColumn, 0);
  strictEqual(cols[1].virtualColumn, 2);
});

test('scheduleColumns throws on invalid virtualColumn', () => {
  let threw = false;
  try {
    scheduleColumns([{ gateId: 'H', target: 0, controls: [], thetaRad: undefined, column: 0, virtualColumn: NaN, subcircuit: undefined }]);
  } catch { threw = true; }
  strictEqual(threw, true);
});
