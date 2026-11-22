import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initAIExplainerView } from '../../src/ui/ai-explainer-view.js';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Interaction } from '../../src/editor/Interaction.js';
import { Cache } from '../../src/ai/Cache.js';
import { SparseSummary } from '../../src/ai/SparseSummary.js';

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

test('initAIExplainerView builds one SparseSummary per virtual column', async () => {
  const { app, btnEl } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'H');

  let explainCalled = null;
  class MockAIExplainer {
    async explain(instructions, summaries, numQubits, options) {
      explainCalled = { instructions, summaries, numQubits, options };
      return 'explanation text';
    }
  }

  const aiOutput = makeElement();
  globalThis.document.getElementById = () => aiOutput;
  initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary, new Cache());

  const clickListeners = aiOutput.listeners.get('click');
  ok(clickListeners && clickListeners.length > 0, 'click listener registered');
  await clickListeners[0]();

  ok(explainCalled, 'AIExplainer.explain was called');
  strictEqual(explainCalled.numQubits, 2, 'numQubits passed through');

  // One summary per virtual column: vc=0 and vc=1
  strictEqual(explainCalled.summaries.length, 2, 'one summary per virtual column');
  ok(explainCalled.summaries[0], 'summary present at virtual column 0');
  ok(explainCalled.summaries[1], 'summary present at virtual column 1');
  strictEqual(explainCalled.summaries[2], undefined, 'no entry at virtual column 2');

  // stateIdentity included in options for cache key
  ok(explainCalled.options.stateIdentity, 'stateIdentity present for cache key');
  strictEqual(typeof explainCalled.options.stateIdentity, 'string', 'stateIdentity is a string');

  globalThis.document.getElementById = () => btnEl;
});

test('initAIExplainerView handles empty circuit', async () => {
  const { app } = buildApp();
  const aiOutput = makeElement();
  globalThis.document.getElementById = () => aiOutput;

  class MockAIExplainer {
    async explain() { return 'x'; }
  }
  initAIExplainerView(app, aiOutput, new MockAIExplainer(), SparseSummary, new Cache());

  const clickListeners = aiOutput.listeners.get('click');
  ok(clickListeners && clickListeners.length > 0, 'click listener registered');
  await clickListeners[0]();

  strictEqual(aiOutput.textContent, 'Empty circuit: no instructions to explain.');
});
