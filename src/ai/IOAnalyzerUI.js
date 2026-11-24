// =============================================================================
// src/ai/IOAnalyzerUI.js
// Discardable feature leaf: DOM-free UI state machine for the I/O Analyzer.
// Input/output row selectors, causal chain display, summary text, sparse
// Top-k state grounding, and cache hit/miss/key display. Wires into
// main.js/AppController exclusively through callbacks (no DOM references).
// Imported exclusively by main.js via the ai/ leaf. Runs in bare Node.js.
// =============================================================================

import { IOAnalyzer } from './IOAnalyzer.js';
import { SparseSummary } from './SparseSummary.js';
import { Cache } from './Cache.js';

const STATUS_IDLE = 'idle';
const STATUS_OK = 'ok';
const STATUS_ERROR = 'error';
const ANALYSIS_CACHE_VERSION = 'io-v1';
const BOUNDARY_FINAL = 'final';
const BOUNDARY_STEP = 'step';
const VALID_BOUNDARIES = new Set([BOUNDARY_FINAL, BOUNDARY_STEP]);

function isPositiveInteger(n) {
  return Number.isInteger(n) && n >= 1;
}

function isRowIndex(n) {
  return Number.isInteger(n) && n >= 0;
}

function defaultCallbacks() {
  return {
    onChange: () => {},
    onInputRowsChange: () => {},
    onOutputRowsChange: () => {},
    onAnalyzeStart: () => {},
    onAnalyzeOk: () => {},
    onAnalyzeError: () => {},
    onCacheHit: () => {},
    onCacheMiss: () => {},
  };
}

function uniqueSortedRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError(`IOAnalyzerUI expects an array of row indices, got: ${typeof rows}`);
  }
  const set = new Set();
  for (const r of rows) {
    if (!isRowIndex(r)) {
      throw new RangeError(`IOAnalyzerUI row indices must be non-negative integers, got: ${String(r)}`);
    }
    set.add(r);
  }
  return [...set].sort((a, b) => a - b);
}

export class IOAnalyzerUI {
  #inputRows;
  #outputRows;
  #numQubits;
  #stateBoundary;
  #selectedStep;
  #analysis;
  #sparse;
  #status;
  #error;
  #cacheHit;
  #cacheKey;
  #cache;
  #callbacks;

