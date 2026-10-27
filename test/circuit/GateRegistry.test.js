// =============================================================================
// test/circuit/GateRegistry.test.js
// -----------------------------------------------------------------------------
// Mirrors src/circuit/GateRegistry.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
import {
  registerFixedGate,
  registerParameterizedGate,
  seal,
  getGate,
  getFixedGate,
  getParameterizedGate,
  listGates,
} from '../../src/circuit/GateRegistry.js';

// Use a fresh module state per test by re-registering known gates.
function setup() {
  registerFixedGate('H', [1, 0, 0, 0, 0, 0, 1, 0]);
  registerFixedGate('X', [0, 0, 1, 0, 1, 0, 0, 0]);
  registerParameterizedGate('Rx', (theta) => [1, 0, 0, 0, 0, 0, 1, 0]);
}

test('getGate returns registered fixed gate', () => {
  setup();
  const flat = getGate('H');
  ok(Array.isArray(flat));
  strictEqual(flat.length, 8);
});

test('getGate returns parameterized gate with theta', () => {
  setup();
  const flat = getGate('Rx', 0.5);
  ok(Array.isArray(flat));
  strictEqual(flat.length, 8);
});

test('getGate throws when parameterized gate lacks theta', () => {
  setup();
  throws(() => getGate('Rx'), /requires a rotation angle/);
});

test('getGate returns undefined for unknown gate', () => {
  setup();
  strictEqual(getGate('Nope'), undefined);
});

test('getFixedGate returns registered gate', () => {
  setup();
  const flat = getFixedGate('X');
  strictEqual(flat[2], 1);
  strictEqual(flat[4], 1);
});

test('getParameterizedGate returns constructor', () => {
  setup();
  const fn = getParameterizedGate('Rx');
  strictEqual(typeof fn, 'function');
});

test('listGates returns all registered names', () => {
  setup();
  const names = listGates();
  ok(names.includes('H'));
  ok(names.includes('X'));
  ok(names.includes('Rx'));
});

test('seal prevents further registration', () => {
  setup();
  seal();
  throws(() => registerFixedGate('Y', [1, 0, 0, 0, 0, 0, 1, 0]));
  throws(() => registerParameterizedGate('Ry', () => []));
});
