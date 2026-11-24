import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Interaction } from '../../src/editor/Interaction.js';

import '../../src/main.js';

function makeElement() {
  const el = {
    textContent: '', className: '', style: {}, dataset: {},
    appendChild(child) { return child; },
    addEventListener() {}, removeEventListener() {}, closest() { return null; }, getContext() { return {}; },
  };
  return el;
}

globalThis.window = { addEventListener() {} };
globalThis.document = { createElement: () => makeElement() };

function buildApp() {
  const canvasEl = makeElement();
  const paletteEl = makeElement();
  const inspectorEl = makeElement();
  const codeEl = makeElement();
  const statusEl = makeElement();
  const interaction = new Interaction();
  const app = new AppController({
    history: new History(), interaction, catalog: gateCatalog(), theme: null,
    Inspector: class {},
    canvasEl, paletteEl, inspectorEl, codeEl, statusEl,
  });
  return { app, statusEl };
}

test('shots: default shots is 1024', () => {
  const { app } = buildApp();
  strictEqual(app.shots, 1024);
});

test('shots: setShots rejects invalid values and keeps current', () => {
  const { app, statusEl } = buildApp();
  app.setShots(NaN);
  strictEqual(app.shots, 1024);
  ok(statusEl.textContent.includes('Invalid'));
  app.setShots(Infinity);
  strictEqual(app.shots, 1024);
  app.setShots(0);
  strictEqual(app.shots, 1024);
  app.setShots(-5);
  strictEqual(app.shots, 1024);
});

test('shots: setShots floors fractional and clamps to minimum 1', () => {
  const { app } = buildApp();
  app.setShots(2.7);
  strictEqual(app.shots, 2);
  app.setShots(200);
  strictEqual(app.shots, 200);
  app.setShots(1);
  strictEqual(app.shots, 1);
});

test('shots: setShots coerces numeric strings and rejects non-numeric strings', () => {
  const { app, statusEl } = buildApp();
  app.setShots("1024");
  strictEqual(app.shots, 1024);
  app.setShots(500);
  strictEqual(app.shots, 500);
  app.setShots("abc");
  strictEqual(app.shots, 500);
  ok(statusEl.textContent.includes('Invalid'));
  app.setShots("");
  strictEqual(app.shots, 500);
  app.setShots("1024.7");
  strictEqual(app.shots, 1024);
  app.setShots("-5");
  strictEqual(app.shots, 1024);
});

test('shots: sampleShots on empty circuit reports all shots in state 0', () => {
  const { app } = buildApp();
  app.setShots(16);
  const hist = app.sampleShots();
  ok(hist instanceof Map);
  strictEqual(hist.get(0), 16);
  strictEqual(hist.size, 1);
});

test('shots: sampleShots returns a histogram Map after simulate', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  app.setShots(8);
  const hist = app.sampleShots();
  ok(hist instanceof Map);
  let total = 0;
  for (const count of hist.values()) total += count;
  strictEqual(total, 8);
});
