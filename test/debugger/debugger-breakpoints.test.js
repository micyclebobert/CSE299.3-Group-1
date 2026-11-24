// =============================================================================
// test/debugger/debugger-breakpoints.test.js
// -----------------------------------------------------------------------------
// Mirrors src/debugger/debugger-breakpoints.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws, deepStrictEqual } from 'assert';
import { Debugger } from '../../src/debugger/Debugger.js';
// Self-register breakpoint methods onto Debugger.prototype.
import '../../src/debugger/debugger-breakpoints.js';
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

// ---------------------------------------------------------------------------
// Breakpoint Management
// ---------------------------------------------------------------------------

test('debugger-breakpoints getBreakpointManager returns BreakpointManager', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const bm = dbg.getBreakpointManager();
  ok(bm !== null);
  strictEqual(typeof bm.addColumnBreakpoint, 'function');
});

test('debugger-breakpoints add/remove/toggle column breakpoints', () => {
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

test('debugger-breakpoints getColumnBreakpoints returns sorted array', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(2);
  dbg.addColumnBreakpoint(0);
  dbg.addColumnBreakpoint(1);
  deepStrictEqual(dbg.getColumnBreakpoints(), [0, 1, 2]);
});

test('debugger-breakpoints predicate breakpoints', () => {
  const dbg = buildDebugger(bellCircuit(2));
  ok(dbg.addPredicateBreakpoint('bell', (re, im, step) => step === 2 && re[0] > 0 && re[3] > 0));
  ok(dbg.hasPredicateBreakpoint('bell'));
  strictEqual(dbg.addPredicateBreakpoint('bell', () => true), false); // duplicate
  ok(dbg.removePredicateBreakpoint('bell'));
  strictEqual(dbg.hasPredicateBreakpoint('bell'), false);
});

test('debugger-breakpoints togglePredicateBreakpoint and getPredicateBreakpointIds', () => {
  const dbg = buildDebugger(bellCircuit(2));
  ok(dbg.addPredicateBreakpoint('p1', () => true));
  deepStrictEqual(dbg.getPredicateBreakpointIds(), ['p1']);
  strictEqual(dbg.togglePredicateBreakpoint('p1'), false); // toggled off
  strictEqual(dbg.hasPredicateBreakpoint('p1'), false);
});

test('debugger-breakpoints findStepWhere delegates to StepTrace', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const found = dbg.findStepWhere((re, im, step) => {
    if (step === 0) return false;
    return re[0] > 0 && re[3] > 0; // entanglement at step 2
  });
  strictEqual(found, 2);
});

test('debugger-breakpoints findStepWhere returns -1 when not found', () => {
  const dbg = buildDebugger(bellCircuit(2));
  const found = dbg.findStepWhere((re, im, step) => re[1] === 1.0);
  strictEqual(found, -1);
});

test('debugger-breakpoints breakpoints enabled/disabled globally', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(1);
  dbg.setBreakpointsEnabled(false);
  strictEqual(dbg.areBreakpointsEnabled(), false);
  dbg.next(); // step 1 - should not trigger breakpoint logic
  dbg.setBreakpointsEnabled(true);
  strictEqual(dbg.areBreakpointsEnabled(), true);
});

test('debugger-breakpoints clearAllBreakpoints', () => {
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(0);
  dbg.addColumnBreakpoint(2);
  dbg.addPredicateBreakpoint('p1', () => true);
  dbg.clearAllBreakpoints();
  strictEqual(dbg.hasColumnBreakpoint(0), false);
  strictEqual(dbg.hasColumnBreakpoint(2), false);
  strictEqual(dbg.hasPredicateBreakpoint('p1'), false);
  deepStrictEqual(dbg.getColumnBreakpoints(), []);
  deepStrictEqual(dbg.getPredicateBreakpointIds(), []);
});

test('debugger-breakpoints fromCircuit static facade', () => {
  const dbg = Debugger.fromCircuit(bellCircuit(2));
  ok(dbg instanceof Debugger);
  strictEqual(dbg.getCurrentStep(), 0);
});

test('debugger-breakpoints breakpoint at step k stops before column k is applied', () => {
  // Bell circuit: column 0 = H on qubit 0; column 1 = CNOT(0 -> 1).
  // Step 1 = state after column 0 (H). Breakpoint at step 1 halts BEFORE column 1 (CNOT).
  const dbg = buildDebugger(bellCircuit(2));
  strictEqual(dbg.getTotalSteps(), 2);
  strictEqual(dbg.getCurrentStep(), 0);

  dbg.addColumnBreakpoint(1);
  ok(dbg.hasColumnBreakpoint(1));
  strictEqual(dbg.hasStepBreakpoint(1), true); // step alias

  const stoppedAt = dbg.runToBreakpoint();
  strictEqual(stoppedAt, 1, 'runToBreakpoint stops at step 1');

  // State at step 1: H applied, CNOT NOT yet applied -> (|00> + |01>)/sqrt(2)
  const state = dbg.getCurrentState();
  const invSqrt2 = 1 / Math.sqrt(2);
  strictEqual(state.getRe(0), invSqrt2);
  strictEqual(state.getRe(1), invSqrt2);
  strictEqual(state.getRe(2), 0);
  strictEqual(state.getRe(3), 0);
});

test('debugger-breakpoints breakpoint at step 0 stops before any column', () => {
  // Step 0 = initial |0...0> state (no columns applied yet).
  const dbg = buildDebugger(bellCircuit(2));
  dbg.addColumnBreakpoint(0);
  strictEqual(dbg.runToBreakpoint(), 0, 'breakpoint at step 0 stops at start');
  const state = dbg.getCurrentState();
  strictEqual(state.getRe(0), 1);
  strictEqual(state.getRe(1), 0);
  strictEqual(state.getRe(2), 0);
  strictEqual(state.getRe(3), 0);
});

test('debugger-breakpoints step aliases mirror column methods', () => {
  const dbg = buildDebugger(bellCircuit(2));
  strictEqual(dbg.addStepBreakpoint(1), true);
  strictEqual(dbg.hasStepBreakpoint(1), true);
  deepStrictEqual(dbg.getStepBreakpoints(), [1]);
  strictEqual(dbg.toggleStepBreakpoint(1), false);
  strictEqual(dbg.hasStepBreakpoint(1), false);
  strictEqual(dbg.removeStepBreakpoint(1), false);
});
