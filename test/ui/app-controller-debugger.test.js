import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Interaction } from '../../src/editor/Interaction.js';
import { Debugger } from '../../src/debugger/Debugger.js';
import { DebuggerUI } from '../../src/debugger/DebuggerUI.js';

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
    Inspector: class {}, Debugger, DebuggerUI,
    canvasEl, paletteEl, inspectorEl, codeEl, statusEl,
  });
  return { app, statusEl, interaction };
}

test('debugger: simulate advances stepTrace to end', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  strictEqual(app.getCurrentStep(), app.getTotalSteps());
  ok(app.isAtEnd());
});

test('debugger: simulate routes through Debugger until end', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  strictEqual(app.getDebuggerStep(), app.getDebuggerTotal());
  ok(app.isDebuggerAtEnd());
});

test('debugger: reset() returns to step 0', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  app.reset();
  strictEqual(app.getDebuggerStep(), 0);
  ok(app.isDebuggerAtStart());
});

test('debugger: stepDebugger() advances by 1', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.getDebuggerStep(), 0);
  app.stepDebugger();
  strictEqual(app.getDebuggerStep(), 1);
  ok(!app.isDebuggerAtStart());
});

test('debugger: step() delegates to stepDebugger()', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.step();
  strictEqual(app.getDebuggerStep(), 1);
});

test('debugger: addBreakpoint invalid columns return false', () => {
  const { app, statusEl } = buildApp();
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.addBreakpoint(-1), false);
  strictEqual(app.addBreakpoint(999), false);
  ok(statusEl.textContent.includes('Invalid'));
});

test('debugger: addBreakpoint(0) on empty circuit works', () => {
  const { app } = buildApp();
  strictEqual(app.getTimelineMax(), 0);
  strictEqual(app.addBreakpoint(0), true);
  ok(app.hasBreakpoint(0));
});

test('debugger: getTimelineMax returns schedule length', () => {
  const { app } = buildApp();
  strictEqual(app.getTimelineMax(), 0);
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.getTimelineMax(), 1);
  app.placeGateAt(1, 1, 'H');
  strictEqual(app.getTimelineMax(), 2);
});

test('debugger: breakpoints preserved/dropped across circuit edit', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.addBreakpoint(1);
  app.placeGateAt(1, 1, 'H');
  strictEqual(app.getBreakpoints().length, 2);
  ok(app.hasBreakpoint(0));
  ok(app.hasBreakpoint(1));
  app.resetCircuit(2);
  strictEqual(app.hasBreakpoint(0), true);
  strictEqual(app.hasBreakpoint(1), false);
  strictEqual(app.getBreakpoints().length, 1);
});

test('debugger: getBreakpointsWithStatus active flag', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.addBreakpoint(1);
  deepStrictEqual(app.getBreakpointsWithStatus(), [
    { column: 0, active: true }, { column: 1, active: false },
  ]);
  app.stepDebugger();
  deepStrictEqual(app.getBreakpointsWithStatus(), [
    { column: 0, active: false }, { column: 1, active: true },
  ]);
});

test('debugger: clearAllBreakpoints', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.addBreakpoint(1);
  strictEqual(app.getBreakpoints().length, 2);
  app.clearAllBreakpoints();
  strictEqual(app.getBreakpoints().length, 0);
  ok(!app.hasBreakpoint(0));
});

test('debugger: seek/getCurrentStep/getTotalSteps/isAtStart/isAtEnd', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  strictEqual(app.getTotalSteps(), 1);
  ok(app.isAtEnd());
  ok(!app.isAtStart());
  app.seek(0);
  strictEqual(app.getCurrentStep(), 0);
  ok(app.isAtStart());
  ok(!app.isAtEnd());
});

test('debugger: runToBreakpoint stops at breakpoint', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.runToBreakpoint();
  strictEqual(app.getDebuggerStep(), 0);
});
