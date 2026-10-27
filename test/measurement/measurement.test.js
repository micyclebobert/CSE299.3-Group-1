// =============================================================================
// test/measurement/measurement.test.js
// -----------------------------------------------------------------------------
// Mirrors src/measurement/measurement.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
import { StateVector } from '../../src/core/StateVector.js';
import { collapse, sampleHistogram } from '../../src/measurement/measurement.js';
import { evaluate } from '../../src/sim/Evaluator.js';
import { flattenCircuit } from '../../src/circuit/Flatten.js';
import { scheduleColumns } from '../../src/circuit/Flatten.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';
import { Circuit } from '../../src/circuit/Circuit.js';

// Seed the GateRegistry so evaluate() can resolve gate IDs.
import '../../src/main.js';

function circuitFromOps(ops, n) {
  const columns = ops.map(
    (op) =>
      new GateColumn({
        gates: [
          new Gate({
            name: op.gateId,
            target: op.target,
            controls: op.controls || [],
            thetaRad: op.theta,
          }),
        ],
      }),
  );
  return new Circuit({ numQubits: n, columns });
}

function plusState() {
  const circuit = circuitFromOps(
    [{ gateId: 'H', target: 0, controls: [] }],
    1,
  );
  return evaluate(scheduleColumns(flattenCircuit(circuit)), 1);
}

function buffersEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

test('collapse on |0> yields index 0', () => {
  const state = new StateVector(2);
  const idx = collapse(state);
  strictEqual(idx, 0);
  strictEqual(state.getRe(0), 1);
  strictEqual(state.getIm(0), 0);
  for (let i = 1; i < 4; i++) {
    strictEqual(state.getRe(i), 0);
    strictEqual(state.getIm(i), 0);
  }
});

test('collapse on |11> (index 3) yields index 3', () => {
  const state = new StateVector(2);
  state.getRawRe()[0] = 0.0; // zero the |0> amplitude set by constructor
  state.getRawRe()[3] = 1.0;
  const idx = collapse(state);
  strictEqual(idx, 3);
  strictEqual(state.getRe(3), 1);
  for (let i = 0; i < 3; i++) {
    strictEqual(state.getRe(i), 0);
    strictEqual(state.getIm(i), 0);
  }
});

test('sampleHistogram returns a Map with counts summing to shots', () => {
  const state = new StateVector(1);
  state.getRawRe()[0] = 1 / Math.sqrt(2);
  state.getRawRe()[1] = 1 / Math.sqrt(2);
  const hist = sampleHistogram(state, 100);
  ok(hist instanceof Map);
  let total = 0;
  for (const v of hist.values()) total += v;
  strictEqual(total, 100);
});

test('sampleHistogram throws on invalid shots', () => {
  const state = new StateVector(1);
  let threw = false;
  try { sampleHistogram(state, 0); } catch { threw = true; }
  strictEqual(threw, true);
});

test('collapse on non-StateVector throws TypeError', () => {
  throws(() => collapse({}), TypeError);
  throws(() => collapse(null), TypeError);
  throws(() => collapse(42), TypeError);
  throws(() => collapse('state'), TypeError);
});

test('sampleHistogram on non-StateVector throws TypeError', () => {
  throws(() => sampleHistogram({}, 10), TypeError);
  throws(() => sampleHistogram(null, 10), TypeError);
  throws(() => sampleHistogram(42, 10), TypeError);
});

test('sampleHistogram rejects non-integer, negative, and non-number shots', () => {
  const state = new StateVector(1);
  throws(() => sampleHistogram(state, 10.5), TypeError);
  throws(() => sampleHistogram(state, -3), TypeError);
  throws(() => sampleHistogram(state, '10'), TypeError);
  throws(() => sampleHistogram(state, 0), TypeError);
  throws(() => sampleHistogram(state, NaN), TypeError);
});

test('Born sampling of H|0> = |+> yields ~50/50 distribution', () => {
  const state = plusState();
  strictEqual(state.getRe(0), 1 / Math.sqrt(2));
  strictEqual(state.getRe(1), 1 / Math.sqrt(2));

  const hist = sampleHistogram(state, 10000);
  const c0 = hist.get(0) || 0;
  const c1 = hist.get(1) || 0;
  strictEqual(c0 + c1, 10000);
  ok(c0 >= 4800 && c0 <= 5200, `index 0 count ${c0} outside 50/50 tolerance`);
  ok(c1 >= 4800 && c1 <= 5200, `index 1 count ${c1} outside 50/50 tolerance`);
});

test('collapse on prob=1 basis state always yields that index', () => {
  for (let s = 0; s < 100; s++) {
    const state = new StateVector(2);
    state.getRawRe()[0] = 0.0;
    state.getRawRe()[3] = 1.0;
    strictEqual(collapse(state), 3);
    strictEqual(state.getRe(3), 1);
  }
});

test('sampleHistogram does not mutate the source state', () => {
  const state = plusState();
  const beforeRe = Array.from(state.getRawRe());
  const beforeIm = Array.from(state.getRawIm());

  sampleHistogram(state, 10000);

  ok(buffersEqual(state.getRawRe(), beforeRe), 're buffer changed after sampling');
  ok(buffersEqual(state.getRawIm(), beforeIm), 'im buffer changed after sampling');
});
