// =============================================================================
// test/debugger/BreakpointManager.test.js
// -----------------------------------------------------------------------------
// Mirrors src/debugger/BreakpointManager.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws, deepStrictEqual } from 'assert';
import { BreakpointManager } from '../../src/debugger/BreakpointManager.js';
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

function buildTrace(circuit) {
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return new StepTrace(schedule, circuit.numQubits);
}

// ---------------------------------------------------------------------------
// Construction & basic API
// ---------------------------------------------------------------------------

test('BreakpointManager constructs with StepTrace', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  ok(bm instanceof BreakpointManager);
  strictEqual(bm.isEnabled(), true);
});

test('BreakpointManager throws on invalid StepTrace', () => {
  throws(() => new BreakpointManager(null), TypeError);
  throws(() => new BreakpointManager({}), TypeError);
});

// ---------------------------------------------------------------------------
// Global enable/disable
// ---------------------------------------------------------------------------

test('BreakpointManager setEnabled toggles global state', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.setEnabled(false);
  strictEqual(bm.isEnabled(), false);
  bm.setEnabled(true);
  strictEqual(bm.isEnabled(), true);
});

test('BreakpointManager checkBreakpoints returns null when disabled', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(1);
  bm.setEnabled(false);
  strictEqual(bm.checkBreakpoints(1), null);
});

// ---------------------------------------------------------------------------
// Column breakpoints
// ---------------------------------------------------------------------------

test('BreakpointManager addColumnBreakpoint adds and returns true', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  ok(bm.addColumnBreakpoint(1));
  ok(bm.hasColumnBreakpoint(1));
});

test('BreakpointManager addColumnBreakpoint returns false for duplicate', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(1);
  strictEqual(bm.addColumnBreakpoint(1), false);
});

test('BreakpointManager addColumnBreakpoint throws on invalid column', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  throws(() => bm.addColumnBreakpoint(-1), TypeError);
  throws(() => bm.addColumnBreakpoint(1.5), TypeError);
  throws(() => bm.addColumnBreakpoint('a'), TypeError);
  throws(() => bm.addColumnBreakpoint(100), RangeError); // exceeds schedule length
});

test('BreakpointManager removeColumnBreakpoint removes and returns true', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(1);
  ok(bm.removeColumnBreakpoint(1));
  strictEqual(bm.hasColumnBreakpoint(1), false);
});

test('BreakpointManager removeColumnBreakpoint returns false for missing', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  strictEqual(bm.removeColumnBreakpoint(1), false);
});

test('BreakpointManager toggleColumnBreakpoint toggles on/off', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  ok(bm.toggleColumnBreakpoint(1)); // on
  ok(bm.hasColumnBreakpoint(1));
  strictEqual(bm.toggleColumnBreakpoint(1), false); // off
  strictEqual(bm.hasColumnBreakpoint(1), false);
});

test('BreakpointManager getColumnBreakpoints returns sorted array', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(2);
  bm.addColumnBreakpoint(0);
  bm.addColumnBreakpoint(1);
  deepStrictEqual(bm.getColumnBreakpoints(), [0, 1, 2]);
});

test('BreakpointManager clearColumnBreakpoints clears all', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(0);
  bm.addColumnBreakpoint(1);
  bm.clearColumnBreakpoints();
  strictEqual(bm.getColumnBreakpoints().length, 0);
});

// ---------------------------------------------------------------------------
// Predicate breakpoints
// ---------------------------------------------------------------------------

test('BreakpointManager addPredicateBreakpoint adds and returns true', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  const pred = (re, im, step) => step === 2;
  ok(bm.addPredicateBreakpoint('entangled', pred));
  ok(bm.hasPredicateBreakpoint('entangled'));
});

test('BreakpointManager addPredicateBreakpoint returns false for duplicate id', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  const pred = (re, im, step) => step === 2;
  bm.addPredicateBreakpoint('entangled', pred);
  strictEqual(bm.addPredicateBreakpoint('entangled', pred), false);
});

