// Interaction.test.js - Tests for the drag-and-drop state machine
// Mirrors src/editor/Interaction.js 1:1 per CONVENTIONS.md #224
import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual, throws } from 'assert';
import {
  Interaction,
  PHASE_IDLE,
  PHASE_PICKED,
  PHASE_DRAGGING,
  snapCell,
} from '../../src/editor/Interaction.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';

const H_ENTRY = gateCatalog().find((e) => e.name === 'H');
const X_ENTRY = gateCatalog().find((e) => e.name === 'X');
const RX_ENTRY = gateCatalog().find((e) => e.name === 'Rx');

function emptyCircuit(numQubits = 2) {
  return new Circuit({ numQubits, columns: [] });
}

test('PHASE_* constants are the expected strings', () => {
  strictEqual(PHASE_IDLE, 'idle');
  strictEqual(PHASE_PICKED, 'picked');
  strictEqual(PHASE_DRAGGING, 'dragging');
});

test('snapCell maps screen coords to nearest column/row cell', () => {
  const cell = snapCell(37, 14, { colPitch: 20, rowPitch: 10, colOffset: 5, rowOffset: 3 });
  strictEqual(cell.column, Math.round((37 - 5) / 20));
  strictEqual(cell.row, Math.round((14 - 3) / 10));
  strictEqual(cell.x, 5 + cell.column * 20);
  strictEqual(cell.y, 3 + cell.row * 10);
});

test('snapCell throws on non-positive pitch', () => {
  throws(() => snapCell(0, 0, { colPitch: 0, rowPitch: 10 }));
  throws(() => snapCell(0, 0, { colPitch: 10, rowPitch: -1 }));
});

test('new Interaction starts idle with no gate entry', () => {
  const it = new Interaction();
  strictEqual(it.phase, PHASE_IDLE);
  strictEqual(it.gateEntry, null);
  deepStrictEqual(it.cell, { column: 0, row: 0, x: 0, y: 0 });
});

test('pick transitions idle -> picked and records gate entry + origin', () => {
  const it = new Interaction();
  it.pick(H_ENTRY, 100, 200);
  strictEqual(it.phase, PHASE_PICKED);
  strictEqual(it.gateEntry, H_ENTRY);
  deepStrictEqual(it.pointer, { x: 100, y: 200 });
});

test('pick while already picked throws', () => {
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  throws(() => it.pick(X_ENTRY, 10, 10));
  strictEqual(it.phase, PHASE_PICKED);
  strictEqual(it.gateEntry, H_ENTRY);
});

test('drag on idle interaction throws', () => {
  const it = new Interaction();
  throws(() => it.drag(10, 10));
});

test('drag transitions picked -> dragging and updates pointer', () => {
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.drag(55, 77);
  strictEqual(it.phase, PHASE_DRAGGING);
  deepStrictEqual(it.pointer, { x: 55, y: 77 });
});

test('snap on idle throws', () => {
  const it = new Interaction();
  throws(() => it.snap(10, 10, { colPitch: 20, rowPitch: 10 }));
});

test('snap records the snapped cell while dragging', () => {
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.drag(37, 14);
  const cell = it.snap(37, 14, { colPitch: 20, rowPitch: 10, colOffset: 5, rowOffset: 3 });
  strictEqual(it.phase, PHASE_DRAGGING);
  strictEqual(cell.column, Math.round((37 - 5) / 20));
  strictEqual(cell.row, Math.round((14 - 3) / 10));
});

test('cancel returns interaction to idle and clears gate entry', () => {
  const it = new Interaction();
  it.pick(H_ENTRY, 10, 10);
  it.drag(20, 20);
  it.cancel();
  strictEqual(it.phase, PHASE_IDLE);
  strictEqual(it.gateEntry, null);
  deepStrictEqual(it.cell, { column: 0, row: 0, x: 0, y: 0 });
});

