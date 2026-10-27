// =============================================================================
// test/debugger/Debugger.test.js
// -----------------------------------------------------------------------------
// Mirrors src/debugger/Debugger.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws, deepStrictEqual } from 'assert';
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

function buildTrace(circuit) {
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  return new StepTrace(schedule, circuit.numQubits);
}

function buildDebugger(circuit) {
  const trace = buildTrace(circuit);
  return new Debugger(trace);
}

const INV_SQRT2 = 1 / Math.sqrt(2);

// ---------------------------------------------------------------------------
// Construction & basic API
// ---------------------------------------------------------------------------

test('Debugger constructs with StepTrace', () => {
  const trace = buildTrace(bellCircuit(2));
  const dbg = new Debugger(trace);
  ok(dbg instanceof Debugger);
  strictEqual(dbg.getCurrentStep(), 0);
  strictEqual(dbg.getTotalSteps(), 2);
  strictEqual(dbg.getNumQubits(), 2);
  strictEqual(dbg.getMode(), 'dense');
  strictEqual(dbg.isAtStart(), true);
  strictEqual(dbg.isAtEnd(), false);
});

test('Debugger constructs in Ephemeral Mode for n=13', () => {
  const trace = buildTrace(bellCircuit(13));
  const dbg = new Debugger(trace);
  strictEqual(dbg.getMode(), 'ephemeral');
});

test('Debugger throws on invalid StepTrace', () => {
  throws(() => new Debugger(null), TypeError);
  throws(() => new Debugger({}), TypeError);
});

// ---------------------------------------------------------------------------
// Playback Controls (M4.1)
// ---------------------------------------------------------------------------

test('Debugger reset() returns to |0...0> at step 0', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  strictEqual(dbg.getCurrentStep(), 2);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);

  dbg.reset();
  strictEqual(dbg.getCurrentStep(), 0);
  strictEqual(dbg.getCurrentState().getRe(0), 1);
  strictEqual(dbg.getCurrentState().getRe(1), 0);
  strictEqual(dbg.getCurrentState().getRe(2), 0);
  strictEqual(dbg.getCurrentState().getRe(3), 0);
  ok(dbg.isAtStart());
});

test('Debugger next() advances one step at a time', () => {
  const dbg = buildDebugger(bellCircuit(2));

  // Step 0: |00>
  strictEqual(dbg.getCurrentStep(), 0);

  // Step 1: H on q0 -> |+0> = (|00> + |01>)/sqrt(2)
  dbg.next();
  strictEqual(dbg.getCurrentStep(), 1);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(1) - INV_SQRT2) < 1e-12);
  strictEqual(dbg.getCurrentState().getRe(2), 0);
  strictEqual(dbg.getCurrentState().getRe(3), 0);

  // Step 2: CNOT(0->1) -> Bell state
  dbg.next();
  strictEqual(dbg.getCurrentStep(), 2);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(3) - INV_SQRT2) < 1e-12);
  strictEqual(dbg.getCurrentState().getRe(1), 0);
  strictEqual(dbg.getCurrentState().getRe(2), 0);
  ok(dbg.isAtEnd());
});

test('Debugger next() stops at end', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  const step = dbg.next(); // should not advance past end
  strictEqual(step, 2);
  ok(dbg.isAtEnd());
});

test('Debugger seek() jumps to target column (Dense Mode O(1))', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next(); // step 2

  // Seek back to step 1
  dbg.seek(1);
  strictEqual(dbg.getCurrentStep(), 1);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(1) - INV_SQRT2) < 1e-12);

  // Seek forward to step 2
  dbg.seek(2);
  strictEqual(dbg.getCurrentStep(), 2);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(3) - INV_SQRT2) < 1e-12);

  // Seek to step 0
  dbg.seek(0);
  strictEqual(dbg.getCurrentStep(), 0);
  strictEqual(dbg.getCurrentState().getRe(0), 1);
});

