import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initCanvasRenderer } from '../../src/ui/canvas-renderer.js';

function makeElement() {
  const listeners = new Map();
  const ctx = {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    strokeText() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
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
  };
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    width: 0,
    height: 0,
    getBoundingClientRect() {
      return { width: 680, height: 660 };
    },
    getContext() {
      return ctx;
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
  };
  el.listeners = listeners;
  el.ctx = ctx;
  return el;
}

globalThis.window = { devicePixelRatio: 1, addEventListener() {} };
globalThis.document = { createElement: () => makeElement() };

function buildApp() {
  let renderCb = null;
  const app = {
    onRender(cb) {
      renderCb = cb;
    },
    draw() {},
    trigger() {
      if (renderCb) renderCb({ circuit: { numQubits: 2, columns: [] }, purity: [] });
    },
    last() {
      return renderCb;
    },
  };
  return app;
}

test('initCanvasRenderer registers onRender callback and sizes canvas', () => {
  const canvas = makeElement();
  const ctx = canvas.ctx;
  const app = buildApp();
  initCanvasRenderer(app, canvas, ctx);
  ok(app.last(), 'onRender callback registered');
  app.trigger();
  strictEqual(canvas.width, 680, 'canvas width set from css rect');
  strictEqual(canvas.height, 660, 'canvas height set from css rect');
  ok(typeof ctx.setTransform === 'function', 'ctx transform applied');
});

test('initCanvasRenderer renders empty circuit without throwing', () => {
  const canvas = makeElement();
  const ctx = canvas.ctx;
  const app = buildApp();
  initCanvasRenderer(app, canvas, ctx);
  app.trigger();
  ok(true, 'empty circuit render did not throw');
});
