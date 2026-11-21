// =============================================================================
// test/ai/AIBuilderUI.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/AIBuilderUI.js. Mocks global fetch (Ollama); uses real
// AIBuilder + Serializer.fromJson. No DOM, no network, no LLM. Runs via
// node --test.
// =============================================================================

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { AIBuilderUI } from '../../src/ai/AIBuilderUI.js';

function mockFetch(responseOrError) {
  let callCount = 0;
  const fakeFetch = async (input, init) => {
    callCount += 1;
    if (responseOrError instanceof Error) throw responseOrError;
    return responseOrError;
  };
  fakeFetch.callCount = () => callCount;
  globalThis.fetch = fakeFetch;
  return fakeFetch;
}

function okResponse(content) {
  return new Response(JSON.stringify({ message: { content } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const bellJson = {
  format: 'simqc-circuit',
  version: 1,
  bitOrder: 'little-endian',
  numQubits: 2,
  columns: [
    [{ gate: 'H', target: 0 }],
    [{ gate: 'CNOT', target: 1, controls: [{ row: 0, on: true }] }],
  ],
};

describe('AIBuilderUI', () => {
  it('builds a Circuit and transitions status to ok', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    const events = [];
    const ui = new AIBuilderUI({
      numQubits: 2,
      onChange: (s) => events.push({ name: 'change', status: s.status }),
      onBuildOk: (s) => events.push({ name: 'ok', status: s.status }),
      onBuildStart: (s) => events.push({ name: 'start', status: s.status }),
    });
    ui.setPrompt('Bell state on 2 qubits');
    assert.equal(ui.status, 'idle');
    assert.equal(ui.error, null);

    await ui.build();
    assert.equal(ui.status, 'ok');
    assert.equal(ui.error, null);
    assert.ok(ui.circuit);
    assert.equal(ui.circuit.numQubits, 2);
    assert.ok(ui.generatedJson);
    assert.equal(ui.cacheHit, false);
    assert.ok(ui.cacheKey);
    assert.equal(ui.cacheKey.length, 64);

    const statuses = events.map((e) => e.name);
    assert.ok(statuses.includes('start'));
    assert.ok(statuses.includes('ok'));
    assert.ok(statuses.includes('change'));
  });

  it('serves cached result on repeat build (cache hit, no fetch)', async () => {
    const fetchMock = mockFetch(okResponse(JSON.stringify(bellJson)));
    const hits = [];
    const ui = new AIBuilderUI({
      numQubits: 2,
      onCacheHit: (key) => hits.push(key),
      onCacheMiss: (key) => misses.push(key),
    });
    ui.setPrompt('Bell state on 2 qubits');
    const misses = [];
    ui.onCacheMiss = (key) => misses.push(key);
    await ui.build();
    assert.equal(fetchMock.callCount(), 1);
    assert.equal(ui.cacheHit, false);
    assert.equal(misses.length, 1);

    await ui.build();
    assert.equal(fetchMock.callCount(), 1, 'fetch must not be called on cache hit');
    assert.equal(ui.cacheHit, true);
    assert.equal(hits.length, 1);
    assert.equal(ui.status, 'ok');
    assert.ok(ui.circuit);
  });

  it('reports cache miss on first build', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    const misses = [];
    const ui = new AIBuilderUI({ numQubits: 2, onCacheMiss: (key) => misses.push(key) });
    ui.setPrompt('Bell state on 2 qubits');
    await ui.build();
    assert.equal(misses.length, 1);
    assert.equal(misses[0].length, 64);
    assert.equal(ui.cacheHit, false);
  });

  it('reports error when Ollama is unavailable', async () => {
    mockFetch(new Error('connection refused'));
    const errors = [];
    const ui = new AIBuilderUI({ numQubits: 2, onBuildError: (err) => errors.push(err) });
    ui.setPrompt('Bell state on 2 qubits');
    await ui.build();
    assert.equal(ui.status, 'error');
    assert.ok(ui.error.includes('Ollama unavailable'));
    assert.equal(ui.cacheHit, false);
    assert.equal(errors.length, 1);
  });

  it('reports error when model output is not JSON', async () => {
    mockFetch(okResponse('not json at all'));
    const ui = new AIBuilderUI({ numQubits: 2 });
    ui.setPrompt('Bell state on 2 qubits');
    await ui.build();
    assert.equal(ui.status, 'error');
    assert.ok(ui.error.includes('Could not extract JSON'));
    assert.equal(ui.generatedJson, 'not json at all');
  });

  it('rejects empty prompt without calling Ollama', async () => {
    const fetchMock = mockFetch(okResponse(JSON.stringify(bellJson)));
    const ui = new AIBuilderUI({ numQubits: 2 });
    await ui.build();
    assert.equal(fetchMock.callCount(), 0);
    assert.equal(ui.status, 'error');
    assert.equal(ui.error, 'prompt must be a non-empty string');
  });

  it('setPrompt and setNumQubits reset build state', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    const ui = new AIBuilderUI({ numQubits: 2 });
    ui.setPrompt('Bell state on 2 qubits');
    await ui.build();
    assert.equal(ui.status, 'ok');

    ui.setPrompt('');
    assert.equal(ui.status, 'idle');
    assert.equal(ui.circuit, null);
    assert.equal(ui.generatedJson, null);
    assert.equal(ui.error, null);
    assert.equal(ui.cacheHit, null);

    ui.setPrompt('Bell state on 2 qubits');
    ui.setNumQubits(3);
    assert.equal(ui.numQubits, 3);
    assert.equal(ui.status, 'idle');
  });

  it('setPrompt/setNumQubits throw on invalid input', () => {
    const ui = new AIBuilderUI();
    assert.throws(() => ui.setPrompt(123), TypeError);
    assert.throws(() => ui.setNumQubits(0), RangeError);
    assert.throws(() => ui.setNumQubits(-1), RangeError);
    assert.throws(() => ui.setNumQubits(2.5), RangeError);
  });

  it('getStateSnapshot has the expected shape', () => {
    const ui = new AIBuilderUI({ numQubits: 3 });
    const snap = ui.getStateSnapshot();
    assert.deepEqual(snap, {
      prompt: '',
      numQubits: 3,
      status: 'idle',
      generatedJson: null,
      circuit: null,
      error: null,
      cacheHit: null,
      cacheKey: null,
    });
  });

  it('clearCache forces a refetch', async () => {
    const fetchMock = mockFetch(okResponse(JSON.stringify(bellJson)));
    const ui = new AIBuilderUI({ numQubits: 2 });
    ui.setPrompt('Bell state on 2 qubits');
    await ui.build();
    assert.equal(fetchMock.callCount(), 1);
    ui.clearCache();
    await ui.build();
    assert.equal(fetchMock.callCount(), 2);
    assert.equal(ui.cacheHit, false);
  });

  it('reset clears all state', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    const ui = new AIBuilderUI({ numQubits: 2 });
    ui.setPrompt('Bell state on 2 qubits');
    await ui.build();
    ui.reset();
    assert.equal(ui.prompt, '');
    assert.equal(ui.numQubits, 2);
    assert.equal(ui.status, 'idle');
    assert.equal(ui.cacheKey, null);
    assert.equal(ui.cacheHit, null);
  });
});