test('BreakpointManager addPredicateBreakpoint throws on invalid id', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  throws(() => bm.addPredicateBreakpoint('', () => true), TypeError);
  throws(() => bm.addPredicateBreakpoint(123, () => true), TypeError);
});

test('BreakpointManager addPredicateBreakpoint throws on non-function predicate', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  throws(() => bm.addPredicateBreakpoint('test', null), TypeError);
  throws(() => bm.addPredicateBreakpoint('test', 'not a function'), TypeError);
});

test('BreakpointManager removePredicateBreakpoint removes and returns true', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addPredicateBreakpoint('test', () => true);
  ok(bm.removePredicateBreakpoint('test'));
  strictEqual(bm.hasPredicateBreakpoint('test'), false);
});

test('BreakpointManager togglePredicateBreakpoint removes existing', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addPredicateBreakpoint('test', () => true);
  strictEqual(bm.togglePredicateBreakpoint('test'), false);
  strictEqual(bm.hasPredicateBreakpoint('test'), false);
});

test('BreakpointManager getPredicateBreakpointIds returns all ids', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addPredicateBreakpoint('a', () => true);
  bm.addPredicateBreakpoint('b', () => true);
  deepStrictEqual(bm.getPredicateBreakpointIds().sort(), ['a', 'b']);
});

test('BreakpointManager clearPredicateBreakpoints clears all', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addPredicateBreakpoint('a', () => true);
  bm.clearPredicateBreakpoints();
  strictEqual(bm.getPredicateBreakpointIds().length, 0);
});

// ---------------------------------------------------------------------------
// checkBreakpoints
// ---------------------------------------------------------------------------

test('BreakpointManager checkBreakpoints returns column breakpoint at step', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(1);
  trace.next(); // step 1
  strictEqual(bm.checkBreakpoints(1), 1);
});

test('BreakpointManager checkBreakpoints returns null when no match', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(2);
  trace.next(); // step 1
  strictEqual(bm.checkBreakpoints(1), null);
});

test('BreakpointManager checkBreakpoints detects predicate match', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addPredicateBreakpoint('bell', (re, im, step) => step === 2 && re[0] > 0 && re[3] > 0);
  trace.next(); // step 1
  trace.next(); // step 2 - Bell state
  strictEqual(bm.checkBreakpoints(2), 'bell');
});

test('BreakpointManager checkBreakpoints returns null for predicate at wrong step', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addPredicateBreakpoint('bell', (re, im, step) => step === 2 && re[0] > 0 && re[3] > 0);
  trace.next(); // step 1
  strictEqual(bm.checkBreakpoints(1), null);
});

// ---------------------------------------------------------------------------
// findNextBreakpoint / findPreviousBreakpoint
// ---------------------------------------------------------------------------

test('BreakpointManager findNextBreakpoint finds next column breakpoint', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(0);
  bm.addColumnBreakpoint(2);
  strictEqual(bm.findNextBreakpoint(0), 2);
  strictEqual(bm.findNextBreakpoint(1), 2);
  strictEqual(bm.findNextBreakpoint(2), -1);
});

test('BreakpointManager findPreviousBreakpoint finds previous column breakpoint', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(0);
  bm.addColumnBreakpoint(2);
  strictEqual(bm.findPreviousBreakpoint(2), 0);
  strictEqual(bm.findPreviousBreakpoint(1), 0);
  strictEqual(bm.findPreviousBreakpoint(0), -1);
});

test('BreakpointManager findNext/Previous return -1 when disabled', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(1);
  bm.setEnabled(false);
  strictEqual(bm.findNextBreakpoint(0), -1);
  strictEqual(bm.findPreviousBreakpoint(2), -1);
});

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

test('BreakpointManager clearAll clears both column and predicate breakpoints', () => {
  const trace = buildTrace(bellCircuit(2));
  const bm = new BreakpointManager(trace);
  bm.addColumnBreakpoint(1);
  bm.addPredicateBreakpoint('test', () => true);
  bm.clearAll();
  strictEqual(bm.getColumnBreakpoints().length, 0);
  strictEqual(bm.getPredicateBreakpointIds().length, 0);
});