test('Debugger seek() clamps to valid range', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.seek(100);
  strictEqual(dbg.getCurrentStep(), 2);
  dbg.seek(-1);
  strictEqual(dbg.getCurrentStep(), 0);
});

test('Debugger seek() throws on invalid input', () => {
  const dbg = buildDebugger(bellCircuit(2));
  throws(() => dbg.seek(1.5), TypeError);
  throws(() => dbg.seek('a'), TypeError);
});

test('Debugger seek() works in Ephemeral Mode (zero-allocation fast-forward)', () => {
  const dbg = buildDebugger(bellCircuit(13));
  dbg.seek(2);
  strictEqual(dbg.getCurrentStep(), 2);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(3) - INV_SQRT2) < 1e-12);

  dbg.seek(0);
  strictEqual(dbg.getCurrentStep(), 0);
  strictEqual(dbg.getCurrentState().getRe(0), 1);
});

// ---------------------------------------------------------------------------
// Breakpoint Management (M4.2)
// ---------------------------------------------------------------------------

test('Debugger add/remove/toggle column breakpoints', () => {
  const dbg = buildDebugger(bellCircuit(2));
  ok(dbg.addColumnBreakpoint(1));
  ok(dbg.hasColumnBreakpoint(1));
  strictEqual(dbg.addColumnBreakpoint(1), false); // duplicate
  strictEqual(dbg.toggleColumnBreakpoint(1), false); // off
  strictEqual(dbg.hasColumnBreakpoint(1), false);
  ok(dbg.toggleColumnBreakpoint(1)); // on
  ok(dbg.hasColumnBreakpoint(1));
  ok(dbg.removeColumnBreakpoint(1));
  strictEqual(dbg.hasColumnBreakpoint(1), false);
});

test('Debugger getColumnBreakpoints returns sorted array', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(2);
  dbg.addColumnBreakpoint(0);
  dbg.addColumnBreakpoint(1);
  deepStrictEqual(dbg.getColumnBreakpoints(), [0, 1, 2]);
});

test('Debugger predicate breakpoints', () => {
  const dbg = buildDebugger(bellCircuit(2));
  ok(dbg.addPredicateBreakpoint('bell', (re, im, step) => step === 2 && re[0] > 0 && re[3] > 0));
  ok(dbg.hasPredicateBreakpoint('bell'));
  strictEqual(dbg.addPredicateBreakpoint('bell', () => true), false); // duplicate
  ok(dbg.removePredicateBreakpoint('bell'));
  strictEqual(dbg.hasPredicateBreakpoint('bell'), false);
});

test('Debugger findStepWhere delegates to StepTrace', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const found = dbg.findStepWhere((re, im, step) => {
    if (step === 0) return false;
    return re[0] > 0 && re[3] > 0; // entanglement at step 2
  });
  strictEqual(found, 2);
});

test('Debugger findStepWhere returns -1 when not found', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const found = dbg.findStepWhere((re, im, step) => re[1] === 1.0);
  strictEqual(found, -1);
});

test('Debugger breakpoints enabled/disabled globally', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(1);
  dbg.setBreakpointsEnabled(false);
  strictEqual(dbg.areBreakpointsEnabled(), false);
  dbg.next(); // step 1 - should not trigger callback
  dbg.setBreakpointsEnabled(true);
  strictEqual(dbg.areBreakpointsEnabled(), true);
});

// ---------------------------------------------------------------------------
// runToBreakpoint / runToPreviousBreakpoint
// ---------------------------------------------------------------------------

test('Debugger runToBreakpoint() stops at column breakpoint', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(1);
  const step = dbg.runToBreakpoint();
  strictEqual(step, 1);
});

test('Debugger runToBreakpoint() runs to end if no breakpoint', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const step = dbg.runToBreakpoint();
  strictEqual(step, 2);
});

test('Debugger runToPreviousBreakpoint() seeks to previous', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(0);
  dbg.addColumnBreakpoint(2);
  dbg.seek(2);
  const step = dbg.runToPreviousBreakpoint();
  strictEqual(step, 0);
});

