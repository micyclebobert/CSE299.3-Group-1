import { test } from 'node:test';
import { strictEqual, ok } from 'assert';

function makeElement() {
  const listeners = new Map();
  const classes = new Set();
  const ctx = {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    strokeText() {},
    measureText() {
      return { width: 0 };
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
    ellipse() {},
    fill() {},
    save() {},
    restore() {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    lineCap: '',
  };
  const el = {
    textContent: '',
    innerHTML: '',
    className: '',
    style: {},
    dataset: {},
    value: '',
    disabled: false,
    id: '',
    width: 0,
    height: 0,
    clientWidth: 0,
    clientHeight: 0,
    classList: {
      add(c) {
        classes.add(c);
      },
      remove(c) {
        classes.delete(c);
      },
      contains(c) {
        return classes.has(c);
      },
    },
    getBoundingClientRect() {
      return { width: 680, height: 660 };
    },
    getContext() {
      return ctx;
    },
    querySelectorAll() {
      return [];
    },
    getElementsByClassName() {
      return [];
    },
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
    click() {},
  };
  el.listeners = listeners;
  el.ctx = ctx;
  return el;
}

const elements = new Map();
const requestedIds = new Set();
const windowAdded = [];
globalThis.window = {
  devicePixelRatio: 1,
  addEventListener(type, listener) {
    windowAdded.push(type);
  },
};
globalThis.document = {
  documentElement: { style: { setProperty() {} } },
  createElement: () => makeElement(),
  getElementById(id) {
    requestedIds.add(id);
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  },
  querySelectorAll() {
    return [];
  }
};
globalThis.document.execCommand = () => {};
globalThis.location = { hash: '', origin: 'http://localhost/', pathname: '/' };
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

test('browser-app imports and wires DOM without throwing', async () => {
  requestedIds.clear();
  windowAdded.length = 0;
  await import('../../src/ui/browser-app.js');
  const expected = [
    'circuit', 'gate-palette', 'inspector-content', 'code-view', 'status',
    'tab-strip', 'step-current', 'step-total', 'breakpoint-list',
    'ai-output', 'ai-prompt', 'builder-output', 'io-input-row', 'io-output-row',
    'io-output', 'shots-input', 'btn-simulate', 'btn-reset', 'btn-undo',
    'btn-redo', 'btn-copy', 'btn-import', 'btn-export', 'btn-share',
    'btn-breakpoint', 'btn-run-to-bp', 'btn-step', 'btn-run',
    'timeline-scrub',
  ];
  for (const id of expected) {
    ok(requestedIds.has(id), `browser-app requested #${id}`);
  }
  ok(windowAdded.includes('resize'), 'resize listener wired on window');
});
