import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { Interaction } from '../../src/editor/Interaction.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';

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

class MockInspector {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
    this.renderCalls = 0;
    this.render = () => {
      this.renderCalls += 1;
    };
    this.purity = { linearEntropy: () => 0 };
    this.bloch = { vector: () => ({ x: 0, y: 0, z: 0 }) };
  }
  probabilities() {
    return new Float64Array(4);
  }
  amplitudes() {
    return [];
  }
  ketLabels() {
    return [];
  }
}

const GEOMETRY = { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 };

function buildApp() {
  let renderCbCalls = 0;
  let inspectorCbCalls = 0;
  let codeCbCalls = 0;
  const canvasEl = makeElement();
  const paletteEl = makeElement();
  const inspectorEl = makeElement();
  const codeEl = makeElement();
  const statusEl = makeElement();
  const interaction = new Interaction();
  const app = new AppController({
    history: new History(),
    interaction,
    catalog: gateCatalog(),
    theme: null,
    Inspector: MockInspector,
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
  });
  app.onRender(() => {
    renderCbCalls += 1;
  });
  app.onInspector(() => {
    inspectorCbCalls += 1;
    app._inspector.render();
  });
  app.onCode(() => {
    codeCbCalls += 1;
  });
  return {
    app,
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
    interaction,
    get renderCbCalls() {
      return renderCbCalls;
    },
    get inspectorCbCalls() {
      return inspectorCbCalls;
    },
    get codeCbCalls() {
      return codeCbCalls;
    },
    get inspectorRenderCalls() {
      return app._inspector ? app._inspector.renderCalls : 0;
    },
  };
}

test('places H at column 0, row 0 on pointerdown then pointerup and notifies render inspector code', () => {
  const ctx = buildApp();
  const { app, interaction } = ctx;
  const entry = app.catalog.find((e) => e.name === 'H');
  ok(entry);

  app._selectedEntry = entry;
  strictEqual(app.getSelectedEntry(), entry);

  interaction.pick(entry, 80, 20);
  const cell = interaction.snap(80, 20, GEOMETRY);
  strictEqual(cell.column, 0);
  strictEqual(cell.row, 0);
  const result = app.placeGateFromCell(cell, entry);
  strictEqual(result.conflict, false);

  const circuit = app.currentCircuit;
  strictEqual(circuit.numQubits, 2);
  strictEqual(circuit.columns.length, 1);
  strictEqual(circuit.columns[0].gates.length, 1);
  strictEqual(circuit.columns[0].gates[0].name, 'H');
  strictEqual(circuit.columns[0].gates[0].target, 0);
  strictEqual(circuit.columns[0].gates[0].controls.length, 0);

  strictEqual(ctx.renderCbCalls, 2);
  strictEqual(ctx.inspectorCbCalls, 1);
  strictEqual(ctx.codeCbCalls, 1);
  strictEqual(ctx.inspectorRenderCalls, 1);
  strictEqual(app.canUndo, true);

  const undone = app.undo();
  strictEqual(undone.columns.length, 0);
  strictEqual(app.canUndo, false);
});

test('placement at column 2 creates 3 columns with empty gap columns', () => {
  const ctx = buildApp();
  const { app, interaction } = ctx;
  const entry = app.catalog.find((e) => e.name === 'H');
  app._selectedEntry = entry;

  interaction.pick(entry, 240, 20);
  const cell = interaction.snap(240, 20, GEOMETRY);
  strictEqual(cell.column, 2);
  strictEqual(cell.row, 0);
  const result = app.placeGateFromCell(cell, entry);
  strictEqual(result.conflict, false);

  const circuit = app.currentCircuit;
  strictEqual(circuit.columns.length, 3);
  strictEqual(circuit.columns[0].gates.length, 0);
  strictEqual(circuit.columns[1].gates.length, 0);
  strictEqual(circuit.columns[2].gates.length, 1);
  strictEqual(circuit.columns[2].gates[0].name, 'H');
  strictEqual(circuit.columns[2].gates[0].target, 0);
  strictEqual(app.canUndo, true);
  strictEqual(ctx.renderCbCalls, 2);
  strictEqual(ctx.inspectorCbCalls, 1);
  strictEqual(ctx.codeCbCalls, 1);
});

test('invalid coordinates conflict and leave circuit unchanged', () => {
  const { app, statusEl } = buildApp();

  strictEqual(app.placeGateAt(-1, 0, 'H').conflict, true);
  strictEqual(app.placeGateAt(0, -1, 'H').conflict, true);
  strictEqual(app.placeGateAt(0, 2, 'H').conflict, true);
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on invalid coordinates');
  ok(statusEl.textContent.includes('Invalid'));
});

test('placeGateAt allows gap columns when column exceeds current length', () => {
  const { app } = buildApp();
  const result = app.placeGateAt(1, 0, 'H');
  strictEqual(result.conflict, false, 'gap column placement should not conflict');
  strictEqual(app.currentCircuit.columns.length, 2, 'gap column + gate column created');
  strictEqual(app.currentCircuit.columns[0].gates.length, 0, 'column 0 is an empty gap');
  strictEqual(app.currentCircuit.columns[1].gates[0].name, 'H', 'column 1 holds the gate');
});

test('CNOT placement via pointer flow allocates control to a non-target row', () => {
  const ctx = buildApp();
  const { app, interaction } = ctx;
  const entry = app.catalog.find((e) => e.name === 'CNOT');
  app._selectedEntry = entry;

  interaction.pick(entry, 80, 20);
  const cell = interaction.snap(80, 20, GEOMETRY);
  const result = app.placeGateFromCell(cell, entry);
  strictEqual(result.conflict, false);

  const gate = app.currentCircuit.columns[0].gates[0];
  strictEqual(gate.name, 'CNOT');
  strictEqual(gate.target, 0);
  strictEqual(gate.controls.length, 1);
  strictEqual(gate.controls[0].row, 1);
  strictEqual(gate.controls[0].on, true);
  strictEqual(app.canUndo, true);
  strictEqual(ctx.renderCbCalls, 2);
  strictEqual(ctx.inspectorCbCalls, 1);
  strictEqual(ctx.codeCbCalls, 1);
});
