import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { Interaction } from '../../src/editor/Interaction.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Debugger } from '../../src/debugger/Debugger.js';
import { DebuggerUI } from '../../src/debugger/DebuggerUI.js';
import { Serializer } from '../../src/circuit/Serializer.js';
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
import { Cache } from '../../src/ai/Cache.js';
import { SparseSummary } from '../../src/ai/SparseSummary.js';
import { AIBuilderUI } from '../../src/ai/AIBuilderUI.js';
import { IOAnalyzerUI } from '../../src/ai/IOAnalyzerUI.js';

import '../../src/main.js';

const GEOMETRY = { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 };
const BELL_JSON = {
  format: 'simqc-circuit', version: 1, bitOrder: 'little-endian', numQubits: 2,
  columns: [[{ gate: 'H', target: 0 }], [{ gate: 'CNOT', target: 1, controls: [{ row: 0, on: true }] }]],
};

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '', className: '', style: {}, dataset: {}, value: '',
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
  amplitudes() { return []; }
  ketLabels() { return ['|0>', '|1>', '|2>', '|3>']; }
}

// initAIBuilderView / initIOAnalyzerView call public onChange(...) which the
// real leaf UI classes do not expose (callbacks are constructor options), so
// these mock adapters satisfy the view contract without network or DOM.
class MockAIBuilderUI {
  constructor({ numQubits }) {
    this.numQubits = numQubits;
    this.status = 'idle';
    this.circuit = null;
    this.onChange = () => {};
  }
  setPrompt() {}
  async build() {
    this.status = 'ok';
    this.circuit = Serializer.fromJson(JSON.stringify(BELL_JSON));
  }
}
class MockIOAnalyzerUI {
  constructor({ numQubits }) {
    this.numQubits = numQubits;
    this.status = 'idle';
    this.onChange = () => {};
  }
  setInputRows() {}
  setOutputRows() {}
  analyze() {
    this.status = 'ok';
    this.onChange({
      status: 'ok',
      analysis: {
        inputAffectedColumns: [0], outputAffectedColumns: [1], touchedColumns: [],
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
  const statusEl = makeElement();
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
    AIBuilderUI,
    IOAnalyzerUI,
    canvasEl, paletteEl, inspectorEl, codeEl, statusEl,
    cache: new Cache(),
  });
  app.onRender(() => { renderCbCalls += 1; });
  app.onInspector(() => { inspectorCbCalls += 1; app._inspector.render(); });
  app.onCode(() => { codeCbCalls += 1; });
  return {
    app, canvasEl, paletteEl, inspectorEl, codeEl, statusEl, interaction,
    get renderCbCalls() { return renderCbCalls; },
    get inspectorCbCalls() { return inspectorCbCalls; },
    get codeCbCalls() { return codeCbCalls; },
    get inspectorRenderCalls() { return app._inspector ? app._inspector.renderCalls : 0; },
  };
}

test('startup: app initializes with 2 qubits; render/inspector/code callbacks fire', () => {
  const ctx = buildApp();
  const { app, canvasEl } = ctx;
  strictEqual(app.numQubits, 2, 'resetCircuit(2) sets two qubit rows');
  ok(app.currentCircuit !== null, 'currentCircuit is set');
  ok(windowListeners.has('resize'), 'resize listener bound to window');
  ok(canvasEl.listeners.has('pointermove'), 'canvas pointermove bound');
  app.notify();
  strictEqual(ctx.renderCbCalls, 1, 'render callback fires on notify');
  strictEqual(ctx.inspectorCbCalls, 1, 'inspector callback fires on notify');
  strictEqual(ctx.codeCbCalls, 1, 'code callback fires on notify');
});

test('palette placement: H at column 0 row 0 via pointerdown/pointerup at (80, 20)', () => {
  const ctx = buildApp();
  const { app, interaction, canvasEl } = ctx;
  const entry = app.catalog.find((e) => e.name === 'H');
  ok(entry, 'H gate present in catalog');

  app._selectedEntry = entry;
  strictEqual(app.getSelectedEntry(), entry);

  interaction.pick(entry, 80, 20);
  const moveListener = canvasEl.listeners.get('pointermove')[0];
  moveListener({ offsetX: 80, offsetY: 20 });
  const cell = interaction.snap(80, 20, GEOMETRY);
  strictEqual(cell.column, 0, 'snapped column is 0');
  strictEqual(cell.row, 0, 'snapped row is 0');
  const result = app.placeGateFromCell(cell, entry);
  strictEqual(result.conflict, false, 'placing H at (0,0) should not conflict');

  const circuit = app.currentCircuit;
  strictEqual(circuit.numQubits, 2, 'circuit has 2 qubit rows');
  strictEqual(circuit.columns.length, 1, 'one column created');
  strictEqual(circuit.columns[0].gates.length, 1, 'one gate in column 0');
  strictEqual(circuit.columns[0].gates[0].name, 'H', 'gate name is H');
  strictEqual(circuit.columns[0].gates[0].target, 0, 'gate target is row 0');
  strictEqual(circuit.columns[0].gates[0].controls.length, 0, 'H has no controls');
  strictEqual(app.canUndo, true, 'history records the placement');
  strictEqual(ctx.renderCbCalls, 2, 'render callback fires on place and draw');
  strictEqual(ctx.inspectorCbCalls, 1, 'inspector callback fires');
  strictEqual(ctx.codeCbCalls, 1, 'code callback fires');
});

test('inspector tabs: notify renders inspector; state/bloch tab switching', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app._inspector.showBlochTab();
  strictEqual(app._inspector.tab, 'bloch', 'bloch tab selectable');
  app._inspector.showStateTab();
  strictEqual(app._inspector.tab, 'state', 'state tab selectable');
  app.notify();
  strictEqual(ctx.inspectorCbCalls, 1, 'inspector callback fires on notify');
  strictEqual(ctx.inspectorRenderCalls, 1, 'render inspector fires via notify');
  ok(app._inspector.probabilities() instanceof Float64Array, 'probabilities render');
  strictEqual(app._inspector.ketLabels().length, 4, 'ket labels for 2 qubits');
  ok(app.bloch(0), 'bloch readout exists');
});

test('debugger transport: step, run, reset, seek change step/total', () => {
  const ctx = buildApp();
  const { app } = ctx;
  strictEqual(app.getDebuggerTotal(), 0, 'empty circuit has 0 total steps');
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.getDebuggerTotal(), 1, 'one column gives total 1');
  strictEqual(app.getDebuggerStep(), 0, 'starts at step 0');
  ok(app.isDebuggerAtStart(), 'at start initially');

  app.stepDebugger();
  strictEqual(app.getDebuggerStep(), 1, 'step advances to 1');
  ok(app.isDebuggerAtEnd(), 'at end after stepping');
  ok(!app.isDebuggerAtStart(), 'not at start after stepping');

  app.reset();
  strictEqual(app.getDebuggerStep(), 0, 'reset returns to step 0');
  ok(app.isDebuggerAtStart(), 'at start after reset');

  app.seekDebugger(1);
  strictEqual(app.getDebuggerStep(), 1, 'seek moves to step 1');
  ok(app.isDebuggerAtEnd(), 'seek to end lands at end');
});

