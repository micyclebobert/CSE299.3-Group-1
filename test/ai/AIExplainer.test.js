// =============================================================================
// test/ai/AIExplainer.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/AIExplainer.js. Mocks global fetch (Ollama); no
// network, no DOM, no LLM. Runs via node --test.
// =============================================================================

import { assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AIExplainer } from '../../src/ai/AIExplainer.js';
import { Cache } from '../../src/ai/Cache.js';

function mockFetch(responseOrError) {
  let callArgs = null;
  const fakeFetch = async (input, init) => {
    callArgs = { input, init };
    if (responseOrError instanceof Error) {
      throw responseOrError;
    }
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

const instructions = [
  { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
  {
    gateId: 'CNOT',
    target: 1,
    controls: [{ row: 0, on: true }],
    column: 1,
    virtualColumn: 1,
  },
];
const summaries = [
  { topK: [{ label: '|00>', probability: 1, phase: 0 }], marginals: [] },
  { topK: [], marginals: [] },
];

describe('AIExplainer', () => {
  it('returns Ollama message content on success', async () => {
    const fetchMock = mockFetch(okResponse('Hadamard creates superposition.'));
    const explainer = new AIExplainer();
    const result = await explainer.explain(instructions, summaries, 2);
    assert.equal(result, 'Hadamard creates superposition.');
    const args = fetchMock.callArgs();
    const body = JSON.parse(args.init.body);
    assert.equal(body.model, 'qwen2.5:3b');
    assert.equal(body.stream, false);
    assert.equal(body.options.num_ctx, 4096);
    assert.equal(body.messages[0].role, 'user');
    assert.ok(typeof body.messages[0].content === 'string');
    assert.ok(body.messages[0].content.includes('H'));
    assert.ok(body.messages[0].content.includes('CNOT'));
  });

  it('uses options.model when provided', async () => {
    mockFetch(okResponse('custom model response'));
    const explainer = new AIExplainer();
    await explainer.explain(instructions, summaries, 2, { model: 'qwen2.5-coder:7b' });
    const body = JSON.parse(fetchMock.callArgs().init.body);
    assert.equal(body.model, 'qwen2.5-coder:7b');
  });

  it('falls back to template when fetch throws', async () => {
    mockFetch(new Error('connection refused'));
    const explainer = new AIExplainer();
    const result = await explainer.explain(instructions, summaries, 2);
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
    assert.ok(result.includes('template fallback') || result.includes('H'));
  });

  it('falls back to template when Ollama returns non-ok', async () => {
    mockFetch(new Response('', { status: 500 }));
    const explainer = new AIExplainer();
    const result = await explainer.explain(instructions, summaries, 2);
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  it('returns empty-circuit message for no instructions', async () => {
    mockFetch(okResponse('unused'));
    const explainer = new AIExplainer();
    const result = await explainer.explain([], [], 2);
    assert.equal(result, 'Empty circuit: no instructions to explain.');
  });

  it('throws TypeError for non-array instructions', async () => {
    mockFetch(okResponse('unused'));
    const explainer = new AIExplainer();
    await assert.rejects(
      explainer.explain(null, [], 2),
      (err) => err instanceof TypeError
    );
  });

  it('cache hit returns cached value without calling fetch', async () => {
    const fetchMock = mockFetch(okResponse('should not be called'));
    const cache = new Cache();
    const key = 'fake-key';
    cache.set(key, 'cached explanation');
    const explainer = new AIExplainer();
    const result = await explainer.explain(
      instructions,
      summaries,
      2,
      { cache, canonicalJson: 'some-json' }
    );
    assert.equal(result, 'cached explanation');
    assert.equal(fetchMock.callArgs(), null);
  });

  it('caches successful Ollama response', async () => {
    mockFetch(okResponse('new explanation'));
    const cache = new Cache();
    const explainer = new AIExplainer();
    await explainer.explain(
      instructions,
      summaries,
      2,
      { cache, canonicalJson: 'some-json' }
    );
    const key = Cache.computeKey('some-json');
    assert.equal(cache.get(key), 'new explanation');
  });
});
