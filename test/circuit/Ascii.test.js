// =============================================================================
// test/circuit/Ascii.test.js
// -----------------------------------------------------------------------------
// Mirrors src/circuit/Ascii.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { Ascii, parseAscii } from '../../src/circuit/Ascii.js';

test('Ascii class exists and wraps parseAscii', () => {
  const diagram = 'H\n-';
  const circuit = Ascii.parseAscii(diagram);
  strictEqual(circuit.numQubits, 2);
  strictEqual(circuit.columns.length, 1);
});

test('parseAscii parses H-X diagram', () => {
  const diagram = 'H-X\n--.-';
  const circuit = parseAscii(diagram);
  strictEqual(circuit.numQubits, 2);
  strictEqual(circuit.columns.length, 2);
});

test('parseAscii throws on non-string', () => {
  let threw = false;
  try { parseAscii(123); } catch { threw = true; }
  strictEqual(threw, true);
});

test('parseAscii empty row still yields circuit', () => {
  const circuit = parseAscii('  \n  ');
  strictEqual(circuit.numQubits, 2);
  strictEqual(circuit.columns.length, 0);
});

test('parseAscii attaches control dots to gate on different row', () => {
  const diagram = '.X\nX-';
  const circuit = parseAscii(diagram);
  strictEqual(circuit.columns.length, 2);
  const col0 = circuit.columns[0].gates[0];
  strictEqual(col0.name, 'X');
  strictEqual(col0.target, 1);
  strictEqual(col0.controls.length, 1);
  strictEqual(col0.controls[0].row, 0);
  strictEqual(col0.controls[0].on, true);
});

test('parseAscii skips vertical control line (|)', () => {
  const diagram = 'X|-|-\n-|-X';
  const circuit = parseAscii(diagram);
  strictEqual(circuit.numQubits, 2);
  strictEqual(circuit.columns.length, 2);
  strictEqual(circuit.columns[0].gates[0].name, 'X');
  strictEqual(circuit.columns[0].gates[0].target, 0);
  strictEqual(circuit.columns[1].gates[0].name, 'X');
  strictEqual(circuit.columns[1].gates[0].target, 1);
});

test('parseAscii recognizes single-letter gate labels case-insensitively', () => {
  const diagram = 'x-\n-h';
  const circuit = parseAscii(diagram);
  strictEqual(circuit.columns.length, 2);
  strictEqual(circuit.columns[0].gates[0].name, 'X');
  strictEqual(circuit.columns[0].gates[0].target, 0);
  strictEqual(circuit.columns[1].gates[0].name, 'H');
  strictEqual(circuit.columns[1].gates[0].target, 1);
});
