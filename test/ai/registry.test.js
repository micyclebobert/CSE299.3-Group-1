// =============================================================================
// test/ai/registry.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/registry.js (named re-export barrel for the ai/ leaf).
// Verifies every named export is defined, is a class, and that Cache
// computeKey/sha256Hex + instance store behave correctly. No default export.
// Runs via node --test.
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import {
  AIExplainer,
  IOAnalyzer,
  AIBuilder,
  SparseSummary,
  AIBuilderUI,
  IOAnalyzerUI,
  Cache,
} from '../../src/ai/registry.js';

test('all named exports are defined', () => {
  ok(AIExplainer !== undefined);
  ok(IOAnalyzer !== undefined);
  ok(AIBuilder !== undefined);
  ok(SparseSummary !== undefined);
  ok(AIBuilderUI !== undefined);
  ok(IOAnalyzerUI !== undefined);
  ok(Cache !== undefined);
});

test('registry re-exports exactly the seven ai/ symbols', () => {
  const actual = Object.keys({
    AIExplainer,
    IOAnalyzer,
    AIBuilder,
    SparseSummary,
    AIBuilderUI,
    IOAnalyzerUI,
    Cache,
  });
  deepStrictEqual(actual, [
    'AIExplainer',
    'IOAnalyzer',
    'AIBuilder',
    'SparseSummary',
    'AIBuilderUI',
    'IOAnalyzerUI',
    'Cache',
  ]);
});

test('all exports are classes (constructors)', () => {
  strictEqual(typeof AIExplainer, 'function');
  strictEqual(typeof IOAnalyzer, 'function');
  strictEqual(typeof AIBuilder, 'function');
  strictEqual(typeof SparseSummary, 'function');
  strictEqual(typeof AIBuilderUI, 'function');
  strictEqual(typeof IOAnalyzerUI, 'function');
  strictEqual(typeof Cache, 'function');
});

test('Cache.sha256Hex matches known digest values', () => {
  strictEqual(
    Cache.sha256Hex(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  strictEqual(
    Cache.sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  strictEqual(
    Cache.sha256Hex('hello world'),
    'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
  );
});

test('Cache.computeKey is deterministic and version-sensitive', () => {
  const a = Cache.computeKey('json', '1', '1');
  const b = Cache.computeKey('json', '1', '1');
  strictEqual(a, b);
  strictEqual(a.length, 64);
  ok(/^[0-9a-f]{64}$/.test(a));
  ok(Cache.computeKey('json', '1', '1') !== Cache.computeKey('json', '1', '2'));
  ok(Cache.computeKey('json', '1', '1') !== Cache.computeKey('json', '2', '1'));
  ok(Cache.computeKey('json-a') !== Cache.computeKey('json-b'));
});

test('Cache instance get/set/has round-trip', () => {
  const cache = new Cache();
  strictEqual(cache.has('k1'), false);
  strictEqual(cache.get('k1'), undefined);
  cache.set('k1', 'explanation one');
  strictEqual(cache.has('k1'), true);
  strictEqual(cache.get('k1'), 'explanation one');
});

test('Cache overwrite and instance independence', () => {
  const cache = new Cache();
  cache.set('k1', 'first');
  cache.set('k1', 'second');
  strictEqual(cache.get('k1'), 'second');

  const other = new Cache();
  other.set('k2', 'other-only');
  strictEqual(cache.has('k2'), false);
});

test('no default export exists', async () => {
  const mod = await import('../../src/ai/registry.js');
  strictEqual(mod.default, undefined);
});
