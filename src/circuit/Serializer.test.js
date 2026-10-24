// Serializer.test.js - Tests for Serializer functions
// Mirrors src/circuit/Serializer.js 1:1 per CONVENTIONS.md #224
import { test } from 'node:test';
import { strictEqual } from 'assert';
import { toJson, fromJson, SerializerError } from './Serializer.js';
import { Circuit } from './Circuit.js';
import { Gate, GateColumn } from './GateColumn.js';

test('toJson produces valid JSON string from Circuit', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  const json = toJson(circuit);
  strictEqual(typeof json, 'string');
});

test('toJson produces canonical format with correct headers', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  const json = toJson(circuit);
  const parsed = JSON.parse(json);
  strictEqual(parsed.format, 'simqc-circuit');
  strictEqual(parsed.version, 1);
  strictEqual(parsed.bitOrder, 'little-endian');
  strictEqual(parsed.numQubits, 2);
  strictEqual(Array.isArray(parsed.columns), true);
});

test('toJson pretty-prints with 2-space indent', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  const json = toJson(circuit);
  const lines = json.split('\n');
  strictEqual(lines[1].startsWith('  '), true);
});

test('fromJson parses valid JSON back to Circuit', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  const json = toJson(circuit);
  const parsed = fromJson(json);
  strictEqual(parsed.isEqualTo(circuit), true);
});

test('fromJson throws on non-string input', () => {
  let threw1 = false, threw2 = false;
  try { fromJson(123); } catch (e) { threw1 = e instanceof SerializerError; }
  try { fromJson(null); } catch (e) { threw2 = e instanceof SerializerError; }
  strictEqual(threw1, true);
  strictEqual(threw2, true);
});

test('fromJson throws on empty string', () => {
  let threw = false;
  try { fromJson(''); } catch (e) { threw = e instanceof SerializerError; }
  strictEqual(threw, true);
});

test('fromJson throws on invalid format', () => {
  let threw = false;
  try { fromJson('{"format": "wrong", "version": 1, "bitOrder": "little-endian", "numQubits": 2, "columns": []}'); } catch (e) { threw = e instanceof SerializerError; }
  strictEqual(threw, true);
});

test('fromJson throws on invalid version', () => {
  let threw = false;
  try { fromJson('{"format": "simqc-circuit", "version": 2, "bitOrder": "little-endian", "numQubits": 2, "columns": []}'); } catch (e) { threw = e instanceof SerializerError; }
  strictEqual(threw, true);
});

test('fromJson throws on invalid bitOrder', () => {
  let threw = false;
  try { fromJson('{"format": "simqc-circuit", "version": 1, "bitOrder": "big-endian", "numQubits": 2, "columns": []}'); } catch (e) { threw = e instanceof SerializerError; }
  strictEqual(threw, true);
});

test('fromJson throws on invalid numQubits', () => {
  let threw1 = false, threw2 = false;
  try { fromJson('{"format": "simqc-circuit", "version": 1, "bitOrder": "little-endian", "numQubits": 0, "columns": []}'); } catch (e) { threw1 = e instanceof SerializerError; }
  try { fromJson('{"format": "simqc-circuit", "version": 1, "bitOrder": "little-endian", "numQubits": -1, "columns": []}'); } catch (e) { threw2 = e instanceof SerializerError; }
  strictEqual(threw1, true);
  strictEqual(threw2, true);
});

test('fromJson(toJson(circuit)).isEqualTo(circuit) for simple circuit', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  strictEqual(fromJson(toJson(circuit)).isEqualTo(circuit), true);
});

test('fromJson(toJson(circuit)).isEqualTo(circuit) with CNOT and controls', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  strictEqual(fromJson(toJson(circuit)).isEqualTo(circuit), true);
});

test('fromJson(toJson(circuit)).isEqualTo(circuit) with anti-control', () => {
  const column = new GateColumn({ gates: [new Gate({ name: 'X', target: 1, controls: [{ row: 0, on: false }] })] });
  const circuit = new Circuit({ numQubits: 2, columns: [column] });
  strictEqual(fromJson(toJson(circuit)).isEqualTo(circuit), true);
});

test('fromJson(toJson(circuit)).isEqualTo(circuit) with multiple columns', () => {
  const col1 = new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] });
  const col2 = new GateColumn({ gates: [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })] });
  const circuit = new Circuit({ numQubits: 2, columns: [col1, col2] });
  strictEqual(fromJson(toJson(circuit)).isEqualTo(circuit), true);
});

test('SerializerError is a proper Error subclass', () => {
  const err = new SerializerError('test error');
  strictEqual(err.name, 'SerializerError');
  strictEqual(err instanceof Error, true);
});