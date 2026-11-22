import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
import * as main from '../src/main.js';

test('main exports all required symbols', () => {
  const expected = [
    'registerFixedGate',
    'registerParameterizedGate',
    'seal',
    'panelModel',
    'history',
    'interaction',
    'catalog',
    'cache',
    'URLCodec',
    'theme',
    'DebuggerUI',
    'Debugger',
    'InspectorUI',
    'Inspector',
    'AIExplainer',
    'IOAnalyzer',
    'AIBuilder',
    'AIBuilderUI',
    'IOAnalyzerUI',
    'Cache',
    'SparseSummary',
  ];
  for (const name of expected) {
    ok(name in main, `main exports ${name}`);
  }
});

test('gate registry is sealed', () => {
  throws(() => main.registerFixedGate('I', new Array(8).fill(0)), Error, 'registerFixedGate throws after seal');
  throws(() => main.registerParameterizedGate('Rx', () => []), Error, 'registerParameterizedGate throws after seal');
});

test('cache set/get/has works', () => {
  const c = new main.Cache();
  strictEqual(c.has('k1'), false, 'has false before set');
  c.set('k1', 'v1');
  strictEqual(c.has('k1'), true, 'has true after set');
  strictEqual(c.get('k1'), 'v1', 'get returns value');
  strictEqual(c.get('missing'), undefined, 'get missing returns undefined');
});
