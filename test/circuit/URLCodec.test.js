import { test } from 'node:test';
import { strictEqual } from 'assert';
import { encode, decode } from '../../src/circuit/URLCodec.js';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

test('encode returns URL-safe base64url without padding', () => {
  const json = '{"format":"simqc-circuit","version":1,"bitOrder":"little-endian","numQubits":2,"columns":[]}';
  const encoded = encode(json);
  strictEqual(/^[A-Za-z0-9-_]*$/.test(encoded), true);
  strictEqual(encoded.includes('='), false);
});

test('decode(encode(json)) round-trips canonical v1 JSON', () => {
  const json = '{"format":"simqc-circuit","version":1,"bitOrder":"little-endian","numQubits":2,"columns":[[{"gate":"H","target":0}],[{"gate":"CNOT","target":1,"controls":[{"row":0,"on":true}]}]]}';
  strictEqual(decode(encode(json)), json);
});

test('round-trip preserves parameterized gates and anti-controls', () => {
  const json = '{"format":"simqc-circuit","version":1,"bitOrder":"little-endian","numQubits":3,"columns":[[{"gate":"Rx","target":1,"thetaRad":1.5707963267948966}],[{"gate":"X","target":2,"controls":[{"row":0,"on":false},{"row":1,"on":true}]}]]}';
  strictEqual(decode(encode(json)), json);
});

test('round-trip is stable across repeated encode/decode cycles', () => {
  const json = '{"format":"simqc-circuit","version":1,"bitOrder":"little-endian","numQubits":5,"columns":[[{"gate":"H","target":0}],[{"gate":"H","target":2}],[{"gate":"CNOT","target":1,"controls":[{"row":0,"on":true}]}]]}';
  let encoded = encode(json);
  for (let i = 0; i < 10; i += 1) {
    encoded = encode(decode(encoded));
  }
  strictEqual(decode(encoded), json);
});

test('encode output is standard deflate-raw decodable by node zlib', () => {
  const json = '{"format":"simqc-circuit","version":1,"bitOrder":"little-endian","numQubits":5,"columns":[[{"gate":"H","target":0}],[{"gate":"CNOT","target":1,"controls":[{"row":0,"on":true}]}],[{"gate":"Rx","target":4,"thetaRad":0.5}]}]';
  const encoded = encode(json);
  const raw = Uint8Array.from(Buffer.from(encoded, 'base64url'));
  strictEqual(new TextDecoder().decode(inflateRawSync(raw)), json);
});

test('15-column 5-qubit circuit with repeated columns compresses below 160 characters', () => {
  const column = '[{"gate":"H","target":0}]';
  const json = '{"format":"simqc-circuit","version":1,"bitOrder":"little-endian","numQubits":5,"columns":[' + Array(15).fill(column).join(',') + ']}';
  const encoded = encode(json);
  strictEqual(decode(encoded), json);
  strictEqual(encoded.length < 160, true);
});

test('encode and decode throw on non-string input', () => {
  let threw1 = false;
  let threw2 = false;
  try { encode(123); } catch (e) { threw1 = e instanceof TypeError; }
  try { decode(null); } catch (e) { threw2 = e instanceof TypeError; }
  strictEqual(threw1, true);
  strictEqual(threw2, true);
});

test('decode throws on invalid base64url characters', () => {
  let threw = false;
  try { decode('not-valid!!'); } catch (e) { threw = true; }
  strictEqual(threw, true);
});

test('empty string round-trips', () => {
  strictEqual(decode(encode('')), '');
});
