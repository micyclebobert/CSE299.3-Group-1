// =============================================================================
// test/ai/Cache.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/Cache.js (pure JS SHA-256 + in-memory cache). No DOM,
// no network. Runs via node --test.
// =============================================================================

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Cache, sha256Hex } from '../../src/ai/Cache.js';

describe('Cache SHA-256', () => {
  it('matches known SHA-256 of empty string', () => {
    const key = sha256Hex('');
    assert.equal(key, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('matches known SHA-256 of "abc"', () => {
    const key = sha256Hex('abc');
    assert.equal(key, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches known SHA-256 of "hello world"', () => {
    const key = sha256Hex('hello world');
    assert.equal(key, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('cache key is deterministic and includes schema + prompt version', () => {
    const a = Cache.computeKey('json', '1', '1');
    const b = Cache.computeKey('json', '1', '1');
    assert.equal(a, b);
    assert.notEqual(Cache.computeKey('json', '1', '1'), Cache.computeKey('json', '1', '2'));
    assert.notEqual(Cache.computeKey('json', '1', '1'), Cache.computeKey('json', '2', '1'));
    assert.notEqual(Cache.computeKey('json-a'), Cache.computeKey('json-b'));
  });

  it('cache key is 64 lowercase hex chars', () => {
    const key = Cache.computeKey('anything');
    assert.equal(key.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(key));
  });
});

describe('Cache store', () => {
  it('set/get/has round-trip', () => {
    const cache = new Cache();
    assert.equal(cache.has('k1'), false);
    assert.equal(cache.get('k1'), undefined);
    cache.set('k1', 'explanation one');
    assert.equal(cache.has('k1'), true);
    assert.equal(cache.get('k1'), 'explanation one');
  });

  it('overwrite updates value', () => {
    const cache = new Cache();
    cache.set('k1', 'first');
    cache.set('k1', 'second');
    assert.equal(cache.get('k1'), 'second');
  });

  it('independent instances do not share state', () => {
    const a = new Cache();
    const b = new Cache();
    a.set('k1', 'a-only');
    assert.equal(b.has('k1'), false);
  });
});
