// =============================================================================
// test/debugger/DebuggerUI.test.js
// -----------------------------------------------------------------------------
// Mirrors src/debugger/DebuggerUI.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws, deepStrictEqual } from 'assert';
import { DebuggerUI } from '../../src/debugger/DebuggerUI.js';
import { Debugger } from '../../src/debugger/Debugger.js';
import { StepTrace } from '../../src/sim/StepTrace.js';
import { flattenCircuit } from '../../src/circuit/Flatten.js';
import { scheduleColumns } from '../../src/circuit/Flatten.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';

// Seed the GateRegistry so StepTrace can resolve gate IDs.
import '../../src/main.js';

function bellCircuit(n = 2) {
  const columns = [
    new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] }),
    new GateColumn({ gates: [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })] }),
  ];
  return new Circuit({ numQubits: n, columns });
}

function buildUI(circuit) {
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const trace = new StepTrace(schedule, circuit.numQubits);
  const dbg = new Debugger(trace);
  return new DebuggerUI(dbg);
}

const INV_SQRT2 = 1 / Math.sqrt(2);

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

test('DebuggerUI constructs wrapping a Debugger', () => {
  const ui = buildUI(bellCircuit(2));
  ok(ui instanceof DebuggerUI);
  strictEqual(ui.getCurrentStep(), 0);
  strictEqual(ui.getTotalSteps(), 2);
  strictEqual(ui.getMode(), 'dense');
  strictEqual(ui.getNumQubits(), 2);
  strictEqual(ui.isAtStart(), true);
  strictEqual(ui.isAtEnd(), false);
});

test('DebuggerUI constructs in Ephemeral Mode for n=13', () => {
  const ui = buildUI(bellCircuit(13));
  strictEqual(ui.getMode(), 'ephemeral');
});

test('DebuggerUI throws on invalid Debugger', () => {
  throws(() => new DebuggerUI(null), TypeError);
  throws(() => new DebuggerUI(undefined), TypeError);
  throws(() => new DebuggerUI({}), TypeError);
});

// ---------------------------------------------------------------------------
// Transport controls
// ---------------------------------------------------------------------------

test('DebuggerUI next() advances and updates state', () => {
  const ui = buildUI(bellCircuit(2));
  strictEqual(ui.next(), 1);
  strictEqual(ui.getCurrentStep(), 1);
  strictEqual(ui.isAtStart(), false);
  strictEqual(ui.isAtEnd(), false);
  strictEqual(ui.next(), 2);
  strictEqual(ui.getCurrentStep(), 2);
  ok(ui.isAtEnd());
  strictEqual(ui.next(), 2);
});

test('DebuggerUI step() is an alias for next()', () => {
  const ui = buildUI(bellCircuit(2));
  strictEqual(ui.step(), 1);
  strictEqual(ui.getCurrentStep(), 1);
});

test('DebuggerUI reset() returns to step 0', () => {
  const ui = buildUI(bellCircuit(2));
  ui.next();
  ui.next();
  strictEqual(ui.getCurrentStep(), 2);
  strictEqual(ui.reset(), 0);
  strictEqual(ui.getCurrentStep(), 0);
  ok(ui.isAtStart());
});

test('DebuggerUI seek() jumps to target column and clamps', () => {
  const ui = buildUI(bellCircuit(2));
  ui.next();
  ui.next();
  ui.seek(1);
  strictEqual(ui.getCurrentStep(), 1);
  ui.seek(0);
  strictEqual(ui.getCurrentStep(), 0);
  ui.seek(100);
  strictEqual(ui.getCurrentStep(), 2);
});

test('DebuggerUI runToBreakpoint() stops at breakpoint', () => {
  const ui = buildUI(bellCircuit(2));
  ui.addColumnBreakpoint(1);
  strictEqual(ui.runToBreakpoint(), 1);
});

test('DebuggerUI runToBreakpoint() runs to end if none', () => {
  const ui = buildUI(bellCircuit(2));
  strictEqual(ui.runToBreakpoint(), 2);
});

test('DebuggerUI runToPreviousBreakpoint() seeks to previous', () => {
  const ui = buildUI(bellCircuit(2));
  ui.addColumnBreakpoint(0);
  ui.addColumnBreakpoint(2);
  ui.seek(2);
  strictEqual(ui.runToPreviousBreakpoint(), 0);
});

test('DebuggerUI runToPreviousBreakpoint() goes to start if none', () => {
  const ui = buildUI(bellCircuit(2));
  ui.seek(2);
  strictEqual(ui.runToPreviousBreakpoint(), 0);
});

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

test('DebuggerUI onStepChange callback fires on step changes', () => {
  const ui = buildUI(bellCircuit(2));
  const steps = [];
  ui.onStepChange((step, total) => steps.push({ step, total }));
  ui.next();
  ui.next();
  deepStrictEqual(steps, [{ step: 1, total: 2 }, { step: 2, total: 2 }]);
});

test('DebuggerUI onReset callback fires on reset', () => {
  const ui = buildUI(bellCircuit(2));
  let resets = 0;
  ui.onReset(() => resets++);
  ui.next();
  ui.reset();
  strictEqual(resets, 1);
  strictEqual(ui.getCurrentStep(), 0);
});

test('DebuggerUI onSeek callback fires on seek', () => {
  const ui = buildUI(bellCircuit(2));
  let info = null;
  ui.onSeek((newStep, oldStep) => { info = { newStep, oldStep }; });
  ui.next();
  ui.next();
  ui.seek(0);
  deepStrictEqual(info, { newStep: 0, oldStep: 2 });
});

