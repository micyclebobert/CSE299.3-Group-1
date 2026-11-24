import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initCodeView } from '../../src/ui/codeView.js';

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    value: '',
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
    select() {},
  };
  el.listeners = listeners;
  return el;
}

const elements = new Map();
globalThis.window = {
  addEventListener() {},
  location: { origin: 'http://localhost/', pathname: '/' },
};
globalThis.document = {
  createElement: () => makeElement(),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  },
};
globalThis.document.execCommand = () => {};
globalThis.prompt = () => null;
globalThis.alert = () => {};
globalThis.Blob = class {
  constructor() {}
};
globalThis.URL = {
  createObjectURL() {
    return 'blob:url';
  },
  revokeObjectURL() {},
};

function buildApp() {
  let deserialized = null;
  let drawn = 0;
  const app = {
    onCode(cb) {
      this._codeCb = cb;
    },
    deserialize(json) {
      deserialized = json;
      return { ok: true };
    },
    draw() {
      drawn += 1;
    },
    serialize() {
      return '{"circuit":1}';
    },
    encodeURL() {
      return 'abc';
    },
    last() {
      return { deserialized, drawn };
    },
  };
  return app;
}

test('initCodeView registers onCode callback and keydown enter handler', () => {
  elements.clear();
  const codeEl = makeElement();
  const app = buildApp();
  initCodeView(app, codeEl);
  ok(app._codeCb, 'onCode callback registered');
  ok(codeEl.listeners.get('keydown'), 'keydown listener registered');
  codeEl.value = '{"circuit":1}';
  codeEl.listeners.get('keydown')[0]({ key: 'Enter', shiftKey: false, preventDefault() {} });
  strictEqual(app.last().deserialized, '{"circuit":1}', 'deserialize called with code value');
  strictEqual(app.last().drawn, 1, 'draw called after deserialize');
});

test('initCodeView wires action buttons', () => {
  elements.clear();
  const codeEl = makeElement();
  const app = buildApp();
  initCodeView(app, codeEl);
  ok(globalThis.document.getElementById('btn-copy').listeners.get('click'), 'btn-copy click listener');
  ok(globalThis.document.getElementById('btn-import').listeners.get('click'), 'btn-import click listener');
  ok(globalThis.document.getElementById('btn-export').listeners.get('click'), 'btn-export click listener');
  ok(globalThis.document.getElementById('btn-share').listeners.get('click'), 'btn-share click listener');
});
