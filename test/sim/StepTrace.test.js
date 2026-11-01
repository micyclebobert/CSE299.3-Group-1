// =============================================================================
// test/sim/StepTrace.test.js
// -----------------------------------------------------------------------------
// Mirrors src/sim/StepTrace.js 1:1 per CONVENTIONS.md #224
// Tiered step trace: Dense Mode (n <= 12) + Ephemeral Replay (n > 12).
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import { StepTrace } from '../../src/sim/StepTrace.js';
import { bellState, ghzState } from '../../src/sim/analytic.js';
import { flattenCircuit } from '../../src/circuit/Flatten.js';
import { scheduleColumns } from '../../src/circuit/Flatten.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { StateVector } from '../../src/core/StateVector.js';

// Seed the GateRegistry so StepTrace can resolve gate IDs.
import '../../src/main.js';

const INV_SQRT2 = 1 / Math.sqrt(2);

function approx(a, b, tol = 1e-12) {
  ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

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

test('StepTrace constructs in Dense Mode for n=2', () => {
  const circuit = bellCircuit(2);
  const trace = buildTrace(circuit);
  strictEqual(trace.mode, 'dense');
  strictEqual(trace.step, 0);
  strictEqual(trace.numQubits, 2);
  strictEqual(trace.scheduleLength, 2);
});

test('StepTrace constructs in Ephemeral Mode for n=13', () => {
  const circuit = bellCircuit(13);
  const trace = buildTrace(circuit);
  strictEqual(trace.mode, 'ephemeral');
  strictEqual(trace.step, 0);
  strictEqual(trace.scheduleLength, 2);
});

test('StepTrace throws on invalid schedule', () => {
  throws(() => new StepTrace('not array', 2), TypeError);
});

test('StepTrace throws on invalid numQubits', () => {
  throws(() => new StepTrace([], 0), TypeError);
  throws(() => new StepTrace([], -1), TypeError);
  throws(() => new StepTrace([], 2.5), TypeError);
});

// ---------------------------------------------------------------------------
// reset() — Dense Mode
// ---------------------------------------------------------------------------

test('StepTrace reset() returns to |0...0> in Dense Mode', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next();
  strictEqual(trace.step, 2);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);

  trace.reset();
  strictEqual(trace.step, 0);
  strictEqual(trace.currentState.getRe(0), 1);
  strictEqual(trace.currentState.getRe(1), 0);
  strictEqual(trace.currentState.getRe(2), 0);
  strictEqual(trace.currentState.getRe(3), 0);
});

// ---------------------------------------------------------------------------
// next() — Dense Mode
// ---------------------------------------------------------------------------

test('StepTrace next() builds Bell state column by column (Dense)', () => {
  const trace = buildTrace(bellCircuit(2));

  // After column 0: H on qubit 0 -> |+0> = (|00> + |01>)/sqrt(2) -> indices 0 and 1
  trace.next();
  strictEqual(trace.step, 1);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(1), INV_SQRT2);
  strictEqual(trace.currentState.getRe(2), 0);
  strictEqual(trace.currentState.getRe(3), 0);

  // After column 1: CNOT(0->1) -> Bell state
  trace.next();
  strictEqual(trace.step, 2);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);
  strictEqual(trace.currentState.getRe(1), 0);
  strictEqual(trace.currentState.getRe(2), 0);
});

// ---------------------------------------------------------------------------
// seek() — Dense Mode O(1) scrubbing
// ---------------------------------------------------------------------------

test('StepTrace seek() jumps to any column in Dense Mode (O(1))', () => {
  const trace = buildTrace(bellCircuit(2));

  // Step through to end
  trace.next();
  trace.next();

  // Seek back to step 1 (after H only): |+0> = indices 0 and 1
  trace.seek(1);
  strictEqual(trace.step, 1);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(1), INV_SQRT2);
  strictEqual(trace.currentState.getRe(3), 0);

  // Seek forward to step 2 (Bell state)
  trace.seek(2);
  strictEqual(trace.step, 2);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);

  // Seek to step 0 (initial state)
  trace.seek(0);
  strictEqual(trace.step, 0);
  strictEqual(trace.currentState.getRe(0), 1);
  strictEqual(trace.currentState.getRe(1), 0);
  strictEqual(trace.currentState.getRe(2), 0);
  strictEqual(trace.currentState.getRe(3), 0);
});

test('StepTrace seek() clamps beyond schedule length', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.seek(100);
  strictEqual(trace.step, 2);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);
});

test('StepTrace seek() throws on non-integer targetCol', () => {
  const trace = buildTrace(bellCircuit(2));
  throws(() => trace.seek(-1), TypeError);
  throws(() => trace.seek(1.5), TypeError);
  throws(() => trace.seek('a'), TypeError);
});

// ---------------------------------------------------------------------------
// next() + seek() — Ephemeral Mode (n=13)
// ---------------------------------------------------------------------------

test('StepTrace next() builds Bell state in Ephemeral Mode (n=13)', () => {
  const trace = buildTrace(bellCircuit(13));
  strictEqual(trace.mode, 'ephemeral');

  trace.next();
  strictEqual(trace.step, 1);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(1), INV_SQRT2);

  trace.next();
  strictEqual(trace.step, 2);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);
});

