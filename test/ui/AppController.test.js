import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Interaction, snapCell } from '../../src/editor/Interaction.js';
import { Debugger } from '../../src/debugger/Debugger.js';
import { DebuggerUI } from '../../src/debugger/DebuggerUI.js';

// Seed the GateRegistry so StepTrace can resolve gate IDs during simulation.
import '../../src/main.js';

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
  }
}

const GEOMETRY = { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 };

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
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
  });
  return { app, canvasEl, paletteEl, inspectorEl, codeEl, statusEl, interaction };
}

function buildAppWithDebugger() {
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
    Debugger,
    DebuggerUI,
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
  });
  return { app, canvasEl, paletteEl, inspectorEl, codeEl, statusEl, interaction };
}

test('snapCell maps renderer cell center (80, 20) to column 0, row 0 with renderer geometry', () => {
  const cell = snapCell(80, 20, { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 });
  strictEqual(cell.column, 0, 'column should be 0 at renderer cell center x=80');
  strictEqual(cell.row, 0, 'row should be 0 at renderer cell center y=20');
  strictEqual(cell.x, 80, 'snapped x should equal colOffset for column 0');
  strictEqual(cell.y, 20, 'snapped y should equal rowOffset for row 0');
});

test('snapCell with old browser geometry mis-maps (80, 20) to column 2, row 1 (regression guard)', () => {
  const cell = snapCell(80, 20, { colPitch: 20, rowPitch: 20, colOffset: 48, rowOffset: 10 });
  strictEqual(cell.column, 2, 'old geometry yields column 2 (incorrect)');
  strictEqual(cell.row, 1, 'old geometry yields row 1 (incorrect)');
});

test('placeGateFromCell places H at column 0, row 0 via unified drop path and records history', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');
  ok(entry, 'H gate present in catalog');

  interaction.pick(entry, 80, 20);
  const cell = interaction.snap(80, 20, GEOMETRY);
  const result = app.placeGateFromCell(cell, entry);
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

  strictEqual(app.canUndo, true, 'history records the placement so undo is available');
});

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

test('Toffoli in 2-qubit circuit conflicts due to insufficient rows', () => {
  const { app } = buildApp();
  const result = app.placeGateAt(0, 0, 'Toffoli');
  strictEqual(result.conflict, true, 'Toffoli should conflict in a 2-qubit circuit');
  strictEqual(result.reason, 'insufficient free rows for gate arity');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
});

test('placeGateAt rejects negative column with conflict', () => {
  const { app, statusEl } = buildApp();
  const result = app.placeGateAt(-1, 0, 'H');
  strictEqual(result.conflict, true, 'negative column should conflict');
  strictEqual(result.reason, 'coordinate out of range', 'reason should be coordinate out of range');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
  ok(statusEl.textContent.includes('Invalid'), 'status should report invalid coordinates');
});

test('placeGateAt rejects column beyond insertion point with conflict', () => {
  const { app, statusEl } = buildApp();
  const result = app.placeGateAt(1, 0, 'H');
  strictEqual(result.conflict, true, 'column beyond insertion point should conflict');
  strictEqual(result.reason, 'coordinate out of range', 'reason should be coordinate out of range');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
  ok(statusEl.textContent.includes('Invalid'), 'status should report invalid coordinates');
});

test('placeGateAt rejects negative row with conflict', () => {
  const { app, statusEl } = buildApp();
  const result = app.placeGateAt(0, -1, 'H');
  strictEqual(result.conflict, true, 'negative row should conflict');
  strictEqual(result.reason, 'coordinate out of range', 'reason should be coordinate out of range');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
  ok(statusEl.textContent.includes('Invalid'), 'status should report invalid coordinates');
});

test('placeGateAt rejects row >= numQubits with conflict', () => {
  const { app, statusEl } = buildApp();
  const result = app.placeGateAt(0, 2, 'H');
  strictEqual(result.conflict, true, 'row >= numQubits should conflict');
  strictEqual(result.reason, 'coordinate out of range', 'reason should be coordinate out of range');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
  ok(statusEl.textContent.includes('Invalid'), 'status should report invalid coordinates');
});

test('placeGateAt accepts column equal to length (append at insertion point)', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  const result = app.placeGateAt(1, 1, 'H');
  strictEqual(result.conflict, false, 'column at insertion point should not conflict');
  strictEqual(app.currentCircuit.columns.length, 2, 'two columns after append');
  strictEqual(app.currentCircuit.columns[1].gates[0].target, 1, 'second gate targets row 1');
});

