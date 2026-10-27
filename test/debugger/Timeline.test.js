// =============================================================================
// test/debugger/Timeline.test.js
// -----------------------------------------------------------------------------
// Mirrors src/debugger/Timeline.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws, deepStrictEqual } from 'assert';
import { Timeline } from '../../src/debugger/Timeline.js';
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

test('Timeline constructs with StepTrace', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  ok(tl instanceof Timeline);
  strictEqual(tl.getMode(), 'dense');
  strictEqual(tl.getCurrentStep(), 0);
  strictEqual(tl.getTotalSteps(), 2);
  strictEqual(tl.getNumQubits(), 2);
});

test('Timeline constructs in Ephemeral Mode for n=13', () => {
  const trace = buildTrace(bellCircuit(13));
  const tl = new Timeline(trace);
  strictEqual(tl.getMode(), 'ephemeral');
});

test('Timeline throws on invalid StepTrace', () => {
  throws(() => new Timeline(null), TypeError);
  throws(() => new Timeline({}), TypeError);
});

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

test('Timeline onScrub callback fires on scrub', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  let scrubbed = null;
  tl.onScrub((step, mode) => { scrubbed = { step, mode }; });
  tl.scrub(1);
  strictEqual(scrubbed.step, 1);
  strictEqual(scrubbed.mode, 'dense');
});

test('Timeline onStepChange callback fires on step change', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  let changed = null;
  tl.onStepChange((step, total) => { changed = { step, total }; });
  tl.scrub(1);
  strictEqual(changed.step, 1);
  strictEqual(changed.total, 2);
});

test('Timeline callbacks can be registered independently', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  let scrubCalls = 0;
  let stepCalls = 0;
  tl.onScrub(() => scrubCalls++);
  tl.onStepChange(() => stepCalls++);
  tl.scrub(1);
  strictEqual(scrubCalls, 1);
  strictEqual(stepCalls, 1);
});

// ---------------------------------------------------------------------------
// scrub() - Dense Mode O(1)
// ---------------------------------------------------------------------------

test('Timeline scrub() moves to target step in Dense Mode', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  trace.next(); // step 1
  trace.next(); // step 2
  strictEqual(tl.getCurrentStep(), 2);

  tl.scrub(1);
  strictEqual(tl.getCurrentStep(), 1);

  const state = tl.getCurrentState();
  const INV_SQRT2 = 1 / Math.sqrt(2);
  ok(Math.abs(state.getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(state.getRe(1) - INV_SQRT2) < 1e-12);
});

test('Timeline scrub() clamps to valid range', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  tl.scrub(100);
  strictEqual(tl.getCurrentStep(), 2);

  tl.scrub(-1);
  strictEqual(tl.getCurrentStep(), 0);
});

test('Timeline scrub() throws on invalid input', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  throws(() => tl.scrub(1.5), TypeError);
  throws(() => tl.scrub('a'), TypeError);
});

test('Timeline scrub() is no-op when already at target', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  let callCount = 0;
  tl.onScrub(() => callCount++);
  tl.scrub(0);
  tl.scrub(0);
  strictEqual(callCount, 1); // only fires once since step doesn't change
});

// ---------------------------------------------------------------------------
// scrub() - Ephemeral Mode (zero-allocation fast-forward)
// ---------------------------------------------------------------------------

test('Timeline scrub() works in Ephemeral Mode', () => {
  const trace = buildTrace(bellCircuit(13));
  const tl = new Timeline(trace);
  tl.scrub(2);
  strictEqual(tl.getCurrentStep(), 2);

  const state = tl.getCurrentState();
  const INV_SQRT2 = 1 / Math.sqrt(2);
  ok(Math.abs(state.getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(state.getRe(3) - INV_SQRT2) < 1e-12);
});

test('Timeline scrub() seeks back to 0 in Ephemeral Mode', () => {
  const trace = buildTrace(bellCircuit(13));
  const tl = new Timeline(trace);
  tl.scrub(2);
  tl.scrub(0);
  strictEqual(tl.getCurrentStep(), 0);
  strictEqual(tl.getCurrentState().getRe(0), 1);
});

// ---------------------------------------------------------------------------
// scrubBy()
// ---------------------------------------------------------------------------

test('Timeline scrubBy() moves forward and backward', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  tl.scrub(0);
  tl.scrubBy(1);
  strictEqual(tl.getCurrentStep(), 1);
  tl.scrubBy(1);
  strictEqual(tl.getCurrentStep(), 2);
  tl.scrubBy(-1);
  strictEqual(tl.getCurrentStep(), 1);
});