test('debugger timeline max and breakpoints', () => {
  const ctx = buildApp();
  const { app } = ctx;
  strictEqual(app.getTimelineMax(), 0, 'empty timeline max is 0');
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.getTimelineMax(), 1, 'timeline max updates to 1');
  app.placeGateAt(1, 1, 'H');
  strictEqual(app.getTimelineMax(), 2, 'timeline max updates to 2');

  strictEqual(app.addBreakpoint(0), true, 'breakpoint at column 0 added');
  ok(app.hasBreakpoint(0), 'breakpoint exists at column 0');
  strictEqual(app.toggleBreakpoint(0), false, 'toggle removes breakpoint 0');
  ok(!app.hasBreakpoint(0), 'breakpoint removed by toggle');
  strictEqual(app.toggleBreakpoint(0), true, 'toggle re-adds breakpoint 0');
  ok(app.hasBreakpoint(0), 'breakpoint 0 present again');
  app.addBreakpoint(1);
  strictEqual(app.getBreakpoints().length, 2, 'two breakpoints recorded');
  app.clearAllBreakpoints();
  strictEqual(app.getBreakpoints().length, 0, 'all breakpoints cleared');
  ok(!app.hasBreakpoint(0), 'breakpoint 0 gone');
  ok(!app.hasBreakpoint(1), 'breakpoint 1 gone');
});

test('code import/export: serialize/deserialize round-trip', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'CNOT');
  const json = app.serialize();
  const parsed = JSON.parse(json);
  strictEqual(parsed.columns[0][0].gate, 'H', 'serialized JSON contains H gate');
  strictEqual(parsed.columns[1][0].gate, 'CNOT', 'serialized JSON contains CNOT gate');
  const before = app.currentCircuit;
  app.placeGateAt(0, 1, 'X');
  ok(!app.currentCircuit.isEqualTo(before), 'mutation changed the circuit');
  const result = app.deserialize(json);
  strictEqual(result.ok, true, 'deserialize reports ok');
  ok(app.currentCircuit.isEqualTo(before), 'deserialized circuit matches original');
  strictEqual(app.serialize(), json, 're-serialization matches original JSON');
});