test('drop with nothing picked returns conflict and null circuit', () => {
  const it = new Interaction();
  const result = it.drop(emptyCircuit(2), { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, true);
  strictEqual(result.circuit, null);
  strictEqual(it.phase, PHASE_IDLE);
});

test('drop places a gate on an empty circuit at column 0 row 0', () => {
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const circuit = emptyCircuit(2);
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  strictEqual(result.circuit !== null, true);
  strictEqual(result.circuit.numQubits, 2);
  strictEqual(result.circuit.columns.length, 1);
  strictEqual(result.circuit.columns[0].gates.length, 1);
  strictEqual(result.circuit.columns[0].gates[0].name, 'H');
  strictEqual(result.circuit.columns[0].gates[0].target, 0);
  strictEqual(it.phase, PHASE_IDLE);
});

test('drop appends to a new column when column index equals column count', () => {
  const col = new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [col] });
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(20, 0, { colPitch: 20, rowPitch: 10 }); // column 1 == column count 1 -> append
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  strictEqual(result.circuit.columns.length, 2);
  strictEqual(result.circuit.columns[1].gates[0].name, 'H');
  strictEqual(result.circuit.columns[1].gates[0].target, 0);
});

test('drop adds a gate to an existing column on a disjoint row', () => {
  const col = new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [col] });
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 }); // column 0, row 0 -> occupied
  let result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, true);
  strictEqual(result.circuit, null);
  strictEqual(result.reason, 'row occupied in column');

  // Same column, disjoint row (row 1) succeeds.
  it.pick(H_ENTRY, 0, 10);
  it.snap(0, 10, { colPitch: 20, rowPitch: 10 });
  result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  strictEqual(result.circuit.columns.length, 1);
  strictEqual(result.circuit.columns[0].gates.length, 2);
  const names = result.circuit.columns[0].gates.map((g) => g.name);
  deepStrictEqual(names.sort(), ['H', 'X']);
});

test('drop rejects negative column index', () => {
  const circuit = emptyCircuit(2);
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10, column: -1, row: 0 });
  strictEqual(result.conflict, true);
  strictEqual(result.circuit, null);
  strictEqual(result.reason, 'invalid column');
});

test('drop at column 2 on empty 2-qubit circuit creates 3 columns with gaps at 0 and 1', () => {
  const circuit = emptyCircuit(2);
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10, column: 2, row: 0 });
  strictEqual(result.conflict, false);
  strictEqual(result.circuit.columns.length, 3, 'three columns created');
  strictEqual(result.circuit.columns[0].gates.length, 0, 'column 0 is an empty gap');
  strictEqual(result.circuit.columns[1].gates.length, 0, 'column 1 is an empty gap');
  strictEqual(result.circuit.columns[2].gates.length, 1, 'column 2 holds the gate');
  strictEqual(result.circuit.columns[2].gates[0].name, 'H');
  strictEqual(result.circuit.columns[2].gates[0].target, 0);
  strictEqual(result.column, 2);
  strictEqual(result.row, 0);
});

test('drop at column 5 on empty circuit creates 6 columns with gaps', () => {
  const circuit = emptyCircuit(2);
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10, column: 5, row: 0 });
  strictEqual(result.conflict, false);
  strictEqual(result.circuit.columns.length, 6, 'six columns created');
  for (let i = 0; i < 5; i += 1) {
    strictEqual(result.circuit.columns[i].gates.length, 0, `column ${i} is an empty gap`);
  }
  strictEqual(result.circuit.columns[5].gates.length, 1, 'column 5 holds the gate');
  strictEqual(result.circuit.columns[5].gates[0].name, 'H');
  strictEqual(result.circuit.columns[5].gates[0].target, 0);
});

test('drop rejects out-of-range row index', () => {
  const circuit = emptyCircuit(2);
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(0, 100, { colPitch: 20, rowPitch: 10 }); // row 10 >= numQubits 2
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, true);
  strictEqual(result.circuit, null);
  strictEqual(result.reason, 'invalid row');
});