test('StepTrace seek() fast-forwards in Ephemeral Mode (zero allocation)', () => {
  const trace = buildTrace(bellCircuit(13));

  trace.seek(2);
  strictEqual(trace.step, 2);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);

  // Seek back to 0: reset + replay from scratch
  trace.seek(0);
  strictEqual(trace.step, 0);
  strictEqual(trace.currentState.getRe(0), 1);
  strictEqual(trace.currentState.getRe(1), 0);
});

// ---------------------------------------------------------------------------
// findStepWhere() — breakpoint engine
// ---------------------------------------------------------------------------

test('StepTrace findStepWhere() finds first step matching predicate (Dense)', () => {
  const trace = buildTrace(bellCircuit(2));

  const found = trace.findStepWhere((re, im, step) => {
    if (step === 0) return false;
    return re[0] > 0 && re[3] > 0; // entanglement present at step 2
  });

  strictEqual(found, 2);
});

test('StepTrace findStepWhere() returns -1 when no step matches', () => {
  const trace = buildTrace(bellCircuit(2));

  const found = trace.findStepWhere((re, im, step) => {
    return re[1] === 1.0; // never true for Bell circuit
  });

  strictEqual(found, -1);
});

test('StepTrace findStepWhere() works in Ephemeral Mode (n=13)', () => {
  const trace = buildTrace(bellCircuit(13));

  const found = trace.findStepWhere((re, im, step) => {
    return step === 2 && re[0] > 0 && re[3] > 0;
  });

  strictEqual(found, 2);
});

test('StepTrace findStepWhere() throws on non-function predicate', () => {
  const trace = buildTrace(bellCircuit(2));
  throws(() => trace.findStepWhere(null), TypeError);
  throws(() => trace.findStepWhere(42), TypeError);
});

// ---------------------------------------------------------------------------
// verify() — analytic expectation check
// ---------------------------------------------------------------------------

test('StepTrace verify() passes for Bell state expectation (Dense)', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next();

  const result = trace.verify((step, n) => {
    if (step !== 2) return null;
    return bellState();
  });

  strictEqual(result.ok, true);
  strictEqual(result.failures.length, 0);
});

test('StepTrace verify() catches mismatch (Dense)', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next();

  const result = trace.verify((step, n) => {
    if (step !== 2) return null;
    return ghzState(3); // wrong state: 3 qubits vs 2
  });

  ok(result.ok === false || result.failures.length > 0, 'verify should detect mismatch');
});

// ---------------------------------------------------------------------------
// currentState() — read-only accessor
// ---------------------------------------------------------------------------

test('StepTrace currentState() exposes read-only API', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next();

  const cs = trace.currentState;
  strictEqual(cs.numQubits(), 2);
  strictEqual(cs.size(), 4);
  approx(cs.getRe(0), INV_SQRT2);
  approx(cs.getRe(3), INV_SQRT2);
  strictEqual(cs.getRe(1), 0);
  strictEqual(cs.getRe(2), 0);
  approx(cs.probability(0), 0.5);
  approx(cs.probability(3), 0.5);
  const probs = cs.probabilities();
  strictEqual(probs.length, 4);
  approx(cs.normSquared(), 1.0);

  // currentState should not expose mutable buffers
  strictEqual(typeof cs.getRawRe, 'undefined');
  strictEqual(typeof cs.getRawIm, 'undefined');
});

// ---------------------------------------------------------------------------
// Static evaluate() facade
// ---------------------------------------------------------------------------

test('StepTrace.evaluate() runs schedule to completion', () => {
  const circuit = bellCircuit(2);
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const trace = StepTrace.evaluate(schedule, 2);
  strictEqual(trace.step, 2);
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);
});

// ---------------------------------------------------------------------------
// Dense Mode snapshot integrity — seeking doesn't corrupt working buffers
// ---------------------------------------------------------------------------

test('StepTrace seek() does not corrupt cached snapshots (Dense)', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next(); // step 2 = Bell state

  trace.seek(1); // go back to step 1
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(1), INV_SQRT2);

  trace.seek(2); // go forward again
  approx(trace.currentState.getRe(0), INV_SQRT2);
  approx(trace.currentState.getRe(3), INV_SQRT2);
});

test('StepTrace next() beyond final step throws', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next();
  throws(() => trace.next(), Error);
});

test('StepTrace verify() throws on non-function expectation', () => {
  const trace = buildTrace(bellCircuit(2));
  throws(() => trace.verify(42), TypeError);
  throws(() => trace.verify('not a function'), TypeError);
  trace.verify(null);
  trace.verify(() => null);
});

test('StepTrace verify() detects expectation built for wrong numQubits', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next();
  const result = trace.verify((step, n) => {
    if (step !== 2) return null;
    return ghzState(3);
  });
  strictEqual(result.ok, false);
  ok(result.failures.length > 0);
});

test('StepTrace seek() scrubbing preserves bit-identical untouched amplitudes', () => {
  const trace = buildTrace(bellCircuit(2));
  trace.next();
  trace.next();
  const before = [];
  for (let i = 0; i < 4; i++) before[i] = trace.currentState.getRe(i);
  trace.seek(0);
  trace.seek(2);
  for (let i = 0; i < 4; i++) {
    ok(Object.is(trace.currentState.getRe(i), before[i]), `index ${i} bit-identical after scrub`);
  }
});
