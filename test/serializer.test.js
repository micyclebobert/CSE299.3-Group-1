// =============================================================================
// test/serializer.test.js
// -----------------------------------------------------------------------------
// Member 4 — Sprint 2, Phase A tasks 5 & 6.
//
// Two test groups:
//   1. Round-trip property tests — for several hand-built circuits,
//      fromJson(toJson(c)).isEqualTo(c) must hold. Also verifies the byte-level
//      stability of toJson output (semantically-equal circuits -> identical
//      JSON strings, which matters for SHA-256 caching later).
//
//   2. Error-path tests — malformed input must throw a clear SerializerError,
//      never silently produce a broken Circuit. Covers: empty string, invalid
//      JSON, missing format, wrong version, wrong bitOrder, non-integer
//      numQubits, non-array columns, non-array gate list inside a column,
//      missing gate name, negative target, non-integer target, controls with
//      wrong types, controls with extra keys, anti-control round-trip
//      (on: false must survive).
//
// Run with:  node --test test/serializer.test.js
// =============================================================================

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { toJson, fromJson, SerializerError } from '../src/circuit/Serializer.js';
import { Circuit } from '../src/circuit/Circuit.js';
import { Gate, GateColumn } from '../src/circuit/GateColumn.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Helpers — build circuits concisely.
// ---------------------------------------------------------------------------
function col(...gates) { return new GateColumn({ gates }); }
function g(name, target, controls) { return new Gate({ name, target, controls }); }

function bellCircuit() {
  return new Circuit({
    numQubits: 2,
    columns: [
      col(g('H', 0)),
      col(g('CNOT', 1, [{ row: 0, on: true }])),
    ],
  });
}

function ghzCircuit() {
  // 3-qubit GHZ: H on 0, then CNOT(0->1), then CNOT(1->2)
  return new Circuit({
    numQubits: 3,
    columns: [
      col(g('H', 0)),
      col(g('CNOT', 1, [{ row: 0, on: true }])),
      col(g('CNOT', 2, [{ row: 1, on: true }])),
    ],
  });
}

function toffoliCircuit() {
  return new Circuit({
    numQubits: 3,
    columns: [
      col(g('Toffoli', 2, [{ row: 0, on: true }, { row: 1, on: true }])),
    ],
  });
}

function antiControlCircuit() {
  // X on qubit 1, fires when qubit 0 is ZERO (anti-control)
  return new Circuit({
    numQubits: 2,
    columns: [
      col(g('X', 1, [{ row: 0, on: false }])),
    ],
  });
}

function mixedCircuit() {
  // A longer circuit with several gate types to stress the serializer.
  return new Circuit({
    numQubits: 4,
    columns: [
      col(g('H', 0), g('X', 1), g('Z', 2)),
      col(g('CNOT', 3, [{ row: 0, on: true }])),
      col(g('Toffoli', 2, [{ row: 0, on: true }, { row: 1, on: false }])),
      col(g('Y', 0)),
      col(), // empty column (zero gates) — legal, must round-trip
    ],
  });
}

// ---------------------------------------------------------------------------
// Group 1: Round-trip property tests
// ---------------------------------------------------------------------------
test('Serializer.toJson produces valid JSON with required header fields', () => {
  const json = toJson(bellCircuit());
  const parsed = JSON.parse(json); // throws if invalid
  assert.equal(parsed.format, 'simqc-circuit');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.bitOrder, 'little-endian');
  assert.equal(parsed.numQubits, 2);
  assert.ok(Array.isArray(parsed.columns));
  assert.equal(parsed.columns.length, 2);
});

test('Serializer.toJson emits exact key order: format, version, bitOrder, numQubits, columns', () => {
  const json = toJson(bellCircuit());
  const topKeys = Object.keys(JSON.parse(json));
  assert.deepEqual(topKeys, ['format', 'version', 'bitOrder', 'numQubits', 'columns']);
});

test('Serializer.toJson omits controls array when there are no controls', () => {
  const json = toJson(bellCircuit());
  const parsed = JSON.parse(json);
  // First column has just H, which has no controls.
  assert.ok(!('controls' in parsed.columns[0][0]));
  // Second column has CNOT with one control.
  assert.ok(Array.isArray(parsed.columns[1][0].controls));
  assert.equal(parsed.columns[1][0].controls.length, 1);
});

test('Serializer round-trip: Bell circuit', () => {
  const original = bellCircuit();
  const roundTripped = fromJson(toJson(original));
  assert.ok(roundTripped.isEqualTo(original),
    'Round-tripped Bell circuit must be structurally equal to original');
});

test('Serializer round-trip: 3-qubit GHZ circuit', () => {
  const original = ghzCircuit();
  const roundTripped = fromJson(toJson(original));
  assert.ok(roundTripped.isEqualTo(original));
});

