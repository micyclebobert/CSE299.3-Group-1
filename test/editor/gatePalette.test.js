// gatePalette.test.js - Tests for the categorized gate catalog
// Mirrors src/editor/gatePalette.js 1:1 per CONVENTIONS.md #224
import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual, throws } from 'assert';
import {
  CATEGORY_CORE,
  CATEGORY_EXTENSIONS,
  CATEGORY_SUBCIRCUITS,
  GATE_CATALOG,
  gateCatalog,
  gatesByCategory,
  categoryNames,
  findGate,
  isParameterized,
} from '../../src/editor/gatePalette.js';

test('category constants are the expected strings', () => {
  strictEqual(CATEGORY_CORE, 'Core');
  strictEqual(CATEGORY_EXTENSIONS, 'Extensions');
  strictEqual(CATEGORY_SUBCIRCUITS, 'Subcircuits');
});

test('GATE_CATALOG is a frozen array of gate entries', () => {
  ok(Array.isArray(GATE_CATALOG));
  ok(GATE_CATALOG.length > 0);
  let frozen = true;
  try { GATE_CATALOG.push({ name: 'X', label: 'X', category: 'Core', parameterized: false }); }
  catch { frozen = false; }
  strictEqual(frozen, false);
});

test('every gate entry has name, label, category, parameterized', () => {
  for (const entry of GATE_CATALOG) {
    ok(typeof entry.name === 'string' && entry.name.length > 0);
    ok(typeof entry.label === 'string' && entry.label.length > 0);
    ok(typeof entry.category === 'string' && entry.category.length > 0);
    ok(typeof entry.parameterized === 'boolean');
    if (entry.parameterized) {
      ok(typeof entry.defaultTheta === 'number');
    }
  }
});

test('gateCatalog returns the same frozen array as GATE_CATALOG', () => {
  strictEqual(gateCatalog(), GATE_CATALOG);
});

test('Core category contains I, X, Y, Z, H, S, T (all fixed, non-parameterized)', () => {
  const core = GATE_CATALOG.filter((e) => e.category === CATEGORY_CORE);
  const names = core.map((e) => e.name).sort();
  deepStrictEqual(names, ['H', 'I', 'S', 'T', 'X', 'Y', 'Z']);
  for (const entry of core) {
    strictEqual(entry.parameterized, false);
  }
});

test('Extensions category contains Rx, Ry, Rz, Cu1 (all parameterized)', () => {
  const ext = GATE_CATALOG.filter((e) => e.category === CATEGORY_EXTENSIONS);
  const names = ext.map((e) => e.name).sort();
  deepStrictEqual(names, ['Cu1', 'Rx', 'Ry', 'Rz']);
  for (const entry of ext) {
    strictEqual(entry.parameterized, true);
    strictEqual(entry.defaultTheta, Math.PI / 2);
  }
});

test('Subcircuits category is empty (planned, not yet implemented)', () => {
  const sub = GATE_CATALOG.filter((e) => e.category === CATEGORY_SUBCIRCUITS);
  deepStrictEqual(sub, []);
});

test('categoryNames returns all categories present in the catalog', () => {
  deepStrictEqual(categoryNames(), [CATEGORY_CORE, CATEGORY_EXTENSIONS]);
});

test('gatesByCategory groups entries by category', () => {
  const byCat = gatesByCategory();
  ok(byCat instanceof Map);
  strictEqual(byCat.get(CATEGORY_CORE).length, 7);
  strictEqual(byCat.get(CATEGORY_EXTENSIONS).length, 4);
  strictEqual(byCat.get(CATEGORY_SUBCIRCUITS), undefined);
});

test('findGate returns the entry for a registered name', () => {
  const h = findGate('H');
  ok(h !== null);
  strictEqual(h.name, 'H');
  strictEqual(h.category, CATEGORY_CORE);
  strictEqual(h.parameterized, false);
  const rx = findGate('Rx');
  ok(rx !== null);
  strictEqual(rx.defaultTheta, Math.PI / 2);
});

test('findGate returns null for an unknown gate name', () => {
  strictEqual(findGate('CNOT'), null);
  strictEqual(findGate('Nope'), null);
});

test('isParameterized returns true for rotation gates, false for fixed gates', () => {
  strictEqual(isParameterized('Rx'), true);
  strictEqual(isParameterized('Ry'), true);
  strictEqual(isParameterized('Rz'), true);
  strictEqual(isParameterized('Cu1'), true);
  strictEqual(isParameterized('H'), false);
  strictEqual(isParameterized('X'), false);
  strictEqual(isParameterized('Nope'), false);
});