test('_tryPlace at column 0 on empty circuit creates 1 column', () => {
  const { app } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');
  const result = app._tryPlace(entry, 0, 0);
  strictEqual(result.conflict, false, 'placing H at column 0 should not conflict');
  const circuit = app.currentCircuit;
  strictEqual(circuit.numQubits, 2, 'numQubits preserved');
  strictEqual(circuit.columns.length, 1, 'one column created');
  strictEqual(circuit.columns[0].gates.length, 1, 'column 0 holds the gate');
  strictEqual(circuit.columns[0].gates[0].name, 'H', 'gate at column 0 is H');
});

test('_tryPlace at column 2 on empty circuit creates 3 columns with empty gap columns', () => {
  const { app } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');
  const result = app._tryPlace(entry, 2, 0);
  strictEqual(result.conflict, false, 'placing at column 2 on empty circuit should not conflict');
  const circuit = app.currentCircuit;
  strictEqual(circuit.numQubits, 2, 'numQubits preserved');
  strictEqual(circuit.columns.length, 3, 'three columns created');
  strictEqual(circuit.columns[0].gates.length, 0, 'column 0 is an empty gap');
  strictEqual(circuit.columns[1].gates.length, 0, 'column 1 is an empty gap');
  strictEqual(circuit.columns[2].gates.length, 1, 'column 2 holds the gate');
  strictEqual(circuit.columns[2].gates[0].name, 'H', 'gate at column 2 is H');
  strictEqual(circuit.columns[2].gates[0].target, 0, 'gate at column 2 targets row 0');
});

test('_tryPlace at column 5 creates 6 columns with gaps', () => {
  const { app } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');
  const result = app._tryPlace(entry, 5, 0);
  strictEqual(result.conflict, false, 'placing at column 5 on empty circuit should not conflict');
  const circuit = app.currentCircuit;
  strictEqual(circuit.numQubits, 2, 'numQubits preserved');
  strictEqual(circuit.columns.length, 6, 'six columns created');
  for (let i = 0; i < 5; i += 1) {
    strictEqual(circuit.columns[i].gates.length, 0, `column ${i} is an empty gap`);
  }
  strictEqual(circuit.columns[5].gates.length, 1, 'column 5 holds the gate');
  strictEqual(circuit.columns[5].gates[0].name, 'H', 'gate at column 5 is H');
});

test('placeGateFromCell via drop produces same circuit as _tryPlace for same coordinates', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 80, 20);
  const cell = interaction.snap(80, 20, GEOMETRY);
  const resultA = app.placeGateFromCell(cell, entry);
  strictEqual(resultA.conflict, false, 'unified drop path should not conflict');
  const circuitA = app.currentCircuit;
  app.undo();

  interaction.pick(entry, 80, 20);
  const cellB = interaction.snap(80, 20, GEOMETRY);
  const resultB = app._tryPlace(entry, cellB.column, cellB.row);
  strictEqual(resultB.conflict, false, '_tryPlace direct path should not conflict');
  const circuitB = app.currentCircuit;

  ok(circuitA.isEqualTo(circuitB), 'unified drop path yields same circuit as _tryPlace');
  strictEqual(circuitA.columns.length, circuitB.columns.length, 'column count matches');
  strictEqual(circuitA.columns[0].gates[0].name, circuitB.columns[0].gates[0].name, 'gate name matches');
  strictEqual(circuitA.columns[0].gates[0].target, circuitB.columns[0].gates[0].target, 'gate target matches');
});

test('placeGateFromCell conflicts on occupied row through unified path', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 80, 20);
  app.placeGateFromCell(interaction.snap(80, 20, GEOMETRY), entry);
  strictEqual(app.currentCircuit.columns.length, 1, 'first placement created a column');

  interaction.pick(entry, 80, 20);
  const result = app.placeGateFromCell(interaction.snap(80, 20, GEOMETRY), entry);
  strictEqual(result.conflict, true, 're-placing on occupied row should conflict');
  strictEqual(result.reason, 'row occupied in column', 'reason should be row occupied');
  strictEqual(app.currentCircuit.columns.length, 1, 'no new column created on conflict');
});

test('placeGateFromCell rejects negative column through unified path', () => {
  const { app, interaction, statusEl } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 80, 20);
  const result = app.placeGateFromCell({ column: -1, row: 0, x: 0, y: 0 }, entry);
  strictEqual(result.conflict, true, 'negative column should conflict');
  strictEqual(result.reason, 'coordinate out of range', 'reason should be coordinate out of range');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
  ok(statusEl.textContent.includes('Invalid'), 'status should report invalid coordinates');
});