test('Timeline scrubBy() clamps at boundaries', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  tl.scrubBy(10);
  strictEqual(tl.getCurrentStep(), 2);
  tl.scrubBy(-10);
  strictEqual(tl.getCurrentStep(), 0);
});

test('Timeline scrubBy() throws on non-integer delta', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  throws(() => tl.scrubBy(1.5), TypeError);
});

// ---------------------------------------------------------------------------
// scrubToStart / scrubToEnd
// ---------------------------------------------------------------------------

test('Timeline scrubToStart() goes to step 0', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  trace.next();
  trace.next();
  tl.scrubToStart();
  strictEqual(tl.getCurrentStep(), 0);
  strictEqual(tl.getCurrentState().getRe(0), 1);
});

test('Timeline scrubToEnd() goes to final step', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  tl.scrubToEnd();
  strictEqual(tl.getCurrentStep(), 2);
});

// ---------------------------------------------------------------------------
// getCurrentState() - read-only view
// ---------------------------------------------------------------------------

test('Timeline getCurrentState() exposes read-only API', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  trace.next();
  trace.next();

  const state = tl.getCurrentState();
  strictEqual(state.numQubits(), 2);
  strictEqual(state.size(), 4);
  const INV_SQRT2 = 1 / Math.sqrt(2);
  ok(Math.abs(state.getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(state.getRe(3) - INV_SQRT2) < 1e-12);
  strictEqual(state.getRe(1), 0);
  strictEqual(state.getRe(2), 0);
  ok(Math.abs(state.probability(0) - 0.5) < 1e-12);
  ok(Math.abs(state.probability(3) - 0.5) < 1e-12);
  ok(Math.abs(state.normSquared() - 1.0) < 1e-12);

  // Should not expose mutable buffers
  strictEqual(typeof state.getRawRe, 'undefined');
  strictEqual(typeof state.getRawIm, 'undefined');
});

// ---------------------------------------------------------------------------
// peekState() - Dense Mode only
// ---------------------------------------------------------------------------

test('Timeline peekState() returns state at step without moving in Dense Mode', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  trace.next(); // step 1: H on q0 -> |+0>
  trace.next(); // step 2: Bell

  const peeked = tl.peekState(1);
  ok(peeked !== null);
  const INV_SQRT2 = 1 / Math.sqrt(2);
  ok(Math.abs(peeked.getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(peeked.getRe(1) - INV_SQRT2) < 1e-12);
  strictEqual(tl.getCurrentStep(), 2); // position unchanged
});

test('Timeline peekState() returns null for invalid step', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  strictEqual(tl.peekState(-1), null);
  strictEqual(tl.peekState(100), null);
  strictEqual(tl.peekState(1.5), null);
});

test('Timeline peekState() returns null in Ephemeral Mode', () => {
  const trace = buildTrace(bellCircuit(13));
  const tl = new Timeline(trace);
  strictEqual(tl.peekState(1), null);
});

// ---------------------------------------------------------------------------
// getChangedSteps()
// ---------------------------------------------------------------------------

test('Timeline getChangedSteps() returns steps where state changes (Dense)', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  trace.next(); // step 1
  trace.next(); // step 2

  const changed = tl.getChangedSteps();
  deepStrictEqual(changed, [1, 2]); // both steps change state from |00>
});

test('Timeline getChangedSteps() returns empty array in Ephemeral Mode', () => {
  const trace = buildTrace(bellCircuit(13));
  const tl = new Timeline(trace);
  strictEqual(tl.getChangedSteps().length, 0);
});

// ---------------------------------------------------------------------------
// getSummary()
// ---------------------------------------------------------------------------

test('Timeline getSummary() returns timeline metadata', () => {
  const trace = buildTrace(bellCircuit(2));
  const tl = new Timeline(trace);
  trace.next();

  const summary = tl.getSummary();
  strictEqual(summary.mode, 'dense');
  strictEqual(summary.currentStep, 1);
  strictEqual(summary.totalSteps, 2);
  strictEqual(summary.numQubits, 2);
  ok(Array.isArray(summary.changedSteps));
});