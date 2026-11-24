// =============================================================================
// test/ai/registry.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/registry.js (primary-export facade over ai/ leaf).
// Verifies the registry facade: get/list/has accessors, lazy loading of ai/
// modules, no default export, no barrel re-exports. No DOM, no network.
// Runs via node --test.
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { registry } from '../../src/ai/registry.js';

const AI_MODULES = [
  'AIExplainer',
  'IOAnalyzer',
  'AIBuilder',
  'SparseSummary',
  'AIBuilderUI',
  'IOAnalyzerUI',
  'Cache',
];

test('registry is defined and is an object', () => {
  ok(registry !== undefined);
  ok(typeof registry === 'object');
  ok(!Array.isArray(registry));
});

test('registry exposes get, list, has methods', () => {
  ok(typeof registry.get === 'function');
  ok(typeof registry.list === 'function');
  ok(typeof registry.has === 'function');
});

test('registry.list returns exactly the seven ai module names', () => {
  deepStrictEqual(registry.list(), AI_MODULES);
});

test('registry.has returns true for every known module', () => {
  for (const name of AI_MODULES) {
    ok(registry.has(name), `registry.has('${name}') should be true`);
  }
});

test('registry.has returns false for unknown modules', () => {
  ok(!registry.has('NonExistent'));
  ok(!registry.has(''));
  ok(!registry.has('CacheExtra'));
});

test('registry.get returns the Cache class for known module', async () => {
  const Cache = await registry.get('Cache');
  ok(Cache !== undefined, 'registry.get(Cache) should resolve to the Cache class');
  ok(typeof Cache === 'function', 'Cache should be a constructor');
});

test('registry.get returns undefined for unknown module', async () => {
  strictEqual(await registry.get('NonExistent'), undefined);
  strictEqual(await registry.get(''), undefined);
});

test('registry.get returns undefined for a deleted module name', async () => {
  strictEqual(await registry.get('DoesNotExist'), undefined);
});

test('no default export exists', async () => {
  const mod = await import('../../src/ai/registry.js');
  strictEqual(mod.default, undefined);
  ok(mod.registry !== undefined);
  ok(typeof mod.registry.get === 'function');
});
