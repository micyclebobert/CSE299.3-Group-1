// =============================================================================
// test/ai/AIBuilder.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/AIBuilder.js (stretch capability). Mocks global fetch
// (Ollama); uses real Serializer.fromJson. No DOM, no network, no LLM.
// Runs via node --test.
// =============================================================================

import { assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AIBuilder } from '../../src/ai/AIBuilder.js';

function mockFetch(responseOrError) {
  let callArgs = null;
  const fakeFetch = async (input, init) => {
    callArgs = { input, init };
    if (responseOrError instanceof Error) throw responseOrError;
    return responseOrError;
  };
  fakeFetch.callArgs = () => callArgs;
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

describe('AIBuilder', () => {
  it('builds a Circuit from valid model JSON', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    const result = await AIBuilder.build('Bell state on 2 qubits', 2);
    assert.equal(result.ok, true);
    assert.ok(result.circuit);
    assert.equal(result.circuit.numQubits(), 2);
    assert.ok(result.json);
  });

  it('returns error when Ollama is unavailable', async () => {
    mockFetch(new Error('connection refused'));
    const result = await AIBuilder.build('Bell state on 2 qubits', 2);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Ollama unavailable'));
    assert.equal(result.json, undefined);
  });

  it('returns error when model output is not JSON', async () => {
    mockFetch(okResponse('not json at all'));
    const result = await AIBuilder.build('Bell state on 2 qubits', 2);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Could not extract JSON'));
    assert.equal(result.json, 'not json at all');
  });

  it('returns error when circuit JSON fails validation', async () => {
    const bad = { ...bellJson, numQubits: 0 };
    mockFetch(okResponse(JSON.stringify(bad)));
    const result = await AIBuilder.build('Bell state on 2 qubits', 2);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('failed validation'));
    assert.ok(result.json);
  });

  it('extracts JSON wrapped in markdown code fences', async () => {
    mockFetch(okResponse('```json\n' + JSON.stringify(bellJson) + '\n```'));
    const result = await AIBuilder.build('Bell state on 2 qubits', 2);
    assert.equal(result.ok, true);
    assert.equal(result.circuit.numQubits(), 2);
  });

  it('rejects empty prompt', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    const result = await AIBuilder.build('', 2);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'prompt must be a non-empty string');
  });

  it('rejects invalid numQubits', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    const result = await AIBuilder.build('Bell state', 0);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'numQubits must be a positive integer');
  });

  it('passes options.model to Ollama', async () => {
    mockFetch(okResponse(JSON.stringify(bellJson)));
    await AIBuilder.build('Bell state', 2, { model: 'qwen2.5-coder:7b' });
    const body = JSON.parse(mockFetch.callArgs().init.body);
    assert.equal(body.model, 'qwen2.5-coder:7b');
    assert.equal(body.stream, false);
    assert.equal(body.options.num_ctx, 4096);
  });
});
