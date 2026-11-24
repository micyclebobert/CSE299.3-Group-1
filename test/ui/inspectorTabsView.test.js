import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'node:fs';
import { initInspectorTabsView } from '../../src/ui/inspectorTabsView.js';

function source() {
  return readFileSync(new URL('../../src/ui/inspectorTabsView.js', import.meta.url), 'utf8');
}

test('inspector-tabs-view exports initInspectorTabsView', () => {
  ok(/^export function initInspectorTabsView\(/m.test(source()), 'must export initInspectorTabsView');
});

test('accepts renderHistogram and draws it under the State tab', () => {
  const src = source();
  ok(/renderHistogram/.test(src), 'must accept and wire renderHistogram callback');
  let stateCalls = 0;
  let blochCalls = 0;
  let histogramCalls = 0;
  const app = { currentCircuit: {}, onInspector() {}, draw() {} };
  const tabStripEl = { addEventListener() {}, querySelectorAll() { return []; } };
  const inspectorContentEl = { textContent: '' };
  const view = initInspectorTabsView(app, tabStripEl, inspectorContentEl, {
    renderState() { stateCalls += 1; },
    renderBloch() { blochCalls += 1; },
    renderHistogram() { histogramCalls += 1; },
  });
  view.renderInspector();
  strictEqual(stateCalls, 1, 'state tab renders state');
  strictEqual(histogramCalls, 1, 'state tab renders histogram');
  strictEqual(blochCalls, 0, 'state tab does not render bloch');
});

test('non-state tabs render Bloch, not histogram', () => {
  let histogramCalls = 0;
  const app = { currentCircuit: {}, onInspector() {}, draw() {} };
  const tabStripEl = { addEventListener() {}, querySelectorAll() { return []; } };
  const inspectorContentEl = { textContent: '' };
  const view = initInspectorTabsView(app, tabStripEl, inspectorContentEl, {
    renderState() {}, renderBloch() {}, renderHistogram() { histogramCalls += 1; },
  });
  view.setActiveTab('bloch');
  view.renderInspector();
  strictEqual(view.getActiveTab(), 'bloch');
  strictEqual(histogramCalls, 0, 'histogram not rendered under non-state tab');
});

test('default active tab is state', () => {
  const app = { currentCircuit: {}, onInspector() {}, draw() {} };
  const tabStripEl = { addEventListener() {}, querySelectorAll() { return []; } };
  const inspectorContentEl = { textContent: '' };
  const view = initInspectorTabsView(app, tabStripEl, inspectorContentEl, {
    renderState() {}, renderBloch() {}, renderHistogram() {},
  });
  strictEqual(view.getActiveTab(), 'state', 'default active tab is state');
});

test('wires tab strip click and app.onInspector', () => {
  const src = source();
  ok(/tabStripEl\.addEventListener\('click'/.test(src), 'wires tab strip click');
  ok(/activeTab = tab\.dataset\.tab/.test(src), 'updates activeTab from dataset');
  ok(/app\.onInspector\(\(\) => \{ renderInspector\(\); \}\)/.test(src), 'registers app.onInspector');
});

test('renderInspector shows No state when no circuit', () => {
  const app = { currentCircuit: null, onInspector() {}, draw() {} };
  const tabStripEl = { addEventListener() {}, querySelectorAll() { return []; } };
  const inspectorContentEl = { textContent: '' };
  const view = initInspectorTabsView(app, tabStripEl, inspectorContentEl, {
    renderState() {}, renderBloch() {}, renderHistogram() {},
  });
  view.renderInspector();
  strictEqual(inspectorContentEl.textContent, 'No state yet.');
  ok(typeof view.getActiveTab === 'function', 'exposes getActiveTab');
  ok(typeof view.setActiveTab === 'function', 'exposes setActiveTab');
});

test('returns renderInspector, getActiveTab and setActiveTab', () => {
  const src = source();
  ok(/return \{ renderInspector, getActiveTab/.test(src), 'returns renderInspector and getActiveTab');
  ok(/setActiveTab: \(v\) => \{ activeTab = v; \}/.test(src), 'returns setActiveTab');
});
