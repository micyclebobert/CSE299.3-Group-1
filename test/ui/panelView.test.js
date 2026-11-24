import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initPanelView } from '../../src/ui/panelView.js';
import { PANEL_LEFT } from '../../src/ui/panels.js';

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    id: '',
    appendChild(child) {
      return child;
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener() {},
    closest() {
      return null;
    },
  };
  el.listeners = listeners;
  return el;
}

globalThis.window = { addEventListener() {} };
globalThis.document = {
  createElement: () => makeElement(),
  getElementById(id) {
    const el = makeElement();
    el.id = id;
    return el;
  },
  querySelectorAll() {
    return [];
  },
};

test('initPanelView registers toggle listeners for panel buttons', () => {
  let toggled = null;
  let regionVisible = true;
  const panelModel = {
    toggle(id) {
      toggled = id;
    },
    getRegion() {
      return { visible: regionVisible };
    },
  };
  const btn = makeElement();
  btn.dataset.toggle = PANEL_LEFT;
  const panel = makeElement();
  panel.id = 'panel-' + PANEL_LEFT;
  let capturedPanel = null;
  globalThis.document.querySelectorAll = () => [btn];
  globalThis.document.getElementById = (id) => {
    if (id === 'panel-' + PANEL_LEFT) {
      capturedPanel = panel;
      return panel;
    }
    return makeElement();
  };
  initPanelView(panelModel);
  ok(btn.listeners.get('click'), 'click listener registered on panel toggle');
  btn.listeners.get('click')[0]();
  strictEqual(toggled, PANEL_LEFT, 'toggle called with panel id');
  strictEqual(capturedPanel.style.display, 'flex', 'panel displayed when region visible');
});
