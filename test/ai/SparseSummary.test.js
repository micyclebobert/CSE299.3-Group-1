// =============================================================================
// test/ai/SparseSummary.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/SparseSummary.js. Mock state vector facade; no DOM,
// no network, no LLM. Runs via node --test.
// =============================================================================

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { SparseSummary } from '../../src/ai/SparseSummary.js';

const TOL = 1e-12;
function approx(a, b, tol = TOL) {
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be approx ${b} within ${tol}`);
}

function makeState(amplitudes, numQubits) {
  // amplitudes: Map<index, [re, im]>; missing indices are zero.
  const size = 1 << numQubits;
  return {
    numQubits() { return numQubits; },
    size() { return size; },
    getRe(i) { return (amplitudes.get(i) || [0, 0])[0]; },
    getIm(i) { return (amplitudes.get(i) || [0, 0])[1]; },
  };
}

describe('SparseSummary', () => {
  it('all-zero state yields only |0...0> at probability 1', () => {
    const state = makeState(new Map([[0, [1, 0]]]), 3);
    const { topK, marginals } = SparseSummary.summarize(state);
    assert.equal(topK.length, 1);
    assert.equal(topK[0].label, '|000>');
    assert.equal(topK[0].index, 0);
    assert.equal(topK[0].probability, 1);
    assert.equal(topK[0].amplitude[0], 1);
    assert.equal(topK[0].amplitude[1], 0);
    assert.equal(topK[0].phase, 0);

    // Product state: every qubit separable -> sl = 0, rho00 = 1
    assert.equal(marginals.length, 3);
    for (const m of marginals) {
      assert.equal(m.rho00, 1);
      assert.equal(m.sl, 0);
    }
  });

  it('Bell state on 2 qubits yields top-2 terms |00> and |11>', () => {
    const invSqrt2 = 1 / Math.sqrt(2);
    const amps = new Map([
      [0, [invSqrt2, 0]],
      [3, [invSqrt2, 0]],
    ]);
    const state = makeState(amps, 2);
    const { topK, marginals } = SparseSummary.summarize(state);
    assert.equal(topK.length, 2);
    const labels = topK.map((t) => t.label).sort();
    assert.deepEqual(labels, ['|00>', '|11>']);
    for (const t of topK) {
      approx(t.probability, 0.5);
    }

    // Bell: maximally entangled -> rho00 = 0.5, sl = 0.5 on both rows
    assert.equal(marginals.length, 2);
    for (const m of marginals) {
      approx(m.rho00, 0.5);
      approx(m.sl, 0.5);
    }
  });

  it('GHZ state on 3 qubits yields top-2 terms |000> and |111>, sl = 0.5', () => {
    const invSqrt2 = 1 / Math.sqrt(2);
    const amps = new Map([
      [0, [invSqrt2, 0]],
      [7, [invSqrt2, 0]],
    ]);
    const state = makeState(amps, 3);
    const { topK, marginals } = SparseSummary.summarize(state);
    assert.equal(topK.length, 2);
    const labels = topK.map((t) => t.label).sort();
    assert.deepEqual(labels, ['|000>', '|111>']);
    for (const m of marginals) {
      approx(m.rho00, 0.5);
      approx(m.sl, 0.5);
    }
  });

  it('phase is captured for complex amplitudes', () => {
    const state = makeState(new Map([[0, [0, 1]]]), 2); // |0> with amplitude i
    const { topK } = SparseSummary.summarize(state);
    assert.equal(topK[0].label, '|00>');
    assert.equal(topK[0].probability, 1);
    assert.equal(topK[0].amplitude[0], 0);
    assert.equal(topK[0].amplitude[1], 1);
    assert.equal(topK[0].phase, Math.PI / 2);
  });

  it('probability threshold filters low-probability terms', () => {
    const amps = new Map([
      [0, [0.9, 0]],
      [1, [0.1, 0]],
      [2, [0.01, 0]],
    ]);
    const state = makeState(amps, 2);
    const { topK } = SparseSummary.summarize(state, 16, 0.005);
    assert.equal(topK.length, 2);
    assert.equal(topK[0].label, '|00>');
    assert.equal(topK[1].label, '|01>');
  });

  it('top-k cap limits number of terms returned', () => {
    const amps = new Map();
    for (let i = 0; i < 8; i += 1) {
      amps.set(i, [1 / Math.sqrt(8), 0]);
    }
    const state = makeState(amps, 3);
    const { topK } = SparseSummary.summarize(state, 3);
    assert.equal(topK.length, 3);
    for (const t of topK) {
      approx(t.probability, 1 / 8);
    }
  });

  it('big-endian ket label reverses little-endian index', () => {
    // n=3, index 2 = 010b little-endian: q0=0,q1=1,q2=0 -> big-endian |010>
    const state = makeState(new Map([[2, [1, 0]]]), 3);
    const { topK } = SparseSummary.summarize(state);
    assert.equal(topK[0].label, '|010>');
    // index 5 = 101b little-endian: q0=1,q1=0,q2=1 -> big-endian |101>
    const state2 = makeState(new Map([[5, [1, 0]]]), 3);
    const { topK: topK2 } = SparseSummary.summarize(state2);
    assert.equal(topK2[0].label, '|101>');
  });

  it('computeMarginals static returns separable sl=0 for product |00>', () => {
    const re = new Float64Array([1, 0, 0, 0]);
    const im = new Float64Array(4);
    const marg = SparseSummary.marginals(re, im, 2);
    assert.equal(marg.length, 2);
    for (const m of marg) {
      assert.equal(m.rho00, 1);
      assert.equal(m.sl, 0);
    }
  });
});
