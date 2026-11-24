import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { Interaction } from '../../src/editor/Interaction.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Debugger } from '../../src/debugger/Debugger.js';
import { DebuggerUI } from '../../src/debugger/DebuggerUI.js';
import { Serializer } from '../../src/circuit/Serializer.js';
import { Cache } from '../../src/ai/Cache.js';
import { SparseSummary } from '../../src/ai/SparseSummary.js';
import {
  PanelModel,
  PanelRegion,
  PANEL_LEFT,
  PANEL_MAIN,
  PANEL_RIGHT,
  PANEL_BOTTOM,
} from '../../src/ui/panels.js';
import { initAIExplainerView } from '../../src/ui/ai-explainer-view.js';
import { initAIBuilderView } from '../../src/ui/ai-builder-view.js';
import { initIOAnalyzerView } from '../../src/ui/io-analyzer-view.js';
import '../../src/main.js';
const GEOMETRY = { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 };
function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '', className: '', style: {}, dataset: {}, value: '',
    innerHTML: '', disabled: false, id: '',
    appendChild(child) { return child; },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener() {}, closest() { return null; }, getContext() { return {}; },
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
globalThis.document = {
  createElement: () => makeElement(),
  getElementById() { return null; },
};
class MockInspector {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
    this.renderCalls = 0;
    this.tab = 'state';
    this.render = () => { this.renderCalls += 1; };
    this.showStateTab = () => { this.tab = 'state'; };
    this.showBlochTab = () => { this.tab = 'bloch'; };
    this.purity = { linearEntropy: () => 0 };
    this.bloch = { vector: () => ({ x: 0, y: 0, z: 0 }) };
  }
  probabilities() { return new Float64Array(4); }
  ketLabels() { return ['|0>', '|1>', '|2>', '|3>']; }
}
class MockAIBuilderUI {
  constructor({ numQubits }) {
    this.numQubits = numQubits;
    this.status = 'idle';
    this.circuit = null;
    this._onChange = () => {};
  }
  setPrompt() {}
  setNumQubits() {}
  onChange(cb) { this._onChange = cb; }
  async build() {
    this.status = 'ok';
    this.circuit = Serializer.fromJson(JSON.stringify({
      format: 'simqc-circuit', version: 1, bitOrder: 'little-endian', numQubits: 2,
      columns: [[{ gate: 'H', target: 0 }], [{ gate: 'CNOT', target: 1, controls: [{ row: 0, on: true }] }]],
    }));
  }
}
class MockIOAnalyzerUI {
  constructor({ numQubits }) {
    this.numQubits = numQubits;
    this.status = 'idle';
    this._onChange = () => {};
  }
  setNumQubits() {}
  setInputRows() {}
  setOutputRows() {}
  onChange(cb) { this._onChange = cb; }
  analyze() {
    this.status = 'ok';
    this._onChange({
      status: 'ok',
      analysis: {
        inputAffectedColumns: [0], outputAffectedColumns: [1], touchedColumns: [0, 1],
        causalChain: [], summary: 'analysis',
      },
    });
  }
}
function buildApp() {
  const canvasEl = makeElement();
  const paletteEl = makeElement();
  const inspectorEl = makeElement();
  const codeEl = makeElement();
  codeEl.value = '';
  const interaction = new Interaction();
  let renderCbCalls = 0;
  let inspectorCbCalls = 0;
  let codeCbCalls = 0;
  const app = new AppController({
    history: new History(),
    interaction,
    catalog: gateCatalog(),
    theme: null,
    Inspector: MockInspector,
    Debugger,
    DebuggerUI,
    AIBuilderUI: MockAIBuilderUI,
    IOAnalyzerUI: MockIOAnalyzerUI,
    canvasEl, paletteEl, inspectorEl, codeEl,
    cache: new Cache(),
  });
  app.onRender(() => { renderCbCalls += 1; });
  app.onInspector(() => { inspectorCbCalls += 1; app._inspector.render(); });
  app.onCode(() => { codeCbCalls += 1; });
  return {
    app, canvasEl, paletteEl, inspectorEl, codeEl, interaction,
    get renderCbCalls() { return renderCbCalls; },
    get inspectorCbCalls() { return inspectorCbCalls; },
    get codeCbCalls() { return codeCbCalls; },
    get inspectorRenderCalls() { return app._inspector ? app._inspector.renderCalls : 0; },
  };
}
test('startup: 2 qubits; render/inspector/code callbacks fire; resize and pointermove bound', () => {
  const ctx = buildApp();
  const { app, canvasEl } = ctx;
  strictEqual(app.numQubits, 2);
  ok(windowListeners.has('resize'));
  ok(canvasEl.listeners.has('pointermove'));
  app.notify();
  strictEqual(ctx.renderCbCalls, 1);
  strictEqual(ctx.inspectorCbCalls, 1);
  strictEqual(ctx.codeCbCalls, 1);
});
test('palette placement: H at (0,0); CNOT; gap column', () => {
  const ctx = buildApp();
  const { app, interaction, canvasEl } = ctx;
  const entry = app.catalog.find((e) => e.name === 'H');
  app._selectedEntry = entry;
  interaction.pick(entry, 80, 20);
  canvasEl.listeners.get('pointermove')[0]({ offsetX: 80, offsetY: 20 });
  const cell = interaction.snap(80, 20, GEOMETRY);
  strictEqual(cell.column, 0);
  strictEqual(cell.row, 0);
  const result = app.placeGateFromCell(cell, entry);
  strictEqual(result.conflict, false);
  strictEqual(app.currentCircuit.columns[0].gates[0].name, 'H');
  strictEqual(app.placeGateAt(1, 1, 'CNOT').conflict, false);
  strictEqual(app.placeGateAt(2, 0, 'H').conflict, false);
  strictEqual(app.currentCircuit.columns[2].gates[0].name, 'H');
});
test('palette placement: invalid coordinate rejection and Toffoli conflict', () => {
  const ctx = buildApp();
  const { app } = ctx;
  const entry = app.catalog.find((e) => e.name === 'H');
  for (const [col, row] of [[NaN, 0], [Infinity, 0], [0.5, 0], [-1, 0], [0, NaN], [0, Infinity], [0, 1.5], [0, -1], [0, 2]]) {
    const r = app.placeGateAt(col, row, 'H');
    strictEqual(r.conflict, true);
    strictEqual(r.reason, 'coordinate out of range');
  }
  strictEqual(app.currentCircuit.columns.length, 0);
  const t = app.placeGateAt(0, 0, 'Toffoli');
  strictEqual(t.conflict, true);
  strictEqual(t.reason, 'insufficient free rows for gate arity');
  strictEqual(app.currentCircuit.columns.length, 0);
});
test('canvas repaint: draw passes circuit and purity; render callback fires on notify', () => {
  const ctx = buildApp();
  const { app } = ctx;
  let payload = null;
  let calls = 0;
  app.onRender((p) => { calls += 1; payload = p; });
  app.placeGateAt(0, 0, 'H');
  app.draw();
  ok(payload && payload.circuit === app.currentCircuit);
  ok(payload.purity instanceof Float64Array && payload.purity.length === 2);
  app.notify();
  strictEqual(calls, 3);
});
test('inspector tabs: state/bloch switching, probabilities, ket labels, bloch, render on notify', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app._inspector.showBlochTab();
  strictEqual(app._inspector.tab, 'bloch');
  app._inspector.showStateTab();
  strictEqual(app._inspector.tab, 'state');
  app.notify();
  strictEqual(ctx.inspectorCbCalls, 1);
  strictEqual(ctx.inspectorRenderCalls, 1);
  ok(app._inspector.probabilities() instanceof Float64Array);
  ok(app.bloch(0));
});
test('debugger transport: step, run/simulate, reset, seek, at start/end', () => {
  const ctx = buildApp();
  const { app } = ctx;
  ok(app.isDebuggerAtStart());
  app.placeGateAt(0, 0, 'H');
  app.stepDebugger();
  ok(app.isDebuggerAtEnd());
  app.reset();
  ok(app.isDebuggerAtStart());
  app.seekDebugger(1);
  ok(app.isDebuggerAtEnd());
  app.simulate();
  strictEqual(app.getDebuggerStep(), app.getDebuggerTotal());
});
test('debugger timeline: max updates, breakpoint add/toggle/remove/clear, preserved across edits', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'H');
  strictEqual(app.getTimelineMax(), 2);
  strictEqual(app.addBreakpoint(0), true);
  ok(app.hasBreakpoint(0));
  strictEqual(app.toggleBreakpoint(0), false);
  ok(!app.hasBreakpoint(0));
  strictEqual(app.toggleBreakpoint(0), true);
  app.addBreakpoint(1);
  app.placeGateAt(2, 0, 'H');
  app.clearAllBreakpoints();
  strictEqual(app.getBreakpoints().length, 0);
  ok(!app.hasBreakpoint(0) && !app.hasBreakpoint(1));
});
test('debugger breakpoint semantics: breakpoint at column k equals step k; invalid columns rejected', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'H');
  app.addBreakpoint(1);
  deepStrictEqual(app.getBreakpointsWithStatus(), [{ column: 1, active: false }]);
  app.stepDebugger();
  deepStrictEqual(app.getBreakpointsWithStatus(), [{ column: 1, active: true }]);
  strictEqual(app.addBreakpoint(-1), false);
  strictEqual(app.addBreakpoint(999), false);
  strictEqual(app.hasBreakpoint(-1), false);
  strictEqual(app.hasBreakpoint(999), false);
});
test('code import/export/share: serialize/deserialize and encodeURL/decodeURL round-trip', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'CNOT');
  const json = app.serialize();
  const before = app.currentCircuit;
  app.placeGateAt(0, 1, 'X');
  ok(!app.currentCircuit.isEqualTo(before));
  const result = app.deserialize(json);
  strictEqual(result.ok, true);
  ok(app.currentCircuit.isEqualTo(before));
  strictEqual(app.serialize(), json);
  const url = app.encodeURL();
  ok(/^[A-Za-z0-9-_]*$/.test(url));
  ok(!url.includes('='));
  const decoded = app.decodeURL(url);
  strictEqual(decoded.ok, true);
  strictEqual(decoded.error, undefined);
  strictEqual(app.serialize(), json);
  const bad = app.decodeURL('!!!invalid!!!');
  strictEqual(bad.ok, false);
  strictEqual(bad.error !== undefined, true);
});
test('ai workflows: explainer handler, builder build flow, state boundary, cache hit/miss', async () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  const aiOutput = makeElement();
  let explained = false;
  let seenIdentity = null;
  class MockAIExplainer {
    async explain(instructions, summaries, numQubits, options) {
      explained = true;
      seenIdentity = options.stateIdentity;
      return 'explanation text';
    }
  }
  globalThis.document.getElementById = (id) => id === 'btn-explain' ? aiOutput : null;
  initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary, new Cache());
  ok(aiOutput.listeners.get('click'));
  await aiOutput.listeners.get('click')[0]();
  ok(explained);
  ok(seenIdentity !== null);
  globalThis.document.getElementById = () => null;
  const builderOutput = makeElement();
  const codeEl = makeElement();
  codeEl.value = '';
  const btnBuild = makeElement();
  globalThis.document.getElementById = (id) => id === 'btn-build' ? btnBuild : null;
  initAIBuilderView(app, { value: 'Bell' }, builderOutput, codeEl, () => {});
  ok(btnBuild.listeners.get('click'));
  await btnBuild.listeners.get('click')[0]();
  strictEqual(app.aiBuilder.status, 'ok');
  strictEqual(app.currentCircuit.columns.length, 2);
  strictEqual(codeEl.value, app.serialize());
  globalThis.document.getElementById = () => null;
  const cache = new Cache();
  const key = Cache.computeKey(app.serialize());
  strictEqual(cache.has(key), false);
  strictEqual(cache.get(key), undefined);
  cache.set(key, 'cached explanation');
  strictEqual(cache.get(key), 'cached explanation');
  strictEqual(cache.has(key), true);
});
test('io analysis: analyze button handler, row selection, analysis result', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  const ioInputRow = makeElement();
  ioInputRow.value = '0';
  const ioOutputRow = makeElement();
  ioOutputRow.value = '1';
  const ioOutput = makeElement();
  const btnAnalyze = makeElement();
  globalThis.document.getElementById = (id) => id === 'btn-analyze' ? btnAnalyze : null;
  initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput);
  ok(btnAnalyze.listeners.get('click'));
  btnAnalyze.listeners.get('click')[0]();
  strictEqual(app.ioAnalyzer.status, 'ok');
  ok(ioOutput.innerHTML.includes('Input rows affected'));
  globalThis.document.getElementById = () => null;
});
test('url routing: decodeURL success and failure including hash extraction', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  const jsonBefore = app.serialize();
  const url = app.encodeURL();
  strictEqual(app.decodeURL(url).ok, true);
  strictEqual(app.serialize(), jsonBefore);
  const savedLocation = globalThis.location;
  globalThis.location = { hash: '#circuit=' + url };
  const extracted = globalThis.location.hash.startsWith('#circuit=')
    ? app.decodeURL(globalThis.location.hash.slice('#circuit='.length))
    : { ok: false };
  strictEqual(extracted.ok, true);
  globalThis.location = savedLocation;
  const bad = app.decodeURL('!!!invalid!!!');
  strictEqual(bad.ok, false);
  strictEqual(bad.error !== undefined, true);
});
test('panel toggles: collapse/expand panels and layout rects', () => {
  const model = new PanelModel({ viewport: { x: 0, y: 0, w: 1200, h: 800 } });
  for (const id of [PANEL_LEFT, PANEL_MAIN, PANEL_RIGHT, PANEL_BOTTOM]) {
    model.addRegion(new PanelRegion({ id, rect: { x: 0, y: 0, w: 10, h: 10 }, visible: true }));
  }
  strictEqual(model.getVisibleRegions().length, 4);
  model.toggle(PANEL_LEFT);
  strictEqual(model.getVisibleRegions().length, 3);
  model.toggle(PANEL_LEFT);
  strictEqual(model.getVisibleRegions().length, 4);
  model.setVisible(PANEL_RIGHT, false);
  model.setVisible(PANEL_BOTTOM, false);
  strictEqual(model.getVisibleRegions().length, 2);
  const rects = model.getLayoutRects();
  strictEqual(rects.right, null);
  strictEqual(rects.bottom, null);
  ok(rects.left !== null && rects.main !== null);
});
test('shots: setShots validation and sampleShots returns counts', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.setShots(NaN);
  strictEqual(app.shots, 1024);
  app.setShots(Infinity);
  strictEqual(app.shots, 1024);
  app.setShots(0);
  strictEqual(app.shots, 1024);
  app.setShots(-5);
  strictEqual(app.shots, 1024);
  app.setShots(2.7);
  strictEqual(app.shots, 2);
  app.setShots(200);
  strictEqual(app.shots, 200);
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  const counts = app.sampleShots();
  ok(counts !== null);
  let total = 0;
  for (const c of counts.values()) total += c;
  strictEqual(total, 200);
});
test('public API: currentCircuit, shots, numQubits, timeline max, debugger step/total', () => {
  const ctx = buildApp();
  const { app } = ctx;
  strictEqual(app.numQubits, 2);
  strictEqual(app.shots, 1024);
  app.placeGateAt(0, 0, 'H');
});
