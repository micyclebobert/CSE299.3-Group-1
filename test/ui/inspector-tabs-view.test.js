import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'node:fs';
import { initInspectorTabsView } from '../../src/ui/inspector-tabs-view.js';

function source() {
  return readFileSync(new URL('../../src/ui/inspector-tabs-view.js', import.meta.url), 'utf8');
}

test('inspector-tabs-view exports initInspectorTabsView', () => {
  ok(/^export function initInspectorTabsView\(/m.test(source()), 'must export initInspectorTabsView');
});

test('defaults activeTab to state and dispatches renderState or renderBloch', () => {
  const src = source();
  ok(/let activeTab = 'state';/.test(src), 'default activeTab is state');
  ok(/if \(activeTab === 'state'\) \{ renderState\(\); \}/.test(src), 'state branch calls renderState');
  ok(/else \{ renderBloch\(\); \}/.test(src), 'non-state branch calls renderBloch');
});

test('wires tab strip click and app.onInspector', () => {
  const src = source();
  ok(/tabStripEl\.addEventListener\('click'/.test(src), 'wires tab strip click');
  ok(/activeTab = tab\.dataset\.tab/.test(src), 'updates activeTab from dataset');
  ok(/app\.onInspector\(\(\) => \{ renderInspector\(\); \}\)/.test(src), 'registers app.onInspector');
});

test('returns renderInspector, getActiveTab and setActiveTab', () => {
  const src = source();
  ok(/return \{ renderInspector, getActiveTab/.test(src), 'returns renderInspector and getActiveTab');
  ok(/setActiveTab: \(v\) => \{ activeTab = v; \}/.test(src), 'returns setActiveTab');
});

test('renderInspector shows No state when no circuit', () => {
  const app = { currentCircuit: null, onInspector() {}, draw() {} };
  const tabStripEl = { addEventListener() {}, querySelectorAll() { return []; } };
  const inspectorContentEl = { textContent: '' };
  const view = initInspectorTabsView(app, tabStripEl, inspectorContentEl, {
    renderState() {}, renderBloch() {},
  });
  view.renderInspector();
  strictEqual(inspectorContentEl.textContent, 'No state yet.');
  ok(typeof view.getActiveTab === 'function', 'exposes getActiveTab');
  ok(typeof view.setActiveTab === 'function', 'exposes setActiveTab');
});