test('placeGateFromCell rejects row >= numQubits through unified path', () => {
  const { app, interaction, statusEl } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 80, 20);
  const result = app.placeGateFromCell({ column: 0, row: 2, x: 80, y: 20 }, entry);
  strictEqual(result.conflict, true, 'row >= numQubits should conflict');
  strictEqual(result.reason, 'coordinate out of range', 'reason should be coordinate out of range');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
  ok(statusEl.textContent.includes('Invalid'), 'status should report invalid coordinates');
});

test('placeGateFromCell at column 2 on empty circuit creates 3 columns with gaps through unified path', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 240, 20);
  const cell = interaction.snap(240, 20, GEOMETRY);
  strictEqual(cell.column, 2, 'snapped cell column is 2');
  strictEqual(cell.row, 0, 'snapped cell row is 0');
  const result = app.placeGateFromCell(cell, entry);
  strictEqual(result.conflict, false, 'placing at column 2 on empty circuit should not conflict');
  const circuit = app.currentCircuit;
  strictEqual(circuit.numQubits, 2, 'numQubits preserved');
  strictEqual(circuit.columns.length, 3, 'three columns created');
  strictEqual(circuit.columns[0].gates.length, 0, 'column 0 is an empty gap');
  strictEqual(circuit.columns[1].gates.length, 0, 'column 1 is an empty gap');
  strictEqual(circuit.columns[2].gates.length, 1, 'column 2 holds the gate');
  strictEqual(circuit.columns[2].gates[0].name, 'H', 'gate at column 2 is H');
  strictEqual(circuit.columns[2].gates[0].target, 0, 'gate at column 2 targets row 0');
  strictEqual(app.canUndo, true, 'history records the placement');
});

test('placeGateFromCell at column 5 creates 6 columns with gaps through unified path', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 480, 20);
  const cell = interaction.snap(480, 20, GEOMETRY);
  strictEqual(cell.column, 5, 'snapped cell column is 5');
  const result = app.placeGateFromCell(cell, entry);
  strictEqual(result.conflict, false, 'placing at column 5 on empty circuit should not conflict');
  const circuit = app.currentCircuit;
  strictEqual(circuit.columns.length, 6, 'six columns created');
  for (let i = 0; i < 5; i += 1) {
    strictEqual(circuit.columns[i].gates.length, 0, `column ${i} is an empty gap`);
  }
  strictEqual(circuit.columns[5].gates.length, 1, 'column 5 holds the gate');
  strictEqual(circuit.columns[5].gates[0].name, 'H', 'gate at column 5 is H');
});

test('placeGateFromCell and _tryPlace produce equivalent circuits for gap columns', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 240, 20);
  const cell = interaction.snap(240, 20, GEOMETRY);
  const resultA = app.placeGateFromCell(cell, entry);
  strictEqual(resultA.conflict, false, 'unified drop path should not conflict at column 2');
  const circuitA = app.currentCircuit;
  app.undo();

  const resultB = app._tryPlace(entry, cell.column, cell.row);
  strictEqual(resultB.conflict, false, '_tryPlace direct path should not conflict at column 2');
  const circuitB = app.currentCircuit;

  ok(circuitA.isEqualTo(circuitB), 'unified drop path yields same circuit as _tryPlace for gap columns');
  strictEqual(circuitA.columns.length, circuitB.columns.length, 'column count matches');
  strictEqual(circuitA.columns[0].gates.length, 0, 'column 0 is an empty gap in both');
  strictEqual(circuitA.columns[1].gates.length, 0, 'column 1 is an empty gap in both');
  strictEqual(circuitA.columns[2].gates.length, 1, 'column 2 holds the gate in both');
  strictEqual(circuitA.columns[2].gates[0].name, circuitB.columns[2].gates[0].name, 'gate name matches');
  strictEqual(circuitA.columns[2].gates[0].target, circuitB.columns[2].gates[0].target, 'gate target matches');
});

test('placeGateFromCell appends at insertion point through unified path', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'H');

  interaction.pick(entry, 80, 20);
  app.placeGateFromCell(interaction.snap(80, 20, GEOMETRY), entry);
  strictEqual(app.currentCircuit.columns.length, 1, 'one column after first placement');

  interaction.pick(entry, 160, 20);
  const result = app.placeGateFromCell(interaction.snap(160, 20, GEOMETRY), entry);
  strictEqual(result.conflict, false, 'append at column === length should not conflict');
  strictEqual(app.currentCircuit.columns.length, 2, 'two columns after append');
  strictEqual(app.currentCircuit.columns[1].gates[0].target, 0, 'appended gate targets row 0');
});