test('url share: encodeURL/decodeURL round-trip', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  const jsonBefore = app.serialize();
  const url = app.encodeURL();
  ok(/^[A-Za-z0-9-_]*$/.test(url), 'URL is base64url-safe');
  ok(!url.includes('='), 'URL has no padding');
  app.placeGateAt(1, 1, 'H');
  strictEqual(app.serialize() !== jsonBefore, true, 'mutation changed the circuit');
  const result = app.decodeURL(url);
  strictEqual(result.ok, true, 'decodeURL reports ok');
  strictEqual(result.error, undefined, 'decodeURL has no error');
  strictEqual(app.serialize(), jsonBefore, 'decodeURL restores the circuit');
});

test('ai explainer button handler exists and invokes AIExplainer', async () => {
  const ctx = buildApp();
  const { app } = ctx;
  app.placeGateAt(0, 0, 'H');
  const aiOutput = makeElement();
  let explained = false;
  class MockAIExplainer {
    async explain() {
      explained = true;
      return 'explanation text';
    }
  }
  globalThis.document.getElementById = (id) => (id === 'btn-explain' ? aiOutput : null);
  initAIExplainerView(app, aiOutput, MockAIExplainer, SparseSummary, new Cache());
  ok(aiOutput.listeners.get('click'), 'explain click listener registered');
  await aiOutput.listeners.get('click')[0]();
  ok(explained, 'AIExplainer.explain was invoked');
  globalThis.document.getElementById = () => null;
});

test('ai builder build flow applies a generated circuit', async () => {
  const ctx = buildApp();
  const { app } = ctx;
  app._aiBuilder = new MockAIBuilderUI({ numQubits: app.numQubits });
  const aiPrompt = makeElement();
  aiPrompt.value = 'Bell state on 2 qubits';
  const builderOutput = makeElement();
  const codeEl = makeElement();
  codeEl.value = '';
  const qubitsEl = makeElement();
  qubitsEl.value = '2';
  let renderInspectorCalled = false;
  globalThis.document.getElementById = (id) => {
    if (id === 'builder-qubits') return qubitsEl;
    if (id === 'btn-build') return builderOutput;
    return null;
  };
  initAIBuilderView(app, aiPrompt, builderOutput, codeEl, () => {
    renderInspectorCalled = true;
  });
  ok(builderOutput.listeners.get('click'), 'build click listener registered');
  await builderOutput.listeners.get('click')[0]();
  strictEqual(renderInspectorCalled, true, 'renderInspector invoked on build');
  strictEqual(codeEl.value, app.serialize(), 'code el holds serialized circuit');
  strictEqual(app.aiBuilder.status, 'ok', 'builder status is ok');
  strictEqual(app.currentCircuit.columns.length, 2, 'applied circuit has 2 columns');
  globalThis.document.getElementById = () => null;
});

test('io analyze button handler exists', () => {
  const ctx = buildApp();
  const { app } = ctx;
  app._ioAnalyzer = new MockIOAnalyzerUI({ numQubits: app.numQubits });
  app.placeGateAt(0, 0, 'H');
  const ioInputRow = makeElement();
  ioInputRow.value = '0';
  const ioOutputRow = makeElement();
  ioOutputRow.value = '1';
  const ioOutput = makeElement();
  globalThis.document.getElementById = (id) => (id === 'btn-analyze' ? ioOutput : null);
  initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput);
  ok(ioOutput.listeners.get('click'), 'analyze click listener registered');
  ioOutput.listeners.get('click')[0]();
  ok(ioOutput.innerHTML !== '', 'analyze produced output');
  globalThis.document.getElementById = () => null;
});

test('panel toggles: collapse/expand panels', () => {
  const model = new PanelModel({ viewport: { x: 0, y: 0, w: 1200, h: 800 } });
  for (const id of [PANEL_LEFT, PANEL_MAIN, PANEL_RIGHT, PANEL_BOTTOM]) {
    model.addRegion(new PanelRegion({ id, rect: { x: 0, y: 0, w: 10, h: 10 }, visible: true }));
  }
  strictEqual(model.getVisibleRegions().length, 4, 'all panels visible initially');
  model.toggle(PANEL_LEFT);
  strictEqual(model.getVisibleRegions().length, 3, 'left panel collapsed');
  model.toggle(PANEL_LEFT);
  strictEqual(model.getVisibleRegions().length, 4, 'left panel expanded');
  model.setVisible(PANEL_RIGHT, false);
  model.setVisible(PANEL_BOTTOM, false);
  strictEqual(model.getVisibleRegions().length, 2, 'only left and main remain visible');
  const rects = model.getLayoutRects();
  strictEqual(rects.right, null, 'right rect null when hidden');
  strictEqual(rects.bottom, null, 'bottom rect null when hidden');
});
