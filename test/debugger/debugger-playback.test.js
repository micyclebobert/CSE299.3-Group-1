// =============================================================================
// test/debugger/debugger-playback.test.js
// -----------------------------------------------------------------------------
// Mirrors src/debugger/debugger-playback.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws, deepStrictEqual } from 'assert';
import { Debugger } from '../../src/debugger/Debugger.js';
// Self-register playback methods onto Debugger.prototype.
import '../../src/debugger/debugger-playback.js';
import { StepTrace } from '../../src/sim/StepTrace.js';
import { flattenCircuit, scheduleColumns } from '../../src/circuit/Flatten.js';
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
// Playback Controls
// ---------------------------------------------------------------------------

test('debugger-playback reset() returns to |0...0> at step 0', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  strictEqual(dbg.getCurrentStep(), 2);

  dbg.reset();
  strictEqual(dbg.getCurrentStep(), 0);
  strictEqual(dbg.getCurrentState().getRe(0), 1);
  strictEqual(dbg.getCurrentState().getRe(1), 0);
  strictEqual(dbg.getCurrentState().getRe(2), 0);
  strictEqual(dbg.getCurrentState().getRe(3), 0);
  ok(dbg.isAtStart());
});

test('debugger-playback next() advances one step at a time', () => {
  const dbg = buildDebugger(bellCircuit(2));

  strictEqual(dbg.getCurrentStep(), 0);

  dbg.next();
  strictEqual(dbg.getCurrentStep(), 1);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(1) - INV_SQRT2) < 1e-12);
  strictEqual(dbg.getCurrentState().getRe(2), 0);
  strictEqual(dbg.getCurrentState().getRe(3), 0);

  dbg.next();
  strictEqual(dbg.getCurrentStep(), 2);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(3) - INV_SQRT2) < 1e-12);
  strictEqual(dbg.getCurrentState().getRe(1), 0);
  strictEqual(dbg.getCurrentState().getRe(2), 0);
  ok(dbg.isAtEnd());
});

test('debugger-playback next() stops at end', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  const step = dbg.next();
  strictEqual(step, 2);
  ok(dbg.isAtEnd());
});

test('debugger-playback seek() jumps to target column', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();

  dbg.seek(1);
  strictEqual(dbg.getCurrentStep(), 1);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
  ok(Math.abs(dbg.getCurrentState().getRe(1) - INV_SQRT2) < 1e-12);

  dbg.seek(2);
  strictEqual(dbg.getCurrentStep(), 2);

  dbg.seek(0);
  strictEqual(dbg.getCurrentStep(), 0);
  strictEqual(dbg.getCurrentState().getRe(0), 1);
});

test('debugger-playback seek() clamps to valid range', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.seek(100);
  strictEqual(dbg.getCurrentStep(), 2);
  dbg.seek(-1);
  strictEqual(dbg.getCurrentStep(), 0);
});

test('debugger-playback seek() throws on invalid input', () => {
  const dbg = buildDebugger(bellCircuit(2));
  throws(() => dbg.seek(1.5), TypeError);
  throws(() => dbg.seek('a'), TypeError);
});

test('debugger-playback runToBreakpoint() stops at column breakpoint', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(1);
  const step = dbg.runToBreakpoint();
  strictEqual(step, 1);
});

test('debugger-playback runToBreakpoint() runs to end if no breakpoint', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const step = dbg.runToBreakpoint();
  strictEqual(step, 2);
});

test('debugger-playback runToPreviousBreakpoint() seeks to previous', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(0);
  dbg.addColumnBreakpoint(2);
  dbg.seek(2);
  const step = dbg.runToPreviousBreakpoint();
  strictEqual(step, 0);
});

test('debugger-playback runToPreviousBreakpoint() goes to start if none', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.seek(2);
  const step = dbg.runToPreviousBreakpoint();
  strictEqual(step, 0);
});

test('debugger-playback scrub() delegates to timeline', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  dbg.scrub(1);
  strictEqual(dbg.getCurrentStep(), 1);
  ok(Math.abs(dbg.getCurrentState().getRe(0) - INV_SQRT2) < 1e-12);
});

test('debugger-playback scrubToStart/End delegates to timeline', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.next();
  dbg.next();
  dbg.scrubToStart();
  strictEqual(dbg.getCurrentStep(), 0);
  dbg.scrubToEnd();
  strictEqual(dbg.getCurrentStep(), 2);
});

test('debugger-playback fromCircuit static facade', () => {
  const dbg = Debugger.fromCircuit(bellCircuit(2));
  ok(dbg instanceof Debugger);
  strictEqual(dbg.getCurrentStep(), 0);
  strictEqual(dbg.getTotalSteps(), 2);
});
