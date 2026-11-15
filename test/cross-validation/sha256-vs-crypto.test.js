// test/cross-validation/sha256-vs-crypto.test.js
// -----------------------------------------------------------------------------
// M1.1 — SHA-256 cross-validation vs Node.js built-in `crypto`.
//
// Compares Cache.sha256Hex(input) byte-for-byte against
// crypto.createHash('sha256').update(input).digest('hex') across:
//   - empty string
//   - single ASCII char
//   - deterministic random strings (lengths 0–2048)
//   - binary / non-BMP / surrogate-pair inputs
//   - real circuit JSON from Serializer.toJson
//   - cache-key format `${canonicalJson}|${schemaVersion}|${promptVersion}`
//
// Node `crypto` is built-in, so no external dependency and no skip logic.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok, notEqual } from 'assert';
import { createHash } from 'node:crypto';
import { Cache } from '../../src/ai/Cache.js';
import { Serializer } from '../../src/circuit/Serializer.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { Gate } from '../../src/circuit/GateColumn.js';
import { GateColumn } from '../../src/circuit/GateColumn.js';

const HEX = /^[0-9a-f]{64}$/;

/* ------------------------------------------------------------------ */
/*  Deterministic seeded PRNG (mulberry32)                            */
/* ------------------------------------------------------------------ */

let rngSeed = 0x243f6a88;
function randUint32() {
  rngSeed = (rngSeed + 0x9e3779b9) | 0;
  let z = rngSeed;
  z = (z ^ (z >>> 16)) >>> 0;
  z = Math.imul(z, 0x21f0aa8d) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !@#$%^&*()_+-=[]{}|;:,.<>?/';

function randomString(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randUint32() % ALPHABET.length];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Assertion helper                                                  */
/* ------------------------------------------------------------------ */

function assertMatches(input, label) {
  const expected = createHash('sha256').update(input, 'utf8').digest('hex');
  const actual = Cache.sha256Hex(input);
  strictEqual(actual.length, 64, `${label}: digest length`);
  strictEqual(actual, expected, `${label}: SHA-256 digest mismatch`);
  ok(HEX.test(actual), `${label}: lowercase hex`);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

test('sha256: empty string', () => {
  assertMatches('', 'empty string');
});

test('sha256: single ASCII char', () => {
  assertMatches('A', 'single ASCII char A');
  assertMatches('z', 'single ASCII char z');
  assertMatches(' ', 'single space');
});

test('sha256: deterministic random strings (lengths 0–2048)', () => {
  for (let trial = 0; trial < 60; trial += 1) {
    const length = randUint32() % 2049;
    assertMatches(randomString(length), `random string len=${length}`);
  }
});

test('sha256: binary / surrogate-pair inputs', () => {
  assertMatches(
    '\u00e9\u00fc\u00f1\u00e4\u00f6\u00e7\u00e0\u00e2\u00ea\u00ee',
    'latin-1 supplement code units',
  );
  assertMatches('\u{1F600}\u{1F680}\u{1F4A9}', 'non-BMP emoji');
  assertMatches(
    'na\u0303ve r\u00e9sum\u00e9 \u{1F642} end',
    'combining marks + non-BMP',
  );
  assertMatches('x'.repeat(55), '55 bytes (single 512-bit block)');
  assertMatches('x'.repeat(56), '56 bytes (padding boundary)');
  assertMatches('x'.repeat(64), '64 bytes (full block)');
  assertMatches('x'.repeat(65), '65 bytes (spans two blocks)');
});

test('sha256: real circuit JSON from Serializer.toJson', () => {
  const circuit = new Circuit({
    numQubits: 3,
    columns: [
      new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] }),
      new GateColumn({
        gates: [
          new Gate({
            name: 'CNOT',
            target: 1,
            controls: [{ row: 0, on: true }],
          }),
        ],
      }),
      new GateColumn({
        gates: [
          new Gate({ name: 'Rx', target: 2, thetaRad: 0.75 }),
          new Gate({ name: 'Z', target: 0 }),
        ],
      }),
    ],
  });
  const json = Serializer.toJson(circuit);
  strictEqual(typeof json, 'string');
  assertMatches(json, 'real circuit JSON');
});

test('sha256: cache-key format ${canonicalJson}|${schemaVersion}|${promptVersion}', () => {
  const circuit = new Circuit({
    numQubits: 2,
    columns: [new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] })],
  });
  const canonicalJson = Serializer.toJson(circuit);
  const schemaVersion = '1';
  const promptVersion = '1';

  const key = Cache.computeKey(canonicalJson, schemaVersion, promptVersion);
  const expected = createHash('sha256')
    .update(`${canonicalJson}|${schemaVersion}|${promptVersion}`, 'utf8')
    .digest('hex');
  strictEqual(key, expected, 'cache key matches crypto SHA-256');
  ok(HEX.test(key), 'cache key is lowercase hex');

  // Same inputs yield the same key (deterministic).
  strictEqual(
    Cache.computeKey(canonicalJson, schemaVersion, promptVersion),
    Cache.computeKey(canonicalJson, schemaVersion, promptVersion),
    'cache key is deterministic',
  );

  // Changing schema or prompt version changes the key.
  notEqual(
    Cache.computeKey(canonicalJson, '1', '1'),
    Cache.computeKey(canonicalJson, '1', '2'),
    'prompt version changes the key',
  );
  notEqual(
    Cache.computeKey(canonicalJson, '1', '1'),
    Cache.computeKey(canonicalJson, '2', '1'),
    'schema version changes the key',
  );
});
