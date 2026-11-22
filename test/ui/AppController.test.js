import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { snapCell } from '../../src/editor/Interaction.js';

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

// Mock Inspector: constructor receives the StepTrace, no behavior needed.
class MockInspector {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
  }
}

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
    theme: null,
    Inspector: MockInspector,
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
  });
  return { app, canvasEl, paletteEl, inspectorEl, codeEl, statusEl };
}

// ---------------------------------------------------------------------------
// Browser-coordinate regression test
// ---------------------------------------------------------------------------

test('snapCell maps renderer cell center (80, 20) to column 0, row 0 with renderer geometry', () => {
  const cell = snapCell(80, 20, { colPitch: 80, rowPitch: 48, colOffset: 48, rowOffset: 20 });
  strictEqual(cell.column, 0, 'column should be 0 at renderer cell center x=80');
  strictEqual(cell.row, 0, 'row should be 0 at renderer cell center y=20');
  strictEqual(cell.x, 48, 'snapped x should equal colOffset for column 0');
  strictEqual(cell.y, 20, 'snapped y should equal rowOffset for row 0');
});

test('snapCell with old browser geometry mis-maps (80, 20) to column 2, row 1 (regression guard)', () => {
  const cell = snapCell(80, 20, { colPitch: 20, rowPitch: 20, colOffset: 48, rowOffset: 10 });
  strictEqual(cell.column, 2, 'old geometry yields column 2 (incorrect)');
  strictEqual(cell.row, 1, 'old geometry yields row 1 (incorrect)');
});

// ---------------------------------------------------------------------------
// E2E placement test
// ---------------------------------------------------------------------------

test('placeGateAt places H at column 0, row 0 and records history via _setCircuit', () => {
  const { app } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');
  ok(entry, 'H gate present in catalog');

  const result = app.placeGateAt(0, 0, 'H');
  strictEqual(result.conflict, false, 'placing H at (0,0) should not conflict');

  const circuit = app.currentCircuit;
  strictEqual(circuit.numQubits, 2, 'circuit has 2 qubit rows');
  strictEqual(circuit.columns.length, 1, 'one column created');

  const gates = circuit.columns[0].gates;
  strictEqual(gates.length, 1, 'one gate in column 0');
  strictEqual(gates[0].name, 'H', 'gate name is H');
  strictEqual(gates[0].target, 0, 'gate target is row 0');
  strictEqual(gates[0].controls.length, 0, 'H has no controls');
  strictEqual(gates[0].target2, undefined, 'H has no target2');

  // History should record the placement (_setCircuit called with record=true).
  strictEqual(app.canUndo, true, 'history records the placement so undo is available');
});

// ---------------------------------------------------------------------------
// Target row reservation test
// ---------------------------------------------------------------------------

test('CNOT at row 0 does not allocate its control to row 0 (target row reserved)', () => {
  const { app } = buildApp();
  const result = app.placeGateAt(0, 0, 'CNOT');
  strictEqual(result.conflict, false, 'CNOT placement should not conflict');

  const gates = app.currentCircuit.columns[0].gates;
  strictEqual(gates.length, 1, 'one gate in column 0');
  strictEqual(gates[0].name, 'CNOT');
  strictEqual(gates[0].target, 0, 'CNOT target is row 0');
  strictEqual(gates[0].controls.length, 1, 'CNOT has exactly one control');
  strictEqual(gates[0].controls[0].row, 1, 'control allocated to row 1, not target row 0');
  strictEqual(gates[0].controls[0].on, true, 'control is a positive control');
});

// ---------------------------------------------------------------------------
// Insufficient rows test
// ---------------------------------------------------------------------------

test('Toffoli in 2-qubit circuit conflicts due to insufficient rows', () => {
  const { app } = buildApp();
  const result = app.placeGateAt(0, 0, 'Toffoli');
  strictEqual(result.conflict, true, 'Toffoli should conflict in a 2-qubit circuit');
  strictEqual(result.reason, 'insufficient free rows for gate arity');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
});
