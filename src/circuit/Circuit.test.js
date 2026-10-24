// Circuit.test.js - Tests for Circuit class
// Mirrors src/circuit/Circuit.js 1:1 per CONVENTIONS.md #224
import { test } from 'node:test';
import { strictEqual } from 'assert';
import { Circuit } from './Circuit.js';
import { Gate, GateColumn } from './GateColumn.js';

test('Circuit constructor creates circuit with valid numQubits and columns', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  strictEqual(circuit.numQubits, 2);
  strictEqual(circuit.columns.length, 1);
});

test('Circuit constructor throws on invalid numQubits (non-integer', () => {
  let threw = false;
  try { new Circuit({ numQubits: 1.5, columns: [] }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Circuit constructor throws on invalid numQubits (zero)', () => {
  let threw = false;
  try { new Circuit({ numQubits: 0, columns: [] }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Circuit constructor throws on invalid numQubits (negative)', () => {
  let threw = false;
  try { new Circuit({ numQubits: -1, columns: [] }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Circuit constructor throws on non-array columns', () => {
  let threw = false;
  try { new Circuit({ numQubits: 2, columns: 'invalid' }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Circuit constructor throws when column is not a GateColumn instance', () => {
  let threw = false;
  try { new Circuit({ numQubits: 2, columns: [{}] }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Circuit numQubits getter returns stored value', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] });
  const circuit = new Circuit({ numQubits: 3, columns: [column] });
  strictEqual(circuit.numQubits, 3);
});

test('Circuit columns getter returns stored columns', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  strictEqual(circuit.columns.length, 1);
});

test('Circuit isEqualTo returns true for identical circuits', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit1 = new Circuit({ numQubits: 2, columns: [column] });
  const circuit2 = new Circuit({ numQubits: 2, columns: [column] });
  strictEqual(circuit1.isEqualTo(circuit2), true);
});

test('Circuit isEqualTo returns false when numQubits differs', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit1 = new Circuit({ numQubits: 2, columns: [column] });
  const circuit2 = new Circuit({ numQubits: 3, columns: [column] });
  strictEqual(circuit1.isEqualTo(circuit2), false);
});

test('Circuit isEqualTo returns false when columns length differs', () => {
  const column1 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const column2 = new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] });
  const circuit1 = new Circuit({ numQubits: 2, columns: [column1] });
  const circuit2 = new Circuit({ numQubits: 2, columns: [column2] });
  strictEqual(circuit1.isEqualTo(circuit2), false);
});

test('Circuit isEqualTo returns false when not a Circuit instance', () => {
  const circuit = new Circuit({ numQubits: 2, columns: [] });
  strictEqual(circuit.isEqualTo('not a circuit'), false);
  strictEqual(circuit.isEqualTo(null), false);
  strictEqual(circuit.isEqualTo(undefined), false);
});