test('Serializer round-trip: Toffoli (two controls)', () => {
  const original = toffoliCircuit();
  const roundTripped = fromJson(toJson(original));
  assert.ok(roundTripped.isEqualTo(original));
});

test('Serializer round-trip: anti-control (on: false) preserved verbatim', () => {
  const original = antiControlCircuit();
  const roundTripped = fromJson(toJson(original));
  assert.ok(roundTripped.isEqualTo(original));
  // Specifically verify the on:false survived, not silently converted to true
  // or dropped.
  const gate = roundTripped.columns[0].gates[0];
  assert.equal(gate.controls.length, 1);
  assert.equal(gate.controls[0].row, 0);
  assert.equal(gate.controls[0].on, false);
});

test('Serializer round-trip: mixed 4-qubit circuit with empty column', () => {
  const original = mixedCircuit();
  const roundTripped = fromJson(toJson(original));
  assert.ok(roundTripped.isEqualTo(original));
  // Empty column (zero gates) must survive — guards against silent skip.
  assert.equal(roundTripped.columns[4].gates.length, 0);
});

test('Serializer byte-stability: semantically equal circuits produce identical JSON', () => {
  // Two separately-constructed but structurally-equal circuits must produce
  // byte-identical JSON. This matters for SHA-256 caching later.
  const json1 = toJson(bellCircuit());
  const json2 = toJson(bellCircuit());
  assert.equal(json1, json2);
});

test('Serializer can parse the bell_state.json fixture', () => {
  const fixtureText = readFileSync(join(FIXTURES, 'bell_state.json'), 'utf8');
  const circuit = fromJson(fixtureText);
  assert.equal(circuit.numQubits, 2);
  assert.equal(circuit.columns.length, 2);
  // And the fixture, when re-serialized, must equal the original parsed circuit.
  const reSerialized = toJson(circuit);
  const reparsed = fromJson(reSerialized);
  assert.ok(reparsed.isEqualTo(circuit));
});

test('Serializer is an exact inverse: fromJson(toJson(c)) === c, repeated', () => {
  // Apply the round-trip three times; the result must remain stable.
  const c0 = mixedCircuit();
  const c1 = fromJson(toJson(c0));
  const c2 = fromJson(toJson(c1));
  const c3 = fromJson(toJson(c2));
  assert.ok(c1.isEqualTo(c0));
  assert.ok(c2.isEqualTo(c0));
  assert.ok(c3.isEqualTo(c0));
});

// ---------------------------------------------------------------------------
// Group 2: Error-path tests (Phase A task 6)
// ---------------------------------------------------------------------------
function assertThrowsSerializerError(fn, messageSubstring) {
  assert.throws(
    fn,
    (err) => {
      assert.ok(err instanceof SerializerError,
        `Expected SerializerError, got ${err && err.constructor && err.constructor.name}: ${err && err.message}`);
      if (messageSubstring) {
        assert.ok(err.message.includes(messageSubstring),
          `Expected error message to include "${messageSubstring}", got: ${err.message}`);
      }
      return true;
    },
  );
}

test('Serializer.fromJson throws SerializerError on empty string', () => {
  assertThrowsSerializerError(() => fromJson(''), 'empty string');
});

test('Serializer.fromJson throws SerializerError on non-string input', () => {
  assertThrowsSerializerError(() => fromJson(null), 'expects a string');
  assertThrowsSerializerError(() => fromJson(undefined), 'expects a string');
  assertThrowsSerializerError(() => fromJson(42), 'expects a string');
  assertThrowsSerializerError(() => fromJson({}), 'expects a string');
});

test('Serializer.fromJson throws SerializerError on malformed JSON', () => {
  assertThrowsSerializerError(() => fromJson('{ not json'), 'Invalid JSON');
  assertThrowsSerializerError(() => fromJson('}'), 'Invalid JSON');
  assertThrowsSerializerError(() => fromJson('[1,2,'), 'Invalid JSON');
});

test('Serializer.fromJson throws on top-level non-object JSON', () => {
  assertThrowsSerializerError(() => fromJson('42'), 'must be an object');
  assertThrowsSerializerError(() => fromJson('[]'), 'must be an object');
  assertThrowsSerializerError(() => fromJson('null'), 'must be an object');
  assertThrowsSerializerError(() => fromJson('"hello"'), 'must be an object');
});

test('Serializer.fromJson throws on missing format field', () => {
  const text = JSON.stringify({ version: 1, bitOrder: 'little-endian', numQubits: 1, columns: [] });
  assertThrowsSerializerError(() => fromJson(text), 'format');
});

test('Serializer.fromJson throws on wrong format value', () => {
  const text = JSON.stringify({
    format: 'something-else', version: 1, bitOrder: 'little-endian',
    numQubits: 1, columns: [],
  });
  assertThrowsSerializerError(() => fromJson(text), 'format');
});

