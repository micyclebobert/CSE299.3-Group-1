// test/cross-validation/serializer-roundtrip.test.js
// -----------------------------------------------------------------------------
// M3 — Serializer v1 JSON round-trip integrity.
//
// For each fixture: Circuit → Serializer.toJson() → Serializer.fromJson()
// → Circuit.isEqualTo(original) must be true.
//
// Also verifies:
//   - Key order stable: serialized JSON keys appear in canonical order
//     (gate, target, target2?, thetaRad?, controls?).
//   - No unexpected fields: only allowed fields appear in output.
//
// Covers: with/without controls, anti-controls, parameterized gates,
// SWAP target2, multi-qubit circuits, nested column structures.
//
// Skips gracefully (test marked todo) if python3 or Qiskit unavailable
// is NOT applicable here — this test runs purely in Node.js.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok, deepEqual, throws } from 'assert';
import { readFileSync, readdirSync } from 'fs';
import { fromJson, toJson } from '../../src/circuit/Serializer.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { GateColumn } from '../../src/circuit/GateColumn.js';
import { Gate } from '../../src/circuit/GateColumn.js';

const FIXTURE_DIR = new URL('./fixtures', import.meta.url).pathname;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function collectFixtures() {
  const fixtures = [];
  const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const path = new URL(file, FIXTURE_DIR).pathname;
    let content;
    try {
      content = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue; // skip unparseable fixtures
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.format === 'simqc-circuit') {
          fixtures.push({ source: file, circuit: item });
        }
      }
    } else if (parsed && parsed.format === 'simqc-circuit') {
      fixtures.push({ source: file, circuit: parsed });
    }
  }

  return fixtures;
}

/**
 * Recursively check that a plain JS object has keys in canonical order
 * and no unexpected fields.
 *
 * Canonical key order for gate descriptor: gate, target, target2?, thetaRad?, controls?
 * Canonical key order for control descriptor: row, on
 * Canonical key order for top-level document: format, version, bitOrder, numQubits, columns
 *
 * @param {any} value
 * @param {string} path - dot-separated path for error messages
 * @returns {void}
 */
