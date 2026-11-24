// =============================================================================
// src/debugger/BreakpointManager.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: breakpoint management reading StepTrace.
// Imported exclusively by main.js. Deleting this folder requires at most a
// 2-line diff in main.js.
// =============================================================================

export class BreakpointManager {
  #stepTrace;
  #columnBreakpoints;
  #predicateBreakpoints;
  #enabled;

  constructor(stepTrace) {
    if (!stepTrace || typeof stepTrace.findStepWhere !== 'function') {
      throw new TypeError('BreakpointManager requires a StepTrace instance');
    }
    this.#stepTrace = stepTrace;
    this.#columnBreakpoints = new Set();
    this.#predicateBreakpoints = new Map();
    this.#enabled = true;
  }

  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
  }

  isEnabled() {
    return this.#enabled;
  }

  addColumnBreakpoint(virtualColumn) {
    if (!Number.isInteger(virtualColumn) || virtualColumn < 0) {
      throw new TypeError('virtualColumn must be a non-negative integer');
    }
    if (virtualColumn > this.#stepTrace.scheduleLength) {
      throw new RangeError(`virtualColumn ${virtualColumn} exceeds schedule length ${this.#stepTrace.scheduleLength}`);
    }
    const added = !this.#columnBreakpoints.has(virtualColumn);
    this.#columnBreakpoints.add(virtualColumn);
    return added;
  }

  removeColumnBreakpoint(virtualColumn) {
    return this.#columnBreakpoints.delete(virtualColumn);
  }

  toggleColumnBreakpoint(virtualColumn) {
    if (this.#columnBreakpoints.has(virtualColumn)) {
      this.#columnBreakpoints.delete(virtualColumn);
      return false;
    }
    this.addColumnBreakpoint(virtualColumn);
    return true;
  }

  hasColumnBreakpoint(virtualColumn) {
    return this.#columnBreakpoints.has(virtualColumn);
  }

  getColumnBreakpoints() {
    return [...this.#columnBreakpoints].sort((a, b) => a - b);
  }

  clearColumnBreakpoints() {
    this.#columnBreakpoints.clear();
  }

  addPredicateBreakpoint(id, predicate) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('Predicate breakpoint id must be a non-empty string');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('Predicate must be a function');
    }
    if (this.#predicateBreakpoints.has(id)) {
      return false;
    }
    this.#predicateBreakpoints.set(id, { predicate, enabled: true });
    return true;
  }

  removePredicateBreakpoint(id) {
    return this.#predicateBreakpoints.delete(id);
  }

  togglePredicateBreakpoint(id) {
    if (this.#predicateBreakpoints.has(id)) {
      this.#predicateBreakpoints.delete(id);
      return false;
    }
    return false;
  }

  setPredicateBreakpointEnabled(id, enabled) {
    const entry = this.#predicateBreakpoints.get(id);
    if (!entry) {
      return false;
    }
    entry.enabled = Boolean(enabled);
    return true;
  }

  isPredicateBreakpointEnabled(id) {
    const entry = this.#predicateBreakpoints.get(id);
    return entry ? entry.enabled : false;
  }

  hasPredicateBreakpoint(id) {
    return this.#predicateBreakpoints.has(id);
  }

  getPredicateBreakpointIds() {
    return [...this.#predicateBreakpoints.keys()];
  }

  clearPredicateBreakpoints() {
    this.#predicateBreakpoints.clear();
  }

  clearAll() {
    this.#columnBreakpoints.clear();
    this.#predicateBreakpoints.clear();
  }

  checkBreakpoints(currentStep) {
    if (!this.#enabled) {
      return null;
    }

    if (this.#columnBreakpoints.has(currentStep)) {
      return currentStep;
    }

    const state = this.#stepTrace.currentState;
    const size = state.size();
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      re[i] = state.getRe(i);
      im[i] = state.getIm(i);
    }
    for (const [id, entry] of this.#predicateBreakpoints) {
      if (!entry.enabled) continue;
      if (entry.predicate(re, im, currentStep)) {
        return id;
      }
    }

    return null;
  }

  findNextBreakpoint(currentStep) {
    if (!this.#enabled) {
      return -1;
    }

    const columnBreakpoints = this.getColumnBreakpoints();
    for (const bp of columnBreakpoints) {
      if (bp > currentStep) {
        return bp;
      }
    }
    return -1;
  }

  findPreviousBreakpoint(currentStep) {
    if (!this.#enabled) {
      return -1;
    }

    const columnBreakpoints = this.getColumnBreakpoints();
    for (let i = columnBreakpoints.length - 1; i >= 0; i--) {
      if (columnBreakpoints[i] < currentStep) {
        return columnBreakpoints[i];
      }
    }
    return -1;
  }
}