test('Serializer.fromJson throws on wrong version', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 2, bitOrder: 'little-endian',
    numQubits: 1, columns: [],
  });
  assertThrowsSerializerError(() => fromJson(text), 'version');
});

test('Serializer.fromJson throws on missing or wrong bitOrder', () => {
  const noBit = JSON.stringify({
    format: 'simqc-circuit', version: 1, numQubits: 1, columns: [],
  });
  assertThrowsSerializerError(() => fromJson(noBit), 'bitOrder');

  const wrongBit = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'big-endian',
    numQubits: 1, columns: [],
  });
  assertThrowsSerializerError(() => fromJson(wrongBit), 'bitOrder');
});

test('Serializer.fromJson throws on non-integer or non-positive numQubits', () => {
  const cases = [
    ['numQubits', 0],
    ['numQubits', -1],
    ['numQubits', 2.5],
    ['numQubits', '2'],
    ['numQubits', null],
  ];
  for (const [, nq] of cases) {
    const text = JSON.stringify({
      format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
      numQubits: nq, columns: [],
    });
    assertThrowsSerializerError(() => fromJson(text), 'numQubits');
  }
});

test('Serializer.fromJson throws when columns is not an array', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 1, columns: 'not an array',
  });
  assertThrowsSerializerError(() => fromJson(text), 'columns');
});

test('Serializer.fromJson throws when a column entry is not an array', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 1, columns: [{ gate: 'H', target: 0 }],
  });
  assertThrowsSerializerError(() => fromJson(text), 'must be an array');
});

test('Serializer.fromJson throws on missing gate name', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 1, columns: [[{ target: 0 }]],
  });
  assertThrowsSerializerError(() => fromJson(text), 'gate');
});

test('Serializer.fromJson throws on negative target', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 1, columns: [[{ gate: 'X', target: -1 }]],
  });
  assertThrowsSerializerError(() => fromJson(text), 'target');
});

test('Serializer.fromJson throws on non-integer target', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 1, columns: [[{ gate: 'X', target: 1.5 }]],
  });
  assertThrowsSerializerError(() => fromJson(text), 'target');
});

test('Serializer.fromJson throws when controls is not an array', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 2,
    columns: [[{ gate: 'CNOT', target: 1, controls: 'not an array' }]],
  });
  assertThrowsSerializerError(() => fromJson(text), 'controls');
});

test('Serializer.fromJson throws on control with non-integer row', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 2,
    columns: [[{ gate: 'CNOT', target: 1, controls: [{ row: '0', on: true }] }]],
  });
  assertThrowsSerializerError(() => fromJson(text), 'row');
});

test('Serializer.fromJson throws on control with non-boolean on', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 2,
    columns: [[{ gate: 'CNOT', target: 1, controls: [{ row: 0, on: 1 }] }]],
  });
  assertThrowsSerializerError(() => fromJson(text), "'on'");
});

test('Serializer.fromJson throws on control with extra fields', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 2,
    columns: [[{ gate: 'CNOT', target: 1, controls: [{ row: 0, on: true, extra: 'oops' }] }]],
  });
  assertThrowsSerializerError(() => fromJson(text), 'unexpected field');
});

test('Serializer.fromJson throws on gate with extra top-level fields', () => {
  const text = JSON.stringify({
    format: 'simqc-circuit', version: 1, bitOrder: 'little-endian',
    numQubits: 1,
    columns: [[{ gate: 'H', target: 0, surprise: true }]],
  });
  assertThrowsSerializerError(() => fromJson(text), 'unexpected field');
});

test('Serializer.toJson throws on non-Circuit input', () => {
  assert.throws(
    () => toJson({}),
    (err) => err instanceof TypeError && /Circuit instance/.test(err.message),
  );
});

// ---------------------------------------------------------------------------
// Mutation check: if the Serializer silently broke (e.g. dropped controls),
// the round-trip equality test would still pass IF Gate.isEqualTo were also
// broken. This test independently verifies the controls content directly.
// ---------------------------------------------------------------------------
test('Mutation guard: round-trip preserves control array contents exactly', () => {
  const original = toffoliCircuit();
  const json = toJson(original);
  const parsed = JSON.parse(json);
  // Direct JSON inspection, bypassing isEqualTo.
  const gate = parsed.columns[0][0];
  assert.equal(gate.gate, 'Toffoli');
  assert.equal(gate.target, 2);
  assert.equal(gate.controls.length, 2);
  assert.deepEqual(gate.controls[0], { row: 0, on: true });
  assert.deepEqual(gate.controls[1], { row: 1, on: true });
  // And the key order within each control is row, on (not on, row).
  assert.deepEqual(Object.keys(gate.controls[0]), ['row', 'on']);
});