test('drop returns gate entry and column/row on success', () => {
  const circuit = emptyCircuit(3);
  const it = new Interaction();
  it.pick(RX_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  strictEqual(result.gateEntry, RX_ENTRY);
  strictEqual(result.column, 0);
  strictEqual(result.row, 0);
  strictEqual(result.circuit.columns[0].gates[0].thetaRad, RX_ENTRY.defaultTheta);
});

test('original circuit is not mutated by drop', () => {
  const circuit = emptyCircuit(2);
  const it = new Interaction();
  it.pick(H_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(circuit.columns.length, 0);
  strictEqual(result.circuit.columns.length, 1);
  strictEqual(result.circuit !== circuit, true);
});

const CNOT_ENTRY = gateCatalog().find((e) => e.name === 'CNOT');
const TOFFOLI_ENTRY = gateCatalog().find((e) => e.name === 'Toffoli');
const SWAP_ENTRY = gateCatalog().find((e) => e.name === 'SWAP');
const CU1_ENTRY = gateCatalog().find((e) => e.name === 'Cu1');

test('drop places CNOT with a control allocated from a free row', () => {
  const circuit = emptyCircuit(3);
  const it = new Interaction();
  it.pick(CNOT_ENTRY, 0, 10);
  it.snap(0, 10, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  strictEqual(result.circuit.columns.length, 1);
  strictEqual(result.circuit.columns[0].gates.length, 1);
  const gate = result.circuit.columns[0].gates[0];
  strictEqual(gate.name, 'CNOT');
  strictEqual(gate.target, 1);
  deepStrictEqual(gate.controls, [{ row: 0, on: true }]);
});

test('drop places Toffoli with two controls allocated from free rows', () => {
  const circuit = emptyCircuit(3);
  const it = new Interaction();
  it.pick(TOFFOLI_ENTRY, 0, 20);
  it.snap(0, 20, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  const gate = result.circuit.columns[0].gates[0];
  strictEqual(gate.name, 'Toffoli');
  strictEqual(gate.target, 2);
  deepStrictEqual(gate.controls, [{ row: 0, on: true }, { row: 1, on: true }]);
});

test('drop places SWAP with target2 allocated from a free row', () => {
  const circuit = emptyCircuit(2);
  const it = new Interaction();
  it.pick(SWAP_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  const gate = result.circuit.columns[0].gates[0];
  strictEqual(gate.name, 'SWAP');
  strictEqual(gate.target, 0);
  strictEqual(gate.target2, 1);
});

test('drop places parameterized Cu1 with defaultTheta as thetaRad and a control', () => {
  const circuit = emptyCircuit(2);
  const it = new Interaction();
  it.pick(CU1_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, false);
  const gate = result.circuit.columns[0].gates[0];
  strictEqual(gate.name, 'Cu1');
  strictEqual(gate.target, 0);
  deepStrictEqual(gate.controls, [{ row: 1, on: true }]);
  strictEqual(gate.thetaRad, CU1_ENTRY.defaultTheta);
});

test('drop conflicts when insufficient free rows for controls', () => {
  const col = new GateColumn({ gates: [new Gate({ name: 'X', target: 1 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [col] });
  const it = new Interaction();
  it.pick(CNOT_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, true);
  strictEqual(result.circuit, null);
  strictEqual(result.reason, 'insufficient free rows');
});

test('drop conflicts when insufficient free rows for SWAP target2', () => {
  const col = new GateColumn({ gates: [new Gate({ name: 'X', target: 1 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [col] });
  const it = new Interaction();
  it.pick(SWAP_ENTRY, 0, 0);
  it.snap(0, 0, { colPitch: 20, rowPitch: 10 });
  const result = it.drop(circuit, { colPitch: 20, rowPitch: 10 });
  strictEqual(result.conflict, true);
  strictEqual(result.circuit, null);
  strictEqual(result.reason, 'insufficient free rows');
});
