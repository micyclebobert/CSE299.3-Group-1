import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initDebuggerView } from '../../src/ui/debugger-view.js';

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    value: '',
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

const elements = new Map();
globalThis.window = { addEventListener() {} };
globalThis.document = {
  createElement: () => makeElement(),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  },
};

function buildApp() {
  let stepped = 0;
  let simulated = 0;
  let seeked = null;
  let toggled = null;
  let runToBp = 0;
  const app = {
    getTimelineMax() {
      return 3;
    },
    getDebuggerStep() {
      return stepped;
    },
    getDebuggerTotal() {
      return 3;
    },
    seekDebugger(col) {
      seeked = col;
    },
    draw() {},
    toggleBreakpoint(col) {
      toggled = col;
    },
    runToBreakpoint() {
      runToBp += 1;
    },
    stepDebugger() {
      stepped += 1;
    },
    simulate() {
      simulated += 1;
    },
    getBreakpointsWithStatus() {
      return [{ column: 0, active: true }];
    },
    last() {
      return { stepped, simulated, seeked, toggled, runToBp };
    },
  };
  return app;
}

test('initDebuggerView returns updateDebugStep and refreshes timeline', () => {
  elements.clear();
  const stepCurrent = makeElement();
  const stepTotal = makeElement();
  const app = buildApp();
  const result = initDebuggerView(app, stepCurrent, stepTotal);
  ok(typeof result.updateDebugStep === 'function', 'returns updateDebugStep');
  result.updateDebugStep();
  strictEqual(String(stepCurrent.textContent), '0', 'stepCurrent shows debugger step');
  strictEqual(String(stepTotal.textContent), '3', 'stepTotal shows debugger total');
});

test('timeline-scrub input seeks debugger', () => {
  elements.clear();
  const app = buildApp();
  const timelineScrub = globalThis.document.getElementById('timeline-scrub');
  initDebuggerView(app, makeElement(), makeElement());
  timelineScrub.value = '2';
  timelineScrub.listeners.get('input')[0]({ target: timelineScrub });
  strictEqual(app.last().seeked, 2, 'seekDebugger called with scrub value');
});

test('btn-breakpoint toggles breakpoint', () => {
  elements.clear();
  const app = buildApp();
  const btnBreakpoint = globalThis.document.getElementById('btn-breakpoint');
  const bpColumn = globalThis.document.getElementById('bp-column');
  bpColumn.value = '1';
  initDebuggerView(app, makeElement(), makeElement());
  btnBreakpoint.listeners.get('click')[0]();
  strictEqual(app.last().toggled, 1, 'toggleBreakpoint called with bp column');
});

test('btn-step calls stepDebugger', () => {
  elements.clear();
  const app = buildApp();
  const btnStep = globalThis.document.getElementById('btn-step');
  initDebuggerView(app, makeElement(), makeElement());
  btnStep.listeners.get('click')[0]();
  strictEqual(app.last().stepped, 1, 'stepDebugger called');
});

test('btn-run calls simulate', () => {
  elements.clear();
  const app = buildApp();
  const btnRun = globalThis.document.getElementById('btn-run');
  initDebuggerView(app, makeElement(), makeElement());
  btnRun.listeners.get('click')[0]();
  strictEqual(app.last().simulated, 1, 'simulate called');
});
