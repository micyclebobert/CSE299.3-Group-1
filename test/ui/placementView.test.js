import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initPlacementView } from '../../src/ui/placementView.js';
import { Interaction } from '../../src/editor/Interaction.js';

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

globalThis.window = {
  addEventListener() {},
};
globalThis.document = { createElement: () => makeElement() };

const GEOMETRY = { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 };
const ENTRY = { name: 'H', arity: 1 };

function buildApp() {
  let lastPlace = null;
  let lastStatus = null;
  const app = {
    getSelectedEntry() {
      return ENTRY;
    },
    placeGateFromCell(cell, entry) {
      lastPlace = { column: cell.column, row: cell.row, name: entry.name };
      return { conflict: false };
    },
    setStatus(msg) {
      lastStatus = msg;
    },
    draw() {},
    lastPlace() {
      return lastPlace;
    },
    lastStatus() {
      return lastStatus;
    },
  };
  return app;
}

function fire(canvas, type, offsetX, offsetY) {
  const listeners = canvas.listeners.get(type);
  if (listeners) listeners[0]({ offsetX, offsetY });
}

test('pointerdown + pointerup at gate center (80, 20) places at column 0, row 0', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 80, 20);
  fire(canvas, 'pointerup', 80, 20);

  const placed = app.lastPlace();
  ok(placed, 'placeGateFromCell should be invoked on pointerup');
  strictEqual(placed.column, 0, 'gate center x=80 snaps to column 0');
  strictEqual(placed.row, 0, 'gate center y=20 snaps to row 0');
  strictEqual(placed.name, 'H');
});

test('gate center (160, 20) places at column 1, row 0', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 160, 20);
  fire(canvas, 'pointerup', 160, 20);

  const placed = app.lastPlace();
  ok(placed);
  strictEqual(placed.column, 1, 'gate center x=160 snaps to column 1');
  strictEqual(placed.row, 0);
});

test('inter-column boundary (120, 20) places at column 1, row 0', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 120, 20);
  fire(canvas, 'pointerup', 120, 20);

  const placed = app.lastPlace();
  ok(placed);
  strictEqual(placed.column, 1, 'midpoint x=120 between gate centers 80 and 160 snaps to column 1');
  strictEqual(placed.row, 0);
});

test('left side of column 0 cell (40, 20) places at column 0, row 0', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 40, 20);
  fire(canvas, 'pointerup', 40, 20);

  const placed = app.lastPlace();
  ok(placed);
  ok(placed.column === 0, 'x=40 left side of column 0 cell snaps to column 0');
  strictEqual(placed.row, 0);
});

test('right side of column 0 cell (119, 20) places at column 0, row 0', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 119, 20);
  fire(canvas, 'pointerup', 119, 20);

  const placed = app.lastPlace();
  ok(placed);
  strictEqual(placed.column, 0, 'x=119 right side of column 0 cell snaps to column 0');
  strictEqual(placed.row, 0);
});

test('row center (80, 68) places at column 0, row 1', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 80, 68);
  fire(canvas, 'pointerup', 80, 68);

  const placed = app.lastPlace();
  ok(placed);
  strictEqual(placed.column, 0);
  strictEqual(placed.row, 1, 'row center y=68 snaps to row 1');
});

test('inter-row boundary (80, 44) places at column 0, row 1', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 80, 44);
  fire(canvas, 'pointerup', 80, 44);

  const placed = app.lastPlace();
  ok(placed);
  strictEqual(placed.column, 0);
  strictEqual(placed.row, 1, 'midpoint y=44 between row centers 20 and 68 snaps to row 1');
});

test('pointerup without a prior pick does not place a gate', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  const app = buildApp();
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerup', 80, 20);

  strictEqual(app.lastPlace(), null, 'no placement should occur without a picked gate');
});

test('pointerup conflict shows status and does not draw', () => {
  const canvas = makeElement();
  const interaction = new Interaction();
  let drawCount = 0;
  const app = {
    getSelectedEntry() { return ENTRY; },
    placeGateFromCell() {
      return { conflict: true, reason: 'row occupied in column' };
    },
    setStatus(msg) {
      app.lastStatus = msg;
    },
    draw() { drawCount += 1; },
    lastPlace() { return null; },
  };
  initPlacementView(app, canvas, interaction);

  fire(canvas, 'pointerdown', 80, 20);
  fire(canvas, 'pointerup', 80, 20);

  strictEqual(app.lastStatus, 'row occupied in column', 'conflict reason surfaced via setStatus');
  strictEqual(drawCount, 0, 'draw should not be called on conflict');
});
