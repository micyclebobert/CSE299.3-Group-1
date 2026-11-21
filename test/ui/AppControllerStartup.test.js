import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { theme, themeCssVariables } from '../../src/ui/theme.js';
import { History } from '../../src/state/History.js';
import { Inspector } from '../../src/inspector/Inspector.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';

// ---------------------------------------------------------------------------
// Minimal DOM shim (bare Node has no window/document). Enough to construct
// AppController: createElement, canvas getContext, window.addEventListener.
// ---------------------------------------------------------------------------

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
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
    getContext() {
      return {};
    },
  };
  el.listeners = listeners;
  return el;
}

const windowListeners = new Map();
globalThis.window = {
  addEventListener(type, listener) {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(listener);
  },
};
globalThis.document = { createElement: () => makeElement() };

test('theme is exported from src/ui/theme.js (the single source)', () => {
  ok(theme !== null && typeof theme === 'object', 'theme must be an object');
  ok(
    themeCssVariables !== null && typeof themeCssVariables === 'object',
    'themeCssVariables must be an object',
  );
  strictEqual(Object.keys(themeCssVariables).length, Object.keys(theme).length);
});

test('AppController module exports the AppController class', () => {
  strictEqual(typeof AppController, 'function');
});

function buildApp() {
  const canvasEl = makeElement();
  const paletteEl = makeElement();
  const inspectorEl = makeElement();
  const codeEl = makeElement();
  const statusEl = makeElement();
  const app = new AppController({
    history: new History(),
    interaction: null,
    catalog: gateCatalog(),
    theme,
    Inspector,
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
  });
  return { app, canvasEl, paletteEl, inspectorEl, codeEl, statusEl };
}

test('AppController constructs without throwing in a minimal DOM shim', () => {
  const { app, canvasEl } = buildApp();

  ok(app instanceof AppController, 'AppController instance created');
  strictEqual(app.numQubits, 2, 'resetCircuit(2) sets two qubit rows');
  ok(app.currentCircuit !== null, 'currentCircuit is set');
  ok(typeof app._bindCanvas === 'function', '_bindCanvas exists as a function');
  ok(typeof app._bindResize === 'function', '_bindResize exists as a function');

  // _bindCanvas attached pointer/mouse listeners to the canvas.
  ok(canvasEl.listeners.has('pointermove'), 'canvas has pointermove listener');
  ok(canvasEl.listeners.has('mousemove'), 'canvas has mousemove listener');

  // _bindResize registered a window resize listener.
  ok(windowListeners.has('resize'), 'window has resize listener');
});

test('_bindCanvas stores pointer position on move events', () => {
  const { app, canvasEl } = buildApp();

  const moveListener = canvasEl.listeners.get('pointermove')[0];
  moveListener({ offsetX: 123, offsetY: 456 });
  deepStrictEqual(app._pointer, { x: 123, y: 456 });
});

test('_bindResize invokes draw on window resize', () => {
  windowListeners.clear();
  const { app } = buildApp();

  let renderCalls = 0;
  app.onRender(() => {
    renderCalls += 1;
  });

  const resizeListener = windowListeners.get('resize')[0];
  resizeListener();
  strictEqual(renderCalls, 1, 'resize listener triggers a draw/render');
});
