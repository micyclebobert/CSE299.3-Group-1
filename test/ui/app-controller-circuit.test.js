import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { Serializer } from '../../src/circuit/Serializer.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Interaction } from '../../src/editor/Interaction.js';

// Seed the GateRegistry so StepTrace can resolve gate IDs during simulation.
import '../../src/main.js';

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    appendChild(child) { return child; },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener() {},
    closest() { return null; },
    getContext() { return {}; },
  };
  el.listeners = listeners;
  return el;
}

globalThis.window = { addEventListener() {} };
globalThis.document = { createElement: () => makeElement() };

class MockInspector {
  constructor(stepTrace) { this._stepTrace = stepTrace; }
}

function buildApp() {
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
    canvasEl, paletteEl, inspectorEl, codeEl, statusEl,
  });
  return { app, canvasEl, paletteEl, inspectorEl, codeEl, statusEl, interaction };
}

test('circuit: resetCircuit creates a 2-qubit empty circuit', () => {
  const { app, statusEl } = buildApp();
  strictEqual(app.numQubits, 2);
  strictEqual(app.currentCircuit.columns.length, 0);
  ok(statusEl.textContent.includes('Ready'));
});

test('circuit: placeGateAt places H at column 0, row 0 and records history', () => {
  const { app } = buildApp();
  const result = app.placeGateAt(0, 0, 'H');
  strictEqual(result.conflict, false);
  const circuit = app.currentCircuit;
  strictEqual(circuit.columns.length, 1);
  strictEqual(circuit.columns[0].gates[0].name, 'H');
  strictEqual(circuit.columns[0].gates[0].target, 0);
  strictEqual(app.canUndo, true);
});

test('circuit: placeGateAt CNOT at row 0 allocates control to row 1', () => {
  const { app } = buildApp();
  const result = app.placeGateAt(0, 0, 'CNOT');
  strictEqual(result.conflict, false);
  const g = app.currentCircuit.columns[0].gates[0];
  strictEqual(g.name, 'CNOT');
  strictEqual(g.target, 0);
  strictEqual(g.controls.length, 1);
  strictEqual(g.controls[0].row, 1);
});

test('circuit: Toffoli conflicts in a 2-qubit circuit', () => {
  const { app } = buildApp();
  const result = app.placeGateAt(0, 0, 'Toffoli');
  strictEqual(result.conflict, true);
  strictEqual(result.reason, 'insufficient free rows for gate arity');
  strictEqual(app.currentCircuit.columns.length, 0);
});

test('circuit: _tryPlace at column 5 creates 6 columns with gaps', () => {
  const { app } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');
  const result = app._tryPlace(entry, 5, 0);
  strictEqual(result.conflict, false);
  strictEqual(app.currentCircuit.columns.length, 6);
  strictEqual(app.currentCircuit.columns[5].gates[0].name, 'H');
});

test('circuit: placeGateFromCell matches _tryPlace for same coordinates', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');
  interaction.pick(entry, 80, 20);
  const cell = interaction.snap(80, 20, { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 });
  const resultA = app.placeGateFromCell(cell, entry);
  strictEqual(resultA.conflict, false);
  const circuitA = app.currentCircuit;
  app.undo();
  const resultB = app._tryPlace(entry, cell.column, cell.row);
  strictEqual(resultB.conflict, false);
  ok(circuitA.isEqualTo(app.currentCircuit));
});

test('circuit: serialize then deserialize round-trips via isEqualTo', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'CNOT');
  const json = app.serialize();
  ok(typeof json === 'string' && json.length > 0);
  const app2 = new AppController({
    history: new History(),
    interaction: new Interaction(),
    catalog: gateCatalog(),
    theme: null,
    Inspector: MockInspector,
    canvasEl: makeElement(), paletteEl: makeElement(), inspectorEl: makeElement(),
    codeEl: makeElement(), statusEl: makeElement(),
  });
  const result = app2.deserialize(json);
  strictEqual(result.ok, true);
  ok(app.currentCircuit.isEqualTo(app2.currentCircuit));
  strictEqual(app2.numQubits, 2);
});

