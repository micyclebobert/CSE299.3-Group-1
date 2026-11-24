// =============================================================================
// test/ai/IOAnalyzerUI.test.js
// Unit tests for src/ai/IOAnalyzerUI.js. No DOM, no network, no LLM. Mocks
// StepTrace and state vector facade. Runs via node --test.
// =============================================================================

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { IOAnalyzerUI } from '../../src/ai/IOAnalyzerUI.js';

function makeStepTrace(changedSteps) {
  return {
    getChangedSteps() {
      return changedSteps || [];
    },
  };
}

function makeState(amplitudes, numQubits) {
  const size = 1 << numQubits;
  return {
    numQubits() { return numQubits; },
    size() { return size; },
    getRe(i) { return (amplitudes.get(i) || [0, 0])[0]; },
    getIm(i) { return (amplitudes.get(i) || [0, 0])[1]; },
  };
}

const bellInstructions = [
  { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
  {
    gateId: 'CNOT',
    target: 1,
    controls: [{ row: 0, on: true }],
    column: 1,
    virtualColumn: 1,
  },
];

describe('IOAnalyzerUI', () => {
  it('analyzes bell circuit and populates causal chain', () => {
    const hits = [];
    const ui = new IOAnalyzerUI({
      numQubits: 2,
      onCacheHit: (key) => hits.push(key),
    });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const stepTrace = makeStepTrace([1, 2]);
    const result = ui.analyze(bellInstructions, stepTrace);

    assert.equal(ui.status, 'ok');
    assert.equal(ui.error, null);
    assert.equal(ui.cacheHit, false);
    assert.equal(ui.cacheKey.length, 64);
    assert.deepEqual(ui.inputRows, [0]);
    assert.deepEqual(ui.outputRows, [0, 1]);
    assert.deepEqual(ui.analysis.inputAffectedColumns, [0, 1]);
    assert.deepEqual(ui.analysis.outputAffectedColumns, [0, 1]);
    assert.equal(ui.analysis.touchedColumns.length, 2);
    assert.ok(ui.analysis.causalChain.length > 0);
    assert.ok(ui.analysis.summary.includes('Input rows'));
    assert.equal(hits.length, 0);
  });

  it('setInputRows / setOutputRows update state and clear analysis', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setInputRows([1, 0]);
    assert.deepEqual(ui.inputRows, [0, 1]);
    ui.setOutputRows([1]);
    assert.deepEqual(ui.outputRows, [1]);
    assert.equal(ui.status, 'idle');
    assert.equal(ui.analysis, null);
  });

  it('no shared columns -> empty affected arrays', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setInputRows([0]);
    ui.setOutputRows([1]);
    const stepTrace = makeStepTrace([1]);
    const result = ui.analyze(
      [{ gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 }],
      stepTrace
    );
    assert.deepEqual(ui.analysis.inputAffectedColumns, [0]);
    assert.deepEqual(ui.analysis.outputAffectedColumns, []);
    assert.ok(ui.analysis.summary.includes('output rows [1] are touched in 0 column(s)'));
  });

  it('cache hit on repeat analyze (no recompute)', () => {
    const hits = [];
    const ui = new IOAnalyzerUI({
      numQubits: 2,
      onCacheHit: (key) => hits.push(key),
    });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const stepTrace = makeStepTrace([1, 2]);
    ui.analyze(bellInstructions, stepTrace);
    assert.equal(ui.cacheHit, false);
    const firstKey = ui.cacheKey;

    ui.analyze(bellInstructions, stepTrace);
    assert.equal(ui.cacheHit, true);
    assert.equal(hits.length, 1);
    assert.equal(hits[0], firstKey);
    assert.deepEqual(ui.analysis.inputAffectedColumns, [0, 1]);
  });

  it('sparse grounding from state vector', () => {
    const invSqrt2 = 1 / Math.sqrt(2);
    const amps = new Map([
      [0, [invSqrt2, 0]],
      [3, [invSqrt2, 0]],
    ]);
    const state = makeState(amps, 2);
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    const stepTrace = makeStepTrace([1, 2]);
    const result = ui.analyze(bellInstructions, stepTrace, { state });

    assert.equal(ui.status, 'ok');
    assert.ok(ui.sparse);
    assert.equal(ui.sparse.topK.length, 2);
    const labels = ui.sparse.topK.map((t) => t.label).sort();
    assert.deepEqual(labels, ['|00>', '|11>']);
    assert.equal(ui.sparse.marginals.length, 2);
    for (const m of ui.sparse.marginals) {
      assert.ok(Math.abs(m.rho00 - 0.5) <= 1e-12);
      assert.ok(Math.abs(m.sl - 0.5) <= 1e-12);
    }
    assert.equal(result.sparse, ui.sparse);
  });

  it('setStateVector clears analysis and sparse', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    const stepTrace = makeStepTrace([1]);
    ui.analyze(bellInstructions, stepTrace);
    assert.equal(ui.status, 'ok');

    ui.setStateVector(makeState(new Map([[0, [1, 0]]]), 2));
    assert.equal(ui.status, 'idle');
    assert.equal(ui.analysis, null);
    assert.equal(ui.sparse, null);
    assert.equal(ui.cacheHit, null);
    assert.equal(ui.cacheKey, null);
  });

  it('invalid row indices throw RangeError', () => {
    const ui = new IOAnalyzerUI();
    assert.throws(() => ui.setInputRows([-1]), RangeError);
    assert.throws(() => ui.setInputRows([2.5]), RangeError);
    assert.throws(() => ui.setInputRows('x'), TypeError);
    assert.throws(() => ui.setOutputRows([-5]), RangeError);
  });

  it('setNumQubits validates and clears analysis', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    assert.throws(() => ui.setNumQubits(0), RangeError);
    assert.throws(() => ui.setNumQubits(-1), RangeError);
    ui.setNumQubits(3);
    assert.equal(ui.numQubits, 3);
    assert.equal(ui.status, 'idle');
    assert.equal(ui.analysis, null);
  });

  it('getStateSnapshot has the expected shape', () => {
    const ui = new IOAnalyzerUI({ numQubits: 3 });
    const snap = ui.getStateSnapshot();
    assert.deepEqual(snap, {
      inputRows: [],
      outputRows: [],
      numQubits: 3,
      stateBoundary: 'final',
      selectedStep: null,
      analysis: null,
      sparse: null,
      status: 'idle',
      error: null,
      cacheHit: null,
      cacheKey: null,
    });
  });

  it('clearCache forces re-analysis', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    const stepTrace = makeStepTrace([1, 2]);
    ui.analyze(bellInstructions, stepTrace);
    assert.equal(ui.cacheHit, false);
    ui.clearCache();
    ui.analyze(bellInstructions, stepTrace);
    assert.equal(ui.cacheHit, false);
    assert.equal(ui.status, 'ok');
  });

  it('reset clears all state', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    const stepTrace = makeStepTrace([1, 2]);
    ui.analyze(bellInstructions, stepTrace);
    ui.reset();
    assert.deepEqual(ui.inputRows, []);
    assert.deepEqual(ui.outputRows, []);
    assert.equal(ui.numQubits, 2);
    assert.equal(ui.status, 'idle');
    assert.equal(ui.analysis, null);
    assert.equal(ui.sparse, null);
    assert.equal(ui.cacheKey, null);
    assert.equal(ui.cacheHit, null);
  });

  it('cache key changes when stepTrace.step changes (same circuit)', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const preStep = { step: 0, getChangedSteps() { return []; } };
    const postStep = { step: 2, getChangedSteps() { return []; } };
    ui.analyze(bellInstructions, preStep, { stateBoundary: 'step' });
    const preKey = ui.cacheKey;
    ui.analyze(bellInstructions, postStep, { stateBoundary: 'step' });
    const postKey = ui.cacheKey;
    assert.notEqual(preKey, postKey);
    assert.equal(ui.cacheKey, postKey);
  });

  it('same step produces same cache key (cache hit)', () => {
    const hits = [];
    const ui = new IOAnalyzerUI({ numQubits: 2, onCacheHit: (key) => hits.push(key) });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const stepTrace = { step: 2, getChangedSteps() { return [1, 2]; } };
    ui.analyze(bellInstructions, stepTrace);
    assert.equal(ui.cacheHit, false);
    const firstKey = ui.cacheKey;
    ui.analyze(bellInstructions, stepTrace);
    assert.equal(ui.cacheHit, true);
    assert.equal(hits.length, 1);
    assert.equal(hits[0], firstKey);
    assert.equal(ui.cacheKey, firstKey);
  });

  it('pre-simulation vs post-simulation produce different cache entries', () => {
    const hits = [];
    const ui = new IOAnalyzerUI({ numQubits: 2, onCacheHit: (key) => hits.push(key) });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const preSim = { step: 0, getChangedSteps() { return []; } };
    const postSim = { step: 2, getChangedSteps() { return [1, 2]; } };
    ui.analyze(bellInstructions, preSim, { stateBoundary: 'step' });
    assert.equal(ui.cacheHit, false);
    const preKey = ui.cacheKey;
    ui.analyze(bellInstructions, postSim, { stateBoundary: 'step' });
    assert.equal(ui.cacheHit, false);
    const postKey = ui.cacheKey;
    assert.notEqual(preKey, postKey);
    ui.analyze(bellInstructions, preSim, { stateBoundary: 'step' });
    assert.equal(ui.cacheHit, true);
    assert.equal(hits.length, 1);
    assert.equal(hits[0], preKey);
  });

  it('undefined stepTrace degrades to step=none', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    ui.analyze(bellInstructions, undefined);
    assert.equal(ui.cacheHit, false);
    assert.match(ui.cacheKey, /^[0-9a-f]{64}$/);
  });

  it('non-array instructions throw TypeError', () => {
    const ui = new IOAnalyzerUI();
    assert.throws(() => ui.analyze('not an array', {}), TypeError);
  });

  // ---- state boundary tests -------------------------------------------------

  it('default state boundary is final', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    assert.equal(ui.stateBoundary, 'final');
    const info = ui.getBoundaryInfo();
    assert.deepEqual(info, { boundary: 'final', step: null, isFinal: true });
  });

  it('setStateBoundary changes boundary', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setStateBoundary('step');
    assert.equal(ui.stateBoundary, 'step');
    const info = ui.getBoundaryInfo();
    assert.deepEqual(info, { boundary: 'step', step: null, isFinal: false });
  });

  it('setStateBoundary with invalid value throws', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    assert.throws(() => ui.setStateBoundary('invalid'), RangeError);
    assert.throws(() => ui.setStateBoundary(null), RangeError);
    assert.throws(() => ui.setStateBoundary(42), RangeError);
    assert.equal(ui.stateBoundary, 'final');
  });

  it('cache key differs between final and step boundaries', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const stepTrace = { step: 2, getChangedSteps() { return [1, 2]; }, scheduleLength: 2 };
    ui.analyze(bellInstructions, stepTrace);
    const finalKey = ui.cacheKey;
    ui.setStateBoundary('step');
    ui.setSelectedStep(2, 2);
    ui.analyze(bellInstructions, stepTrace);
    const stepKey = ui.cacheKey;
    assert.notEqual(finalKey, stepKey);
  });

  it('setSelectedStep validates against schedule length', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setSelectedStep(1, 3);
    const info = ui.getBoundaryInfo();
    assert.deepEqual(info, { boundary: 'step', step: 1, isFinal: false });
    assert.throws(() => ui.setSelectedStep(5, 3), RangeError);
    assert.throws(() => ui.setSelectedStep(-1, 3), RangeError);
    assert.throws(() => ui.setSelectedStep(1.5, 3), RangeError);
  });

  it('getBoundaryInfo returns correct info for final', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    assert.deepEqual(ui.getBoundaryInfo(), { boundary: 'final', step: null, isFinal: true });
    ui.setStateBoundary('step');
    ui.setSelectedStep(0, 2);
    assert.deepEqual(ui.getBoundaryInfo(), { boundary: 'step', step: 0, isFinal: false });
  });

  it('setNumQubits resets boundary to default', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setStateBoundary('step');
    ui.setSelectedStep(1, 3);
    assert.equal(ui.stateBoundary, 'step');
    ui.setNumQubits(3);
    assert.equal(ui.stateBoundary, 'final');
    assert.deepEqual(ui.getBoundaryInfo(), { boundary: 'final', step: null, isFinal: true });
  });

  it('reset resets boundary to final', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setStateBoundary('step');
    ui.setSelectedStep(1, 3);
    ui.reset();
    assert.deepEqual(ui.getBoundaryInfo(), { boundary: 'final', step: null, isFinal: true });
    assert.equal(ui.numQubits, 2);
    assert.deepEqual(ui.inputRows, []);
    assert.deepEqual(ui.outputRows, []);
  });

  it('analyze with final boundary uses all columns even at step 0', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const stepTrace = { step: 0, getChangedSteps() { return []; }, scheduleLength: 2 };
    const result = ui.analyze(bellInstructions, stepTrace);
    assert.equal(result.status, 'ok');
    assert.equal(result.analysis.touchedColumns.length, 2);
  });

  it('analyze options.stateBoundary overrides instance boundary', () => {
    const ui = new IOAnalyzerUI({ numQubits: 2 });
    ui.setStateBoundary('final');
    ui.setInputRows([0]);
    ui.setOutputRows([0, 1]);
    const stepTrace = { step: 0, getChangedSteps() { return []; }, scheduleLength: 2 };
    ui.analyze(bellInstructions, stepTrace, { stateBoundary: 'step' });
    assert.equal(ui.stateBoundary, 'final');
    const stepKey = ui.cacheKey;
    ui.analyze(bellInstructions, stepTrace);
    const finalKey = ui.cacheKey;
    assert.notEqual(stepKey, finalKey);
  });
});