test('placeGateFromCell conflicts on insufficient free rows through unified path', () => {
  const { app, interaction } = buildApp();
  const entry = app.catalog.find((e) => e.name === 'Toffoli');

  interaction.pick(entry, 80, 20);
  const result = app.placeGateFromCell(interaction.snap(80, 20, GEOMETRY), entry);
  strictEqual(result.conflict, true, 'Toffoli should conflict in a 2-qubit circuit');
  strictEqual(result.reason, 'insufficient free rows', 'reason should be insufficient free rows');
  strictEqual(app.currentCircuit.columns.length, 0, 'no column created on conflict');
});


test('simulate() without Debugger advances _stepTrace directly', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  strictEqual(app.getCurrentStep(), app.getTotalSteps());
  ok(app.isAtEnd());
});

test('simulate() routes through Debugger until end', () => {
  const { app } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  strictEqual(app.getDebuggerStep(), app.getDebuggerTotal());
  ok(app.isDebuggerAtEnd());
});

test('reset() routes through Debugger and resets step to 0', () => {
  const { app } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  strictEqual(app.getDebuggerStep(), app.getDebuggerTotal());
  app.reset();
  strictEqual(app.getDebuggerStep(), 0);
  ok(app.isDebuggerAtStart());
});

test('stepDebugger() advances step by 1 and updates DebuggerUI state', () => {
  const { app } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.getDebuggerStep(), 0);
  app.stepDebugger();
  strictEqual(app.getDebuggerStep(), 1);
  ok(!app.isDebuggerAtStart());
});


test('addBreakpoint(-1) returns false with status feedback', () => {
  const { app, statusEl } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.addBreakpoint(-1), false, 'negative column should return false');
  ok(statusEl.textContent.includes('Invalid'), 'status should report invalid breakpoint');
  strictEqual(app.hasBreakpoint(-1), false, 'no breakpoint recorded');
});

test('addBreakpoint(999) beyond schedule length returns false', () => {
  const { app, statusEl } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.addBreakpoint(999), false, 'out of range column should return false');
  ok(statusEl.textContent.includes('Invalid'), 'status should report out of range breakpoint');
  strictEqual(app.hasBreakpoint(999), false, 'no breakpoint recorded');
});

test('addBreakpoint(0) on empty circuit works', () => {
  const { app } = buildAppWithDebugger();
  strictEqual(app.getTimelineMax(), 0, 'empty circuit has max 0');
  strictEqual(app.addBreakpoint(0), true, 'breakpoint at column 0 should be added');
  ok(app.hasBreakpoint(0), 'breakpoint should exist at column 0');
});

test('getTimelineMax() returns schedule length', () => {
  const { app } = buildAppWithDebugger();
  strictEqual(app.getTimelineMax(), 0, 'empty circuit max is 0');
  app.placeGateAt(0, 0, 'H');
  strictEqual(app.getTimelineMax(), 1, 'one column gives max 1');
  app.placeGateAt(1, 1, 'H');
  strictEqual(app.getTimelineMax(), 2, 'two columns give max 2');
});

test('breakpoints preserved across circuit edit when within new schedule length', () => {
  const { app } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.addBreakpoint(1);
  strictEqual(app.getBreakpoints().length, 2);
  app.placeGateAt(1, 1, 'H');
  strictEqual(app.getBreakpoints().length, 2, 'breakpoints within new schedule preserved');
  ok(app.hasBreakpoint(0));
  ok(app.hasBreakpoint(1));
});

test('breakpoints beyond new schedule length are dropped on circuit edit', () => {
  const { app } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.addBreakpoint(1);
  app.resetCircuit(2);
  strictEqual(app.hasBreakpoint(0), true, 'breakpoint 0 still valid');
  strictEqual(app.hasBreakpoint(1), false, 'breakpoint 1 dropped beyond new schedule length');
  strictEqual(app.getBreakpoints().length, 1);
});

test('getBreakpointsWithStatus returns active flag for breakpoint at current step', () => {
  const { app } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.addBreakpoint(1);
  deepStrictEqual(app.getBreakpointsWithStatus(), [
    { column: 0, active: true },
    { column: 1, active: false },
  ]);
  app.stepDebugger();
  deepStrictEqual(app.getBreakpointsWithStatus(), [
    { column: 0, active: false },
    { column: 1, active: true },
  ]);
});

test('clearAllBreakpoints clears all breakpoints', () => {
  const { app } = buildAppWithDebugger();
  app.placeGateAt(0, 0, 'H');
  app.addBreakpoint(0);
  app.addBreakpoint(1);
  strictEqual(app.getBreakpoints().length, 2);
  app.clearAllBreakpoints();
  strictEqual(app.getBreakpoints().length, 0);
  strictEqual(app.hasBreakpoint(0), false);
  strictEqual(app.hasBreakpoint(1), false);
});