test('circuit: deserialize invalid JSON returns ok false', () => {
  const { app, statusEl } = buildApp();
  const result = app.deserialize('not json');
  strictEqual(result.ok, false);
  ok(typeof result.error === 'string');
  ok(statusEl.textContent.includes('Import failed'));
});

// ---------------------------------------------------------------------------
// Qubit limit enforcement on deserialize
// ---------------------------------------------------------------------------

test('circuit: deserialize rejects 21-qubit circuit without mutating state', () => {
  const { app, statusEl } = buildApp();
  strictEqual(app.numQubits, 2);
  const circuit = new Circuit({ numQubits: 21, columns: [] });
  const json = Serializer.toJson(circuit);
  const result = app.deserialize(json);
  strictEqual(result.ok, false);
  strictEqual(result.error, 'qubit limit exceeded');
  ok(statusEl.textContent.includes('qubit limit exceeded'));
  strictEqual(app.numQubits, 2, 'state must not be mutated on rejected import');
});

test('circuit: deserialize rejects 24-qubit circuit without mutating state', () => {
  const { app } = buildApp();
  const circuit = new Circuit({ numQubits: 24, columns: [] });
  const json = Serializer.toJson(circuit);
  const result = app.deserialize(json);
  strictEqual(result.ok, false);
  strictEqual(result.error, 'qubit limit exceeded');
  strictEqual(app.numQubits, 2, 'state must not be mutated on rejected import');
});

test('circuit: deserialize accepts 20-qubit circuit and shows advisory', () => {
  const { app, statusEl } = buildApp();
  const circuit = new Circuit({ numQubits: 20, columns: [] });
  const json = Serializer.toJson(circuit);
  const result = app.deserialize(json);
  strictEqual(result.ok, true);
  strictEqual(app.numQubits, 20);
  ok(statusEl.textContent.includes('Advisory'), 'advisory should be shown for 20 qubits');
});

test('circuit: deserialize accepts 15-qubit circuit and shows advisory', () => {
  const { app, statusEl } = buildApp();
  const circuit = new Circuit({ numQubits: 15, columns: [] });
  const json = Serializer.toJson(circuit);
  const result = app.deserialize(json);
  strictEqual(result.ok, true);
  strictEqual(app.numQubits, 15);
  ok(statusEl.textContent.includes('Advisory'), 'advisory should be shown for 15 qubits');
});

// ---------------------------------------------------------------------------
// Qubit limit enforcement on applyCircuit
// ---------------------------------------------------------------------------

test('circuit: applyCircuit rejects 21-qubit circuit without mutating state', () => {
  const { app, statusEl } = buildApp();
  strictEqual(app.numQubits, 2);
  const circuit = new Circuit({ numQubits: 21, columns: [] });
  const result = app.applyCircuit(circuit);
  strictEqual(result.conflict, true);
  strictEqual(result.reason, 'qubit limit exceeded');
  ok(statusEl.textContent.includes('qubit limit exceeded'));
  strictEqual(app.numQubits, 2, 'state must not be mutated on rejected apply');
});

test('circuit: applyCircuit rejects 24-qubit circuit without mutating state', () => {
  const { app } = buildApp();
  const circuit = new Circuit({ numQubits: 24, columns: [] });
  const result = app.applyCircuit(circuit);
  strictEqual(result.conflict, true);
  strictEqual(result.reason, 'qubit limit exceeded');
  strictEqual(app.numQubits, 2, 'state must not be mutated on rejected apply');
});

test('circuit: applyCircuit accepts 20-qubit circuit and shows advisory', () => {
  const { app, statusEl } = buildApp();
  const circuit = new Circuit({ numQubits: 20, columns: [] });
  const result = app.applyCircuit(circuit);
  strictEqual(result.conflict, false);
  strictEqual(app.numQubits, 20);
  ok(statusEl.textContent.includes('Advisory'), 'advisory should be shown for 20 qubits');
});

test('circuit: applyCircuit accepts 15-qubit circuit and shows advisory', () => {
  const { app, statusEl } = buildApp();
  const circuit = new Circuit({ numQubits: 15, columns: [] });
  const result = app.applyCircuit(circuit);
  strictEqual(result.conflict, false);
  strictEqual(app.numQubits, 15);
  ok(statusEl.textContent.includes('Advisory'), 'advisory should be shown for 15 qubits');
});
