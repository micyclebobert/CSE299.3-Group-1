// GateColumn.test.js - Tests for Gate and GateColumn classes
// Mirrors src/circuit/GateColumn.js 1:1 per CONVENTIONS.md #224
import { test } from 'node:test';
import { strictEqual } from 'assert';
import { Gate, GateColumn } from './GateColumn.js';

test('Gate constructor creates gate with valid name, target, controls', () => {
  const gate = new Gate({ name: 'H', target: 0 });
  strictEqual(gate.name, 'H');
  strictEqual(gate.target, 0);
  strictEqual(gate.controls.length, 0);
});

test('Gate constructor throws on empty name', () => {
  let threw = false;
  try { new Gate({ name: '', target: 0 }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Gate constructor throws on negative target', () => {
  let threw = false;
  try { new Gate({ name: 'H', target: -1 }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Gate constructor throws on non-array controls', () => {
  let threw = false;
  try { new Gate({ name: 'H', target: 0, controls: 'invalid' }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Gate constructor throws on invalid control row', () => {
  let threw = false;
  try { new Gate({ name: 'H', target: 0, controls: [{ row: -1, on: true }] }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Gate constructor throws on invalid control on (not boolean)', () => {
  let threw = false;
  try { new Gate({ name: 'H', target: 0, controls: [{ row: 0, on: 'yes' }] }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('Gate defensive copy: original controls array not reflected in gate', () => {
  const controls = [{ row: 0, on: true }];
  const gate = new Gate({ name: 'CNOT', target: 1, controls });
  // Modifying original should NOT affect gate's stored controls
  controls.push({ row: 1, on: false });
  strictEqual(gate.controls.length, 1);
  strictEqual(gate.controls[0].row, 0);
});

test('Gate name getter returns gate name', () => {
  const gate = new Gate({ name: 'X', target: 0 });
  strictEqual(gate.name, 'X');
});

test('Gate target getter returns gate target', () => {
  const gate = new Gate({ name: 'H', target: 5 });
  strictEqual(gate.target, 5);
});

test('Gate controls getter returns frozen controls array', () => {
  const gate = new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] });
  strictEqual(gate.controls.length, 1);
  strictEqual(gate.controls[0].row, 0);
  strictEqual(gate.controls[0].on, true);
});

test('Gate toDescriptor emits object without controls when empty', () => {
  const gate = new Gate({ name: 'H', target: 0 });
  const desc = gate.toDescriptor();
  strictEqual(desc.name, 'H');
  strictEqual(desc.target, 0);
  strictEqual('controls' in desc, false);
});

test('Gate toDescriptor emits object with controls when present', () => {
  const gate = new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] });
  const desc = gate.toDescriptor();
  strictEqual(desc.name, 'CNOT');
  strictEqual(desc.target, 1);
  strictEqual(desc.controls.length, 1);
  strictEqual(desc.controls[0].row, 0);
  strictEqual(desc.controls[0].on, true);
});

test('Gate isEqualTo returns true for identical gates', () => {
  const gate1 = new Gate({ name: 'H', target: 0 });
  const gate2 = new Gate({ name: 'H', target: 0 });
  strictEqual(gate1.isEqualTo(gate2), true);
});

test('Gate isEqualTo returns false when name differs', () => {
  const gate1 = new Gate({ name: 'H', target: 0 });
  const gate2 = new Gate({ name: 'X', target: 0 });
  strictEqual(gate1.isEqualTo(gate2), false);
});

test('Gate isEqualTo returns false when target differs', () => {
  const gate1 = new Gate({ name: 'H', target: 0 });
  const gate2 = new Gate({ name: 'H', target: 1 });
  strictEqual(gate1.isEqualTo(gate2), false);
});

test('Gate isEqualTo returns false when controls differ', () => {
  const gate1 = new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] });
  const gate2 = new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: false }] });
  strictEqual(gate1.isEqualTo(gate2), false);
});

test('Gate isEqualTo returns false when controls length differs', () => {
  const gate1 = new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] });
  const gate2 = new Gate({ name: 'CNOT', target: 1 });
  strictEqual(gate1.isEqualTo(gate2), false);
});

test('Gate isEqualTo returns false when not a Gate instance', () => {
  const gate = new Gate({ name: 'H', target: 0 });
  strictEqual(gate.isEqualTo('not a gate'), false);
  strictEqual(gate.isEqualTo(null), false);
});

test('GateColumn constructor creates gate column with valid gates', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  strictEqual(column.gates.length, 1);
});

test('GateColumn constructor throws when gates is not an array', () => {
  let threw = false;
  try { new GateColumn({ gates: 'invalid' }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('GateColumn constructor throws when gate is not a Gate instance', () => {
  let threw = false;
  try { new GateColumn({ gates: [{ name: 'H', target: 0 }] }); }
  catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('GateColumn gates getter returns stored gates', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] });
  strictEqual(column.gates.length, 1);
});

test('GateColumn isEqualTo returns true for identical gate columns', () => {
  const column1 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const column2 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  strictEqual(column1.isEqualTo(column2), true);
});

test('GateColumn isEqualTo returns false when gates length differs', () => {
  const column1 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const column2 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 }), new Gate({ name: 'X', target: 1 })] });
  strictEqual(column1.isEqualTo(column2), false);
});

test('GateColumn isEqualTo returns false when gates differ', () => {
  const column1 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const column2 = new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] });
  strictEqual(column1.isEqualTo(column2), false);
});

test('GateColumn isEqualTo returns false when not a GateColumn instance', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  strictEqual(column.isEqualTo('not a column'), false);
  strictEqual(column.isEqualTo(null), false);
});