// =============================================================================
// src/ai/IOAnalyzerUI.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: DOM-free UI state machine for the I/O Analyzer.
// Input row selectors, output row selectors, causal chain display (columns
// touched, input-affected, output-affected), summary text, sparse Top-k state
// grounding (marginals + linear entropies), and cache hit/miss/key display.
// Wires into index.html/AppController exclusively through callbacks (no DOM
// references). Imported exclusively by main.js via the ai/ leaf. Runs in bare
// Node.js. Testable via node --test.
// =============================================================================

import { IOAnalyzer } from './IOAnalyzer.js';
import { SparseSummary } from './SparseSummary.js';
import { Cache } from './Cache.js';

const STATUS_IDLE = 'idle';
const STATUS_OK = 'ok';
const STATUS_ERROR = 'error';
const ANALYSIS_CACHE_VERSION = 'io-v1';

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
    throw new TypeError(
      `IOAnalyzerUI expects an array of row indices, got: ${typeof rows}`
    );
  }
  const set = new Set();
  for (const r of rows) {
    if (!isRowIndex(r)) {
      throw new RangeError(
        `IOAnalyzerUI row indices must be non-negative integers, got: ${String(r)}`
      );
    }
    set.add(r);
  }
  return [...set].sort((a, b) => a - b);
}

export class IOAnalyzerUI {
  #inputRows;
  #outputRows;
  #numQubits;
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
    this.#analysis = null;
    this.#sparse = null;
    this.#status = STATUS_IDLE;
    this.#error = null;
    this.#cacheHit = null;
    this.#cacheKey = null;
    this.#cache = options.cache instanceof Cache ? options.cache : new Cache();
    const cb = defaultCallbacks();
    for (const key of Object.keys(cb)) {
      if (typeof options[key] === 'function') {
        cb[key] = options[key];
      }
    }
    this.#callbacks = cb;
  }

  // ---- read-only state ------------------------------------------------------

  get inputRows() {
    return this.#inputRows;
  }

  get outputRows() {
    return this.#outputRows;
  }

  get numQubits() {
    return this.#numQubits;
  }

  get analysis() {
    return this.#analysis;
  }

  get sparse() {
    return this.#sparse;
  }

  get status() {
    return this.#status;
  }

  get error() {
    return this.#error;
  }

  get cacheHit() {
    return this.#cacheHit;
  }

  get cacheKey() {
    return this.#cacheKey;
  }

  getStateSnapshot() {
    return {
      inputRows: this.#inputRows,
      outputRows: this.#outputRows,
      numQubits: this.#numQubits,
      analysis: this.#analysis,
      sparse: this.#sparse,
      status: this.#status,
      error: this.#error,
      cacheHit: this.#cacheHit,
      cacheKey: this.#cacheKey,
    };
  }

  // ---- state mutators -------------------------------------------------------

  setNumQubits(numQubits) {
    if (!isPositiveInteger(numQubits)) {
      throw new RangeError(
        `IOAnalyzerUI.setNumQubits expects a positive integer, got: ${String(numQubits)}`
      );
    }
    this.#numQubits = numQubits;
    this.#clearAnalysis();
    this.#notifyChange();
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

  // ---- analysis flow --------------------------------------------------------

  analyze(instructions, stepTrace, options = {}) {
    if (!Array.isArray(instructions)) {
      throw new TypeError(
        `IOAnalyzerUI.analyze expects an instructions array, got: ${typeof instructions}`
      );
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
    this.#cacheKey = Cache.sha256Hex(
      `${JSON.stringify({ instructions, inputRows: this.#inputRows, outputRows: this.#outputRows, numQubits })}|${ANALYSIS_CACHE_VERSION}`
    );
    this.#callbacks.onAnalyzeStart(this.getStateSnapshot());

    if (this.#cache.has(this.#cacheKey)) {
      const cached = this.#cache.get(this.#cacheKey);
      this.#applyCached(cached);
      this.#cacheHit = true;
      this.#callbacks.onCacheHit(this.#cacheKey, this.getStateSnapshot());
      this.#notifyChange();
      return this.getStateSnapshot();
    }

    this.#cacheHit = false;
    this.#callbacks.onCacheMiss(this.#cacheKey, this.getStateSnapshot());

    let analysis;
    try {
      analysis = IOAnalyzer.analyzeIO(
        instructions,
        this.#inputRows,
        this.#outputRows,
        stepTrace
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
    this.#cache.set(this.#cacheKey, { analysis, sparse });
    this.#callbacks.onAnalyzeOk(this.getStateSnapshot());
    this.#notifyChange();
    return this.getStateSnapshot();
  }

  // ---- cache / lifecycle ----------------------------------------------------

  #applyCached(cached) {
    this.#status = STATUS_OK;
    this.#analysis = cached.analysis;
    this.#sparse = cached.sparse;
    this.#error = null;
  }

  clearCache() {
    this.#cache = new Cache();
  }

  reset() {
    this.#inputRows = [];
    this.#outputRows = [];
    this.#numQubits = 2;
    this.#clearAnalysis();
    this.#notifyChange();
  }

  // ---- internals ------------------------------------------------------------

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