test('DebuggerUI onNext callback fires on next', () => {
  const ui = buildUI(bellCircuit(2));
  const nexts = [];
  ui.onNext((step) => nexts.push(step));
  ui.next();
  ui.next();
  deepStrictEqual(nexts, [1, 2]);
});

test('DebuggerUI onBreakpointHit callback fires on breakpoint', () => {
  const ui = buildUI(bellCircuit(2));
  const hits = [];
  ui.onBreakpointHit((id, step) => hits.push({ id, step }));
  ui.addColumnBreakpoint(1);
  ui.next();
  deepStrictEqual(hits, [{ id: 1, step: 1 }]);
});

// ---------------------------------------------------------------------------
// Breakpoint UI model
// ---------------------------------------------------------------------------

test('DebuggerUI column breakpoints', () => {
  const ui = buildUI(bellCircuit(2));
  ok(ui.addColumnBreakpoint(1));
  ok(ui.hasColumnBreakpoint(1));
  strictEqual(ui.addColumnBreakpoint(1), false);
  strictEqual(ui.toggleColumnBreakpoint(1), false);
  strictEqual(ui.hasColumnBreakpoint(1), false);
  ok(ui.toggleColumnBreakpoint(1));
  ok(ui.hasColumnBreakpoint(1));
  ok(ui.removeColumnBreakpoint(1));
  strictEqual(ui.hasColumnBreakpoint(1), false);
});

test('DebuggerUI getColumnBreakpoints returns sorted array', () => {
  const ui = buildUI(bellCircuit(2));
  ui.addColumnBreakpoint(2);
  ui.addColumnBreakpoint(0);
  ui.addColumnBreakpoint(1);
  deepStrictEqual(ui.getColumnBreakpoints(), [0, 1, 2]);
});

test('DebuggerUI predicate breakpoints', () => {
  const ui = buildUI(bellCircuit(2));
  ok(ui.addPredicateBreakpoint('bell', (re, im, step) => step === 2 && re[0] > 0 && re[3] > 0));
  ok(ui.hasPredicateBreakpoint('bell'));
  strictEqual(ui.addPredicateBreakpoint('bell', () => true), false);
  ok(ui.removePredicateBreakpoint('bell'));
  strictEqual(ui.hasPredicateBreakpoint('bell'), false);
});

test('DebuggerUI breakpoints enabled/disabled globally', () => {
  const ui = buildUI(bellCircuit(2));
  ui.addColumnBreakpoint(1);
  ui.setBreakpointsEnabled(false);
  strictEqual(ui.areBreakpointsEnabled(), false);
  ui.setBreakpointsEnabled(true);
  strictEqual(ui.areBreakpointsEnabled(), true);
});

test('DebuggerUI clearAllBreakpoints clears both kinds', () => {
  const ui = buildUI(bellCircuit(2));
  ui.addColumnBreakpoint(1);
  ui.addPredicateBreakpoint('test', () => true);
  ui.clearAllBreakpoints();
  strictEqual(ui.getColumnBreakpoints().length, 0);
  strictEqual(ui.getPredicateBreakpointIds().length, 0);
});

test('DebuggerUI onBreakpointsChanged fires on breakpoint mutations', () => {
  const ui = buildUI(bellCircuit(2));
  let count = 0;
  ui.onBreakpointsChanged(() => count++);
  ui.addColumnBreakpoint(1);
  ui.removeColumnBreakpoint(1);
  ui.addPredicateBreakpoint('p', () => true);
  ui.setBreakpointsEnabled(false);
  strictEqual(count, 4);
});

// ---------------------------------------------------------------------------
// State queries & delegates
// ---------------------------------------------------------------------------

test('DebuggerUI getChangedSteps returns changed step indices', () => {
  const ui = buildUI(bellCircuit(2));
  ui.next();
  ui.next();
  deepStrictEqual(ui.getChangedSteps(), [1, 2]);
});

test('DebuggerUI getChangedSteps returns empty array in Ephemeral Mode', () => {
  const ui = buildUI(bellCircuit(13));
  strictEqual(ui.getChangedSteps().length, 0);
});

test('DebuggerUI getCurrentState returns read-only view', () => {
  const ui = buildUI(bellCircuit(2));
  ui.next();
  ui.next();
  const state = ui.getCurrentState();
  strictEqual(state.numQubits(), 2);
  strictEqual(state.size(), 4);
  ok(Math.abs(state.getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(state.getRe(3) - INV_SQRT2) < 1e-12);
});

test('DebuggerUI getTimeline and getBreakpointManager delegate', () => {
  const ui = buildUI(bellCircuit(2));
  ok(ui.getTimeline() !== null);
  ok(ui.getBreakpointManager() !== null);
  ok(ui.getDebugger() !== null);
});

test('DebuggerUI state accessors reflect live position', () => {
  const ui = buildUI(bellCircuit(2));
  ui.next();
  strictEqual(ui.getCurrentStep(), 1);
  strictEqual(ui.getTotalSteps(), 2);
  strictEqual(ui.getMode(), 'dense');
  strictEqual(ui.getNumQubits(), 2);
  strictEqual(ui.isAtStart(), false);
  strictEqual(ui.isAtEnd(), false);
  ui.next();
  ok(ui.isAtEnd());
});

// ---------------------------------------------------------------------------
// Callback validation
// ---------------------------------------------------------------------------

test('DebuggerUI callbacks require functions', () => {
  const ui = buildUI(bellCircuit(2));
  throws(() => ui.onStepChange(null), TypeError);
  throws(() => ui.onBreakpointHit('not a function'), TypeError);
  throws(() => ui.onReset(42), TypeError);
  throws(() => ui.onSeek({}), TypeError);
  throws(() => ui.onNext(null), TypeError);
  throws(() => ui.onBreakpointsChanged(undefined), TypeError);
});