function assertKeyOrder(value, path = '') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertKeyOrder(value[i], `${path}[${i}]`);
    }
    return;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);

    // Determine expected key order based on object shape.
    let expected;
    if (keys.includes('format') && keys.includes('version')) {
      // Top-level circuit document.
      expected = ['format', 'version', 'bitOrder', 'numQubits', 'columns'];
    } else if (keys.includes('gate')) {
      // Gate descriptor.
      expected = ['gate', 'target'];
      if (keys.includes('target2')) expected.push('target2');
      if (keys.includes('thetaRad')) expected.push('thetaRad');
      if (keys.includes('controls')) expected.push('controls');
    } else if (keys.includes('row') && keys.includes('on')) {
      // Control descriptor.
      expected = ['row', 'on'];
    } else {
      // Unknown object — reject unexpected fields at top level only.
      if (path === '') {
        ok(false, `Unexpected top-level fields: ${keys.join(', ')}`);
      }
      return;
    }

    // Check no unexpected fields.
    const expectedSet = new Set(expected);
    for (const k of keys) {
      ok(
        expectedSet.has(k),
        `${path}: unexpected field '${k}' (expected only ${expected.join(', ')})`,
      );
    }

    // Check key order.
    const expectedKeys = keys.filter((k) => expectedSet.has(k));
    const expectedOrder = expected.filter((k) => keys.includes(k));
    deepEqual(
      expectedKeys,
      expectedOrder,
      `${path}: key order mismatch, got [${keys.join(', ')}]`,
    );

    // Recurse into nested objects/arrays.
    for (const k of keys) {
      assertKeyOrder(value[k], `${path}.${k}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

const fixtures = collectFixtures();

test('serializer: round-trip integrity across all M1 fixtures', async (t) => {
  for (const { source, circuit } of fixtures) {
    await t.test(`${source}[${circuit.numQubits}q]`, () => {
      const circuitJson = JSON.stringify(circuit);

      // Parse → serialize → parse again.
      const parsed1 = fromJson(circuitJson);
      const roundTripJson = toJson(parsed1);
      const parsed2 = fromJson(roundTripJson);

      // Structural equality must hold after round-trip.
      ok(
        parsed2.isEqualTo(parsed1),
        `${source}: round-trip Circuit.isEqualTo failed`,
      );

      // Key order stable and no unexpected fields.
      const roundTripDoc = JSON.parse(roundTripJson);
      assertKeyOrder(roundTripDoc);
    });
  }
});

test('serializer: toJson output has canonical key order', () => {
  // Build a circuit exercising every gate field type.
  const circuit = new Circuit({
    numQubits: 3,
    columns: [
      new GateColumn({
        gates: [
          new Gate({ name: 'H', target: 0 }),
          new Gate({ name: 'X', target: 1 }),
          new Gate({ name: 'Y', target: 2 }),
        ],
      }),
      new GateColumn({
        gates: [
          new Gate({
            name: 'CNOT',
            target: 1,
            controls: [{ row: 0, on: true }],
          }),
          new Gate({
            name: 'X',
            target: 2,
            controls: [{ row: 0, on: false }], // anti-control
          }),
        ],
      }),
      new GateColumn({
        gates: [
          new Gate({
            name: 'Rx',
            target: 0,
            thetaRad: 0.5,
          }),
          new Gate({
            name: 'Cu1',
            target: 2,
            controls: [{ row: 1, on: true }],
            thetaRad: 1.0,
          }),
        ],
      }),
      new GateColumn({
        gates: [
          new Gate({ name: 'SWAP', target: 0, target2: 2 }),
        ],
      }),
    ],
  });

  const json = toJson(circuit);
  const doc = JSON.parse(json);

  // Top-level key order.
  deepEqual(
    Object.keys(doc),
    ['format', 'version', 'bitOrder', 'numQubits', 'columns'],
    'top-level key order',
  );

  // Each gate descriptor has canonical key order: gate, target, target2?,
  // thetaRad?, controls?
  for (let c = 0; c < doc.columns.length; c++) {
    for (let g = 0; g < doc.columns[c].length; g++) {
      const gateDesc = doc.columns[c][g];
      const keys = Object.keys(gateDesc);

      strictEqual(keys[0], 'gate', `column ${c} gate ${g}: first key`);
      strictEqual(keys[1], 'target', `column ${c} gate ${g}: second key`);

      // Each control descriptor has key order [row, on].
      if (gateDesc.controls) {
        for (let ctrlIdx = 0; ctrlIdx < gateDesc.controls.length; ctrlIdx++) {
          const ctrlKeys = Object.keys(gateDesc.controls[ctrlIdx]);
          deepEqual(
            ctrlKeys,
            ['row', 'on'],
            `column ${c} gate ${g} control ${ctrlIdx}: key order`,
          );
        }
      }
    }
  }

  // No unexpected fields at any level.
  assertKeyOrder(doc);
});

test('serializer: round-trip preserves anti-controls', () => {
  const circuit = new Circuit({
    numQubits: 2,
    columns: [
      new GateColumn({
        gates: [
          new Gate({
            name: 'X',
            target: 1,
            controls: [{ row: 0, on: false }],
          }),
        ],
      }),
    ],
  });

  const json = toJson(circuit);
  const parsed = fromJson(json);
  ok(parsed.isEqualTo(circuit), 'anti-control round-trip isEqualTo');

  const doc = JSON.parse(json);
  const gateDesc = doc.columns[0][0];
  strictEqual(gateDesc.controls.length, 1, 'one control');
  strictEqual(gateDesc.controls[0].row, 0, 'control row');
  strictEqual(gateDesc.controls[0].on, false, 'anti-control on=false');
});

test('serializer: round-trip preserves SWAP target2', () => {
  const circuit = new Circuit({
    numQubits: 3,
    columns: [
      new GateColumn({
        gates: [
          new Gate({ name: 'SWAP', target: 0, target2: 2 }),
        ],
      }),
    ],
  });

  const json = toJson(circuit);
  const parsed = fromJson(json);
  ok(parsed.isEqualTo(circuit), 'SWAP round-trip isEqualTo');

  const doc = JSON.parse(json);
  const gateDesc = doc.columns[0][0];
  strictEqual(gateDesc.target2, 2, 'target2 preserved');
});

test('serializer: round-trip preserves parameterized gates', () => {
  const circuit = new Circuit({
    numQubits: 2,
    columns: [
      new GateColumn({
        gates: [
          new Gate({ name: 'Rx', target: 0, thetaRad: 0.7 }),
          new Gate({ name: 'Ry', target: 1, thetaRad: -1.3 }),
          new Gate({ name: 'Rz', target: 0, thetaRad: 3.14 }),
          new Gate({
            name: 'Cu1',
            target: 1,
            controls: [{ row: 0, on: true }],
            thetaRad: 2.5,
          }),
        ],
      }),
    ],
  });

  const json = toJson(circuit);
  const parsed = fromJson(json);
  ok(parsed.isEqualTo(circuit), 'parameterized gates round-trip isEqualTo');

  const doc = JSON.parse(json);
  const gates = doc.columns[0];
  strictEqual(gates[0].thetaRad, 0.7, 'Rx thetaRad');
  strictEqual(gates[1].thetaRad, -1.3, 'Ry thetaRad');
  strictEqual(gates[2].thetaRad, 3.14, 'Rz thetaRad');
  strictEqual(gates[3].thetaRad, 2.5, 'Cu1 thetaRad');
});

test('serializer: fromJson rejects unexpected fields', () => {
  const badJson = JSON.stringify({
    format: 'simqc-circuit',
    version: 1,
    bitOrder: 'little-endian',
    numQubits: 2,
    columns: [
      [{ gate: 'H', target: 0, bogus: true }],
    ],
  });

  assert.throws(() => fromJson(badJson), /unexpected field/);
});

test('serializer: round-trip of manually constructed multi-qubit circuit', () => {
  const circuit = new Circuit({
    numQubits: 4,
    columns: [
      new GateColumn({
        gates: [
          new Gate({ name: 'H', target: 0 }),
          new Gate({ name: 'H', target: 1 }),
          new Gate({ name: 'H', target: 2 }),
          new Gate({ name: 'H', target: 3 }),
        ],
      }),
      new GateColumn({
        gates: [
          new Gate({
            name: 'CNOT',
            target: 1,
            controls: [{ row: 0, on: true }],
          }),
          new Gate({
            name: 'CNOT',
            target: 3,
            controls: [{ row: 2, on: true }],
          }),
        ],
      }),
      new GateColumn({
        gates: [
          new Gate({ name: 'SWAP', target: 0, target2: 3 }),
        ],
      }),
      new GateColumn({
        gates: [
          new Gate({
            name: 'Cu1',
            target: 3,
            controls: [{ row: 0, on: true }, { row: 1, on: true }],
            thetaRad: 0.5,
          }),
        ],
      }),
    ],
  });

  const json = toJson(circuit);
  const parsed1 = fromJson(json);
  const parsed2 = fromJson(toJson(parsed1));

  ok(parsed2.isEqualTo(parsed1), 'multi-qubit round-trip isEqualTo');
  ok(parsed2.isEqualTo(circuit), 'multi-qubit round-trip equals original');
});
