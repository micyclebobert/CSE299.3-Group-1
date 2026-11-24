import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initAIExplainerView } from '../../src/ui/ai-explainer-view.js';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Interaction } from '../../src/editor/Interaction.js';
import { Cache } from '../../src/ai/Cache.js';
import { SparseSummary } from '../../src/ai/SparseSummary.js';
import { AIExplainer } from '../../src/ai/AIExplainer.js';

// Seed the GateRegistry so StepTrace can resolve gate IDs.
import '../../src/main.js';

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    appendChild(child) { return child; },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener() {},
    closest() { return null; },
    getContext() { return {}; },
  };
  el.listeners = listeners;
  return el;
}

const btnEl = makeElement();
globalThis.document = {
  createElement: () => makeElement(),
  getElementById: () => btnEl,
};
globalThis.window = {
  addEventListener() {},
};

function buildApp() {
  const canvasEl = makeElement();
  const paletteEl = makeElement();
  const inspectorEl = makeElement();
  const codeEl = makeElement();
  const statusEl = makeElement();
  const interaction = new Interaction();
  const app = new AppController({
    history: new History(),
    interaction,
    catalog: gateCatalog(),
    theme: null,
    Inspector: class {},
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
  });
  return { app, btnEl };
}

test('cache fallback does not throw Cache is not defined when no cache provided', async () => {
  const { app } = buildApp();
  const aiOutput = makeElement();
  globalThis.document.getElementById = () => aiOutput;

  let explainCalled = null;
  class MockAIExplainer {
    async explain(instructions, summaries, numQubits, options) {
      explainCalled = { instructions, summaries, numQubits, options };
      return 'explanation text';
    }
  }

  // No cache argument; app has no cache -> options.cache is null (no-cache fallback).
  initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary);

  const clickListeners = aiOutput.listeners.get('click');
  ok(clickListeners && clickListeners.length > 0, 'click listener registered');

  app.placeGateAt(0, 0, 'H');
  await clickListeners[0]();

  ok(explainCalled, 'AIExplainer.explain was called');
  strictEqual(explainCalled.options.cache, null, 'no cache injected; no-cache fallback used');
});

test('no direct Cache import edge; uses injected app.cache only', async () => {
  const { app } = buildApp();
  const aiOutput = makeElement();
  globalThis.document.getElementById = () => aiOutput;

  let explainCalled = null;
  class MockAIExplainer {
    async explain(instructions, summaries, numQubits, options) {
      explainCalled = { instructions, summaries, numQubits, options };
      return 'explanation text';
    }
  }

  // No cache argument; app has no cache -> options.cache is null (no-cache fallback).
  initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary);
  const clickListeners = aiOutput.listeners.get('click');
  ok(clickListeners && clickListeners.length > 0, 'click listener registered');

  app.placeGateAt(0, 0, 'H');
  await clickListeners[0]();

  ok(explainCalled, 'AIExplainer.explain was called');
  strictEqual(explainCalled.options.cache, null, 'no direct Cache; options.cache null when none injected');
});

test('state boundary selection produces one summary per boundary', async () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'H');

  const aiOutput = makeElement();
  globalThis.document.getElementById = () => aiOutput;

  let explainCalled = null;
  class MockAIExplainer {
    async explain(instructions, summaries, numQubits, options) {
      explainCalled = { instructions, summaries, numQubits, options };
      return 'explanation text';
    }
  }

  const view = initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary, new Cache());
  ok(typeof view.setStateBoundary === 'function', 'setStateBoundary exposed');

  const clickListeners = aiOutput.listeners.get('click');

  // Default boundary is 'final' -> one summary per virtual column.
  await clickListeners[0]();
  ok(explainCalled, 'explain called');
  strictEqual(explainCalled.summaries.length, 2, 'one summary per virtual column for final boundary');
  ok(explainCalled.summaries[0], 'summary present at virtual column 0');
  ok(explainCalled.summaries[1], 'summary present at virtual column 1');

  // Select step boundary -> one summary per virtual column at that step.
  explainCalled = null;
  view.setStateBoundary('step', 0);
  await clickListeners[0]();
  strictEqual(explainCalled.summaries.length, 2, 'one summary per virtual column for step boundary');
  ok(explainCalled.summaries[0], 'summary present at virtual column 0');
});

test('gate description keys match registered IDs in template fallback', async () => {
  const explainer = new AIExplainer();
  const instructions = [
    { gateId: 'Rx', target: 0, virtualColumn: 0, controls: [], thetaRad: 0.5 },
    { gateId: 'Ry', target: 1, virtualColumn: 1, controls: [], thetaRad: 0.5 },
    { gateId: 'Rz', target: 0, virtualColumn: 2, controls: [], thetaRad: 0.5 },
    {
      gateId: 'Toffoli',
      target: 2,
      virtualColumn: 3,
      controls: [{ row: 0, on: true }, { row: 1, on: true }],
    },
  ];
  const text = await explainer.explain(instructions, [], 3, {});
  ok(text.includes('X-axis rotation'), 'Rx maps to X-axis rotation');
  ok(text.includes('Y-axis rotation'), 'Ry maps to Y-axis rotation');
  ok(text.includes('Z-axis rotation'), 'Rz maps to Z-axis rotation');
  ok(
    text.includes('controlled-controlled-NOT (Toffoli)'),
    'Toffoli maps to full description',
  );
  ok(!text.includes('Rx gate'), 'Rx does not fall through to generic');
});

test('context summary info is included in output', async () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  const aiOutput = makeElement();
  globalThis.document.getElementById = () => aiOutput;

  class MockAIExplainer {
    async explain() { return 'explanation text'; }
  }
  initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary, new Cache());

  const clickListeners = aiOutput.listeners.get('click');
  await clickListeners[0]();

  ok(aiOutput.textContent.startsWith('Context sent:'), 'output begins with Context sent section');
  ok(aiOutput.textContent.includes('boundary=final'), 'boundary included');
  ok(aiOutput.textContent.includes('summaries=1'), 'summary count included');
  ok(aiOutput.textContent.includes('vc=0:'), 'top-k labels shown per virtual column');
  ok(aiOutput.textContent.includes('explanation text'), 'explanation appended');
});

test('empty circuit handling preserved', async () => {
  const { app } = buildApp();
  const aiOutput = makeElement();
  globalThis.document.getElementById = () => aiOutput;

  class MockAIExplainer {
    async explain() { return 'x'; }
  }
  initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary, new Cache());

  const clickListeners = aiOutput.listeners.get('click');
  ok(clickListeners && clickListeners.length > 0, 'click listener registered');
  await clickListeners[0]();

  strictEqual(aiOutput.textContent, 'Empty circuit: no instructions to explain.');
});

globalThis.document.getElementById = () => btnEl;
