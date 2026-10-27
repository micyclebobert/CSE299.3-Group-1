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
