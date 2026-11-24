import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initAIBuilderView } from '../../src/ui/aiBuilderView.js';

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    value: '',
    disabled: false,
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

function buildApp({ aiBuilder } = {}) {
  let applied = null;
  let drawn = 0;
  const app = {
    aiBuilder,
    applyCircuit(circuit) {
      applied = circuit;
    },
    draw() {
      drawn += 1;
    },
    serialize() {
      return '{"circuit":1}';
    },
    last() {
      return { applied, drawn };
    },
  };
  return app;
}

test('initAIBuilderView wires builder when aiBuilder is present', async () => {
  elements.clear();
  let onChangeCb = null;
  let lastPrompt = null;
  let numQubits = 2;
  let buildStatus = null;
  let buildCircuit = null;
  const aiBuilder = {
    get numQubits() {
      return numQubits;
    },
    get status() {
      return buildStatus;
    },
    onChange(cb) {
      onChangeCb = cb;
    },
    setNumQubits(n) {
      numQubits = n;
    },
    setPrompt(p) {
      lastPrompt = p;
    },
    async build() {
      buildStatus = 'ok';
      buildCircuit = { ok: true };
      this.circuit = buildCircuit;
    },
  };
  const app = buildApp({ aiBuilder });
  const builderOutput = makeElement();
  const codeEl = makeElement();
  const aiPrompt = { value: 'make a bell circuit' };
  const renderInspector = () => {};
  initAIBuilderView(app, aiPrompt, builderOutput, codeEl, renderInspector);
  strictEqual(builderOutput.style.whiteSpace, 'pre-wrap', 'whiteSpace set to pre-wrap');
  ok(onChangeCb, 'onChange callback registered');
  const qubitsEl = globalThis.document.getElementById('builder-qubits');
  strictEqual(qubitsEl.value, '2', 'qubits input initialized to numQubits');
  ok(qubitsEl.listeners.get('change'), 'change listener registered on qubits input');
  const btnBuild = globalThis.document.getElementById('btn-build');
  ok(btnBuild.listeners.get('click'), 'click listener registered on btn-build');
  qubitsEl.value = '3';
  qubitsEl.listeners.get('change')[0]();
  strictEqual(numQubits, 3, 'setNumQubits called on qubits change');
  buildStatus = null;
  buildCircuit = null;
  await btnBuild.listeners.get('click')[0]();
  strictEqual(lastPrompt, 'make a bell circuit', 'prompt forwarded to builder');
  strictEqual(app.last().applied, buildCircuit, 'circuit applied to app');
  strictEqual(app.last().drawn, 1, 'draw called after build');
  strictEqual(codeEl.value, '{"circuit":1}', 'codeEl updated with serialized circuit');
  strictEqual(builderOutput.textContent, 'Circuit applied to editor.', 'success message shown');
});

test('initAIBuilderView disables builder when aiBuilder is absent', () => {
  elements.clear();
  const app = buildApp({ aiBuilder: undefined });
  const builderOutput = makeElement();
  const codeEl = makeElement();
  const aiPrompt = { value: 'x' };
  initAIBuilderView(app, aiPrompt, builderOutput, codeEl, () => {});
  const btnBuild = globalThis.document.getElementById('btn-build');
  strictEqual(btnBuild.disabled, true, 'btn-build disabled when no aiBuilder');
  strictEqual(builderOutput.textContent, 'AI Builder unavailable.', 'unavailable message shown');
});
