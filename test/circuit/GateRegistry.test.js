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

// NOTE on test-order independence: `seal()` mutates module-level state and is
// called last in this file (see below). Every other test calls `setup()` at
// entry to re-register gates, so tests never depend on a sealed or unsealed
// registry persisting from a prior test. There is no `unseal()` — once sealed,
// the registry stays sealed for the process lifetime.

test('registerFixedGate throws on non-array flatTuple', () => {
  setup();
  let threw = false;
  try { registerFixedGate('Y', 'not-an-array'); } catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('registerFixedGate throws on wrong-length flatTuple', () => {
  setup();
  let threw = false;
  try { registerFixedGate('Y', [1, 0]); } catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('registerFixedGate accepts valid number[8] flatTuple', () => {
  setup();
  let threw = false;
  try { registerFixedGate('Y', [0, 0, 1, 0, 1, 0, 0, 0]); } catch { threw = true; }
  strictEqual(threw, false);
  strictEqual(getFixedGate('Y')[2], 1);
  strictEqual(getFixedGate('Y')[4], 1);
});

test('registerParameterizedGate throws on non-function', () => {
  setup();
  let threw = false;
  try { registerParameterizedGate('Ry', 'not-a-function'); } catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('registerParameterizedGate throws on object instead of function', () => {
  setup();
  let threw = false;
  try { registerParameterizedGate('Ry', { call: () => [] }); } catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('registerFixedGate throws on empty name', () => {
  setup();
  let threw = false;
  try { registerFixedGate('', [1, 0, 0, 0, 0, 0, 1, 0]); } catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('registerParameterizedGate throws on empty name', () => {
  setup();
  let threw = false;
  try { registerParameterizedGate('', () => []); } catch (e) { threw = e instanceof TypeError; }
  strictEqual(threw, true);
});

test('setup re-registers gates independent of prior seal() call order', () => {
  setup();
  strictEqual(getGate('H').length, 8);
  strictEqual(getGate('X').length, 8);
  strictEqual(typeof getParameterizedGate('Rx'), 'function');
  strictEqual(listGates().includes('H'), true);
  strictEqual(listGates().includes('Rx'), true);
});

test('seal prevents further registration', () => {
  setup();
  seal();
  throws(() => registerFixedGate('Y', [1, 0, 0, 0, 0, 0, 1, 0]));
  throws(() => registerParameterizedGate('Ry', () => []));
});
