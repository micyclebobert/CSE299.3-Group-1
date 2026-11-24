// =============================================================================
// test/ai/AIExplainer.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/AIExplainer.js. Mocks global fetch (Ollama); no
// network, no DOM, no LLM. Runs via node --test.
// =============================================================================

import assert from 'node:assert';
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

function mockFetchCapturingPrompt() {
  let capturedPrompt = '';
  const fakeFetch = async (input, init) => {
    capturedPrompt = JSON.parse(init.body).messages[0].content;
    return okResponse('ok');
  };
  fakeFetch.prompt = () => capturedPrompt;
  globalThis.fetch = fakeFetch;
  return fakeFetch;
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
    const fetchMock = mockFetch(okResponse('custom model response'));
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
    const key = Cache.computeKey('some-json');
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

  it('indexes summaries by virtual column, not instruction order', async () => {
    const fetchMock = mockFetchCapturingPrompt();
    const vcInstructions = [
      { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
      { gateId: 'H', target: 1, controls: [], column: 1, virtualColumn: 2 },
    ];
    // summaries[0] -> |00>, summaries[2] -> |01>, summaries[1] unused (gap at vc=1)
    const vcSummaries = [
      { topK: [{ label: '|00>', probability: 1, phase: 0 }], marginals: [] },
      { topK: [{ label: '|10>', probability: 1, phase: 0 }], marginals: [] },
      { topK: [{ label: '|01>', probability: 1, phase: 0 }], marginals: [] },
    ];
    const explainer = new AIExplainer();
    await explainer.explain(vcInstructions, vcSummaries, 2);
    const prompt = fetchMock.prompt();
    assert.ok(prompt.includes('|00>'), 'vc=0 uses summaries[0] (|00>)');
    assert.ok(prompt.includes('|01>'), 'vc=2 uses summaries[2] (|01>)');
    assert.ok(!prompt.includes('|10>'), 'summaries[1] must not be used for vc=2');
    const col0Header = prompt.indexOf('After virtual column 0:');
    const col2Header = prompt.indexOf('After virtual column 2:');
    assert.ok(col0Header !== -1 && col2Header !== -1, 'both column headers present');
    assert.ok(col0Header < col2Header, 'column 0 summary precedes column 2 summary');
  });

  it('builds one summary per virtual column with sparse array', async () => {
    const fetchMock = mockFetchCapturingPrompt();
    const instrs = [
      { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
      { gateId: 'H', target: 1, controls: [], column: 1, virtualColumn: 0 },
      { gateId: 'H', target: 0, controls: [], column: 2, virtualColumn: 2 },
    ];
    const summaries = [
      { topK: [{ label: '|00>', probability: 1, phase: 0 }], marginals: [] },
      undefined, // no summary at virtual column 1
      { topK: [{ label: '|01>', probability: 1, phase: 0 }], marginals: [] },
    ];
    const explainer = new AIExplainer();
    await explainer.explain(instrs, summaries, 2);
    const prompt = fetchMock.prompt();
    const col0Header = prompt.indexOf('After virtual column 0:');
    const col2Header = prompt.indexOf('After virtual column 2:');
    assert.ok(col0Header !== -1 && col2Header !== -1, 'both column headers present');
    assert.ok(prompt.indexOf('|00>') > col0Header, '|00> after column 0 header');
    assert.ok(prompt.indexOf('|01>') > col2Header, '|01> after column 2 header');
  });

  it('buildPrompt emits one section per unique virtual column', async () => {
    const fetchMock = mockFetchCapturingPrompt();
    const instrs = [
      { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
      { gateId: 'H', target: 1, controls: [], column: 1, virtualColumn: 0 },
      { gateId: 'H', target: 0, controls: [], column: 2, virtualColumn: 2 },
    ];
    const summaries = [
      { topK: [{ label: '|00>', probability: 1, phase: 0 }], marginals: [] },
      undefined, // no summary at virtual column 1
      { topK: [{ label: '|01>', probability: 1, phase: 0 }], marginals: [] },
    ];
    const explainer = new AIExplainer();
    await explainer.explain(instrs, summaries, 2);
    const prompt = fetchMock.prompt();
    assert.strictEqual(prompt.split('After virtual column 0:').length - 1, 1, 'one section for virtual column 0');
    assert.strictEqual(prompt.split('After virtual column 2:').length - 1, 1, 'one section for virtual column 2');
    assert.strictEqual(prompt.indexOf('After virtual column 1:'), -1, 'no section for missing virtual column 1');
    assert.ok(prompt.indexOf('|00>') > prompt.indexOf('After virtual column 0:'), '|00> after column 0 header');
    assert.ok(prompt.indexOf('|01>') > prompt.indexOf('After virtual column 2:'), '|01> after column 2 header');
  });
});