  constructor(options = {}) {
    this.#inputRows = [];
    this.#outputRows = [];
    this.#numQubits = isPositiveInteger(options.numQubits) ? options.numQubits : 2;
    this.#stateBoundary = options.stateBoundary !== undefined && VALID_BOUNDARIES.has(options.stateBoundary)
      ? options.stateBoundary
      : BOUNDARY_FINAL;
    this.#selectedStep = null;
    this.#analysis = null;
    this.#sparse = null;
    this.#status = STATUS_IDLE;
    this.#error = null;
    this.#cacheHit = null;
    this.#cacheKey = null;
    this.#cache = options.cache instanceof Cache ? options.cache : new Cache();
    const cb = defaultCallbacks();
    for (const key of Object.keys(cb)) {
      if (typeof options[key] === 'function') cb[key] = options[key];
    }
    this.#callbacks = cb;
  }
  onChange(cb) { this.#callbacks.onChange = cb; }

  get inputRows() { return this.#inputRows; }
  get outputRows() { return this.#outputRows; }
  get numQubits() { return this.#numQubits; }
  get stateBoundary() { return this.#stateBoundary; }
  get analysis() { return this.#analysis; }
  get sparse() { return this.#sparse; }
  get status() { return this.#status; }
  get error() { return this.#error; }
  get cacheHit() { return this.#cacheHit; }
  get cacheKey() { return this.#cacheKey; }
  get cache() { return this.#cache; }

  getStateSnapshot() {
    return {
      inputRows: this.#inputRows,
      outputRows: this.#outputRows,
      numQubits: this.#numQubits,
      stateBoundary: this.#stateBoundary,
      selectedStep: this.#selectedStep,
      analysis: this.#analysis,
      sparse: this.#sparse,
      status: this.#status,
      error: this.#error,
      cacheHit: this.#cacheHit,
      cacheKey: this.#cacheKey,
    };
  }

  setNumQubits(numQubits) {
    if (!isPositiveInteger(numQubits)) {
      throw new RangeError(`IOAnalyzerUI.setNumQubits expects a positive integer, got: ${String(numQubits)}`);
    }
    this.#numQubits = numQubits;
    this.#stateBoundary = BOUNDARY_FINAL;
    this.#selectedStep = null;
    this.#clearAnalysis();
    this.#notifyChange();
  }

  setStateBoundary(boundary) {
    if (!VALID_BOUNDARIES.has(boundary)) {
      throw new RangeError(`IOAnalyzerUI.setStateBoundary expects 'final' or 'step', got: ${String(boundary)}`);
    }
    if (this.#stateBoundary === boundary) return;
    this.#stateBoundary = boundary;
    this.#selectedStep = null;
    this.#clearAnalysis();
    this.#notifyChange();
  }

  setSelectedStep(step, scheduleLength) {
    if (!Number.isInteger(scheduleLength) || scheduleLength < 0) {
      throw new RangeError(`IOAnalyzerUI.setSelectedStep expects a non-negative integer schedule length, got: ${String(scheduleLength)}`);
    }
    if (!Number.isInteger(step) || step < 0 || step > scheduleLength) {
      throw new RangeError(`IOAnalyzerUI.setSelectedStep step ${step} is out of range [0, ${scheduleLength}]`);
    }
    this.#stateBoundary = BOUNDARY_STEP;
    this.#selectedStep = step;
    this.#clearAnalysis();
    this.#notifyChange();
  }

  getBoundaryInfo() {
    return {
      boundary: this.#stateBoundary,
      step: this.#selectedStep,
      isFinal: this.#stateBoundary === BOUNDARY_FINAL,
    };
  }

  setInputRows(rows) {
    this.#inputRows = uniqueSortedRows(rows);
    this.#clearAnalysis();
    this.#callbacks.onInputRowsChange(this.getStateSnapshot());
  }

  setOutputRows(rows) {
    this.#outputRows = uniqueSortedRows(rows);
    this.#clearAnalysis();
    this.#callbacks.onOutputRowsChange(this.getStateSnapshot());
  }

  setStateVector(state) {
    this.#sparse = null;
    this.#analysis = null;
    this.#status = STATUS_IDLE;
    this.#error = null;
    this.#cacheHit = null;
    this.#cacheKey = null;
    this.#notifyChange();
    return this.getStateSnapshot();
  }

  analyze(instructions, stepTrace, options = {}) {
    if (!Array.isArray(instructions)) {
      throw new TypeError(`IOAnalyzerUI.analyze expects an instructions array, got: ${typeof instructions}`);
    }
    const numQubits = options.numQubits !== undefined ? options.numQubits : this.#numQubits;
    if (!isPositiveInteger(numQubits)) {
      this.#setError('numQubits must be a positive integer');
      this.#notifyChange();
      return this.getStateSnapshot();
    }

    this.#status = STATUS_IDLE;
    this.#error = null;
    this.#cacheHit = null;

    const boundary = options.stateBoundary !== undefined && VALID_BOUNDARIES.has(options.stateBoundary)
      ? options.stateBoundary
      : this.#stateBoundary;

    const scheduleLength = this.#computeScheduleLength(instructions, stepTrace);

    let step;
    let stateIdentity;
    let effectiveStepTrace;

    const traceStep = stepTrace && typeof stepTrace.step === 'number' ? stepTrace.step : 0;

    if (boundary === BOUNDARY_FINAL) {
      step = scheduleLength;
      stateIdentity = `final@step=${traceStep}`;
      effectiveStepTrace = this.#makeFinalStepTrace(scheduleLength);
    } else {
      step = this.#selectedStep !== null
        ? this.#selectedStep
        : traceStep;
      if (step > scheduleLength) {
        this.#setError(`step ${step} exceeds schedule length ${scheduleLength}`);
        this.#notifyChange();
        return this.getStateSnapshot();
      }
      stateIdentity = `step=${step}`;
      effectiveStepTrace = this.#makeStepBoundaryStepTrace(stepTrace, step, scheduleLength);
    }

    this.#cacheKey = Cache.sha256Hex(
      `${JSON.stringify({ instructions, inputRows: this.#inputRows, outputRows: this.#outputRows, numQubits })}|${boundary}|${stateIdentity}|${ANALYSIS_CACHE_VERSION}`
    );
    this.#callbacks.onAnalyzeStart(this.getStateSnapshot());

    if (this.#cache.has(this.#cacheKey)) {
      const cached = this.#cache.get(this.#cacheKey);
      if (cached.stateIdentity !== stateIdentity || cached.stateBoundary !== boundary) {
        // State boundary mismatch: recompute rather than serving stale analysis.
      } else {
        this.#applyCached(cached);
        this.#cacheHit = true;
        this.#callbacks.onCacheHit(this.#cacheKey, this.getStateSnapshot());
        this.#notifyChange();
        return this.getStateSnapshot();
      }
    }

    this.#cacheHit = false;
    this.#callbacks.onCacheMiss(this.#cacheKey, this.getStateSnapshot());

    let analysis;
    try {
      analysis = IOAnalyzer.analyzeIO(
        instructions,
        this.#inputRows,
        this.#outputRows,
        effectiveStepTrace
      );
    } catch (err) {
      this.#setError(`Analysis threw: ${err.message}`);
      this.#notifyChange();
      return this.getStateSnapshot();
    }

    let sparse = null;
    if (options.state) {
      try {
        sparse = SparseSummary.summarize(options.state, 16, 1e-4);
      } catch (err) {
        sparse = null;
      }
    }

    this.#status = STATUS_OK;
    this.#analysis = analysis;
    this.#sparse = sparse;
    this.#error = null;
    this.#cache.set(this.#cacheKey, { analysis, sparse, stateIdentity, stateBoundary: boundary });
    this.#callbacks.onAnalyzeOk(this.getStateSnapshot());
    this.#notifyChange();
    return this.getStateSnapshot();
  }

  #applyCached(cached) {
    this.#status = STATUS_OK;
    this.#analysis = cached.analysis;
    this.#sparse = cached.sparse;
    this.#error = null;
  }

  clearCache() { this.#cache.clear(); }

  reset() {
    this.#inputRows = [];
    this.#outputRows = [];
    this.#numQubits = 2;
    this.#stateBoundary = BOUNDARY_FINAL;
    this.#selectedStep = null;
    this.#clearAnalysis();
    this.#notifyChange();
  }

  #computeScheduleLength(instructions, stepTrace) {
    if (stepTrace && Number.isInteger(stepTrace.scheduleLength) && stepTrace.scheduleLength >= 0) {
      return stepTrace.scheduleLength;
    }
    let maxVc = -1;
    for (const instr of instructions) {
      if (instr && Number.isInteger(instr.virtualColumn) && instr.virtualColumn > maxVc) {
        maxVc = instr.virtualColumn;
      }
    }
    return maxVc + 1;
  }

  #makeFinalStepTrace(scheduleLength) {
    const allSteps = [];
    for (let s = 1; s <= scheduleLength; s += 1) allSteps.push(s);
    return {
      step: scheduleLength,
      getChangedSteps() { return allSteps; },
      scheduleLength,
    };
  }

  #makeStepBoundaryStepTrace(stepTrace, step, scheduleLength) {
    const steps = [];
    for (let s = 1; s <= step; s += 1) steps.push(s);
    return {
      step,
      getChangedSteps() { return steps; },
      scheduleLength,
    };
  }

  #clearAnalysis() {
    this.#analysis = null;
    this.#sparse = null;
    this.#status = STATUS_IDLE;
    this.#error = null;
    this.#cacheHit = null;
    this.#cacheKey = null;
  }

  #setError(error) {
    this.#status = STATUS_ERROR;
    this.#error = error;
  }

  #notifyChange() {
    this.#callbacks.onChange(this.getStateSnapshot());
  }
}