test('Debugger runToPreviousBreakpoint() goes to start if none', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.seek(2);
  const step = dbg.runToPreviousBreakpoint();
  strictEqual(step, 0);
});

// ---------------------------------------------------------------------------
// Timeline Scrubber (M4.3)
// ---------------------------------------------------------------------------

test('Debugger getTimeline() returns Timeline instance', () => {
  const dbg = buildDebugger(bellCircuit(2));
  ok(dbg.getTimeline() !== null);
  strictEqual(typeof dbg.getTimeline().scrub, 'function');
});

test('Debugger scrub() delegates to timeline', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  dbg.scrub(1);
  strictEqual(dbg.getCurrentStep(), 1);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
});

test('Debugger scrubToStart/End delegates to timeline', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  dbg.scrubToStart();
  strictEqual(dbg.getCurrentStep(), 0);
  dbg.scrubToEnd();
  strictEqual(dbg.getCurrentStep(), 2);
});

test('Debugger peekState() delegates to timeline', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  const peeked = dbg.peekState(1);
  ok(peeked !== null);
  ok(Math.abs(peeked.getRe(0) - INV_SQRT2) < 1e-12);
  strictEqual(dbg.getCurrentStep(), 2); // unchanged
});

test('Debugger getTimelineSummary() returns metadata', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  const summary = dbg.getTimelineSummary();
  strictEqual(summary.mode, 'dense');
  strictEqual(summary.currentStep, 1);
  strictEqual(summary.totalSteps, 2);
  strictEqual(summary.numQubits, 2);
});

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

test('Debugger onStep callback fires on step changes', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const steps = [];
  dbg.onStep((step, total) => steps.push({ step, total }));
  dbg.next();
  dbg.next();
  deepStrictEqual(steps, [{ step: 1, total: 2 }, { step: 2, total: 2 }]);
});

test('Debugger onBreakpointHit callback fires on breakpoint', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const hits = [];
  dbg.onBreakpointHit((id, step) => hits.push({ id, step }));
  dbg.addColumnBreakpoint(1);
  dbg.next(); // step 1 - hits breakpoint
  dbg.next(); // step 2
  deepStrictEqual(hits, [{ id: 1, step: 1 }]);
});

test('Debugger onReset callback fires on reset', () => {
  const dbg = buildDebugger(bellCircuit(2));
  let resetCount = 0;
  dbg.onReset(() => resetCount++);
  dbg.next();
  dbg.reset();
  strictEqual(resetCount, 1);
});

test('Debugger onSeek callback fires on seek', () => {
  const dbg = buildDebugger(bellCircuit(2));
  let seekInfo = null;
  dbg.onSeek((newStep, oldStep) => { seekInfo = { newStep, oldStep }; });
  dbg.next();
  dbg.seek(0);
  deepStrictEqual(seekInfo, { newStep: 0, oldStep: 1 });
});

test('Debugger onNext callback fires on next', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const nextSteps = [];
  dbg.onNext((step) => nextSteps.push(step));
  dbg.next();
  dbg.next();
  deepStrictEqual(nextSteps, [1, 2]);
});

// ---------------------------------------------------------------------------
// State Queries
// ---------------------------------------------------------------------------

test('Debugger getCurrentState() returns read-only view', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  const state = dbg.getCurrentState();
  strictEqual(state.numQubits(), 2);
  strictEqual(state.size(), 4);
  ok(Math.abs(state.getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(state.probability(0) - 0.5) < 1e-12);
});

test('Debugger isAtStart/isAtEnd reflect position', () => {
  const dbg = buildDebugger(bellCircuit(2));
  ok(dbg.isAtStart());
  strictEqual(dbg.isAtEnd(), false);
  dbg.next();
  dbg.next();
  strictEqual(dbg.isAtStart(), false);
  ok(dbg.isAtEnd());
});