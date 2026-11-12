// =============================================================================
// test/ai/IOAnalyzer.test.js
// -----------------------------------------------------------------------------
// Unit tests for src/ai/IOAnalyzer.js. Mocks StepTrace; no DOM, no network,
// no LLM. Runs via node --test.
// =============================================================================

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { IOAnalyzer } from '../../src/ai/IOAnalyzer.js';

function makeStepTrace(changedSteps) {
  return {
    getChangedSteps() {
      return changedSteps || [];
    },
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

const singleQInstructions = [
  { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
];

describe('IOAnalyzer', () => {
  it('Bell circuit: input row 0 affects both output rows via H+CNOT', () => {
    const stepTrace = makeStepTrace([0, 1]);
    const analysis = IOAnalyzer.analyzeIO(
      bellInstructions,
      [0],
      [0, 1],
      stepTrace
    );
    assert.deepEqual(analysis.inputRows, [0]);
    assert.deepEqual(analysis.outputRows, [0, 1]);
    assert.deepEqual(analysis.inputAffectedColumns, [0, 1]);
    assert.deepEqual(analysis.outputAffectedColumns, [0, 1]);
    assert.equal(analysis.touchedColumns.length, 2);
    assert.ok(analysis.causalChain.length > 0);
    assert.ok(analysis.summary.includes('Input rows'));
  });

  it('groups multiple gates in the same virtual column', () => {
    const instrs = [
      { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
      { gateId: 'X', target: 1, controls: [], column: 0, virtualColumn: 0 },
    ];
    const stepTrace = makeStepTrace([0]);
    const analysis = IOAnalyzer.analyzeIO(instrs, [0], [1], stepTrace);
    assert.equal(analysis.touchedColumns.length, 1);
    assert.equal(analysis.touchedColumns[0].virtualColumn, 0);
    assert.deepEqual(analysis.touchedColumns[0].touchedRows, [0, 1]);
  });

  it('no shared columns between input and output rows', () => {
    const stepTrace = makeStepTrace([0]);
    const analysis = IOAnalyzer.analyzeIO(
      singleQInstructions,
      [0],
      [1],
      stepTrace
    );
    assert.deepEqual(analysis.inputAffectedColumns, [0]);
    assert.deepEqual(analysis.outputAffectedColumns, []);
    assert.ok(analysis.summary.includes('output rows [1] are touched in 0 column(s)'));
  });

  it('respects StepTrace changed steps (filters unchanged columns)', () => {
    const instrs = [
      { gateId: 'H', target: 0, controls: [], column: 0, virtualColumn: 0 },
      { gateId: 'H', target: 0, controls: [], column: 1, virtualColumn: 1 },
    ];
    // Only column 0 changed per StepTrace.
    const stepTrace = makeStepTrace([0]);
    const analysis = IOAnalyzer.analyzeIO(instrs, [0], [0], stepTrace);
    assert.equal(analysis.touchedColumns.length, 1);
    assert.equal(analysis.touchedColumns[0].virtualColumn, 0);
  });

  it('causal chain entries are descriptive strings', () => {
    const stepTrace = makeStepTrace([0, 1]);
    const analysis = IOAnalyzer.analyzeIO(bellInstructions, [0], [1], stepTrace);
    assert.equal(analysis.causalChain.length, 2);
    assert.ok(analysis.causalChain[0].includes('virtual column 0'));
    assert.ok(analysis.causalChain[0].includes('H'));
    assert.ok(analysis.causalChain[1].includes('CNOT'));
    assert.ok(analysis.causalChain[1].includes('input-affected'));
    assert.ok(analysis.causalChain[1].includes('output-affected'));
  });

  it('returns empty arrays for empty instructions', () => {
    const stepTrace = makeStepTrace([]);
    const analysis = IOAnalyzer.analyzeIO([], [0], [1], stepTrace);
    assert.deepEqual(analysis.touchedColumns, []);
    assert.deepEqual(analysis.inputAffectedColumns, []);
    assert.deepEqual(analysis.outputAffectedColumns, []);
  });
});
