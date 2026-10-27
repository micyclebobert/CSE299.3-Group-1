// =============================================================================
// src/debugger/BreakpointManager.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: breakpoint management reading StepTrace.
// Imported exclusively by main.js. Deleting this folder requires at most a
// 2-line diff in main.js.
// =============================================================================

/**
 * Manages breakpoints for a StepTrace instance.
 * Supports both explicit column breakpoints and predicate-based breakpoints.
 * All operations are read-only with respect to StepTrace.
 */
export class BreakpointManager {
  #stepTrace;
  #columnBreakpoints;
  #predicateBreakpoints;
  #enabled;

  /**
   * @param {StepTrace} stepTrace - The StepTrace instance to manage breakpoints for
   */
  constructor(stepTrace) {
    if (!stepTrace || typeof stepTrace.findStepWhere !== 'function') {
      throw new TypeError('BreakpointManager requires a StepTrace instance');
    }
    this.#stepTrace = stepTrace;
    this.#columnBreakpoints = new Set();
    this.#predicateBreakpoints = new Map();
    this.#enabled = true;
  }

  /**
   * Enable or disable all breakpoints.
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
  }

  /**
   * Check if breakpoints are globally enabled.
   * @returns {boolean}
   */
  isEnabled() {
    return this.#enabled;
  }

  /**
   * Add a breakpoint at a specific virtual column.
   * @param {number} virtualColumn - The virtual column index to break at
   * @returns {boolean} true if added, false if already existed
   */
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

  /**
   * Remove a breakpoint at a specific virtual column.
   * @param {number} virtualColumn - The virtual column index to remove
   * @returns {boolean} true if removed, false if didn't exist
   */
  removeColumnBreakpoint(virtualColumn) {
    return this.#columnBreakpoints.delete(virtualColumn);
  }

  /**
   * Toggle a column breakpoint on/off.
   * @param {number} virtualColumn - The virtual column index to toggle
   * @returns {boolean} true if now enabled, false if now disabled
   */
  toggleColumnBreakpoint(virtualColumn) {
    if (this.#columnBreakpoints.has(virtualColumn)) {
      this.#columnBreakpoints.delete(virtualColumn);
      return false;
    }
    this.addColumnBreakpoint(virtualColumn);
    return true;
  }

  /**
   * Check if a column breakpoint exists at the given virtual column.
   * @param {number} virtualColumn
   * @returns {boolean}
   */
  hasColumnBreakpoint(virtualColumn) {
    return this.#columnBreakpoints.has(virtualColumn);
  }

  /**
   * Get all column breakpoints as a sorted array.
   * @returns {number[]}
   */
  getColumnBreakpoints() {
    return [...this.#columnBreakpoints].sort((a, b) => a - b);
  }

  /**
   * Clear all column breakpoints.
   */
  clearColumnBreakpoints() {
    this.#columnBreakpoints.clear();
  }

  /**
   * Add a predicate-based breakpoint.
   * The predicate receives (re, im, step) and returns true to break.
   * @param {string} id - Unique identifier for this predicate breakpoint
   * @param {(re: Float64Array, im: Float64Array, step: number) => boolean} predicate
   * @returns {boolean} true if added, false if id already existed
   */
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
    this.#predicateBreakpoints.set(id, predicate);
    return true;
  }

  /**
   * Remove a predicate breakpoint by id.
   * @param {string} id
   * @returns {boolean} true if removed, false if didn't exist
   */
  removePredicateBreakpoint(id) {
    return this.#predicateBreakpoints.delete(id);
  }

  /**
   * Toggle a predicate breakpoint on/off.
   * @param {string} id
   * @returns {boolean} true if now enabled, false if now disabled
   */
  togglePredicateBreakpoint(id) {
    if (this.#predicateBreakpoints.has(id)) {
      this.#predicateBreakpoints.delete(id);
      return false;
    }
    // Cannot toggle on without a predicate; user must use addPredicateBreakpoint
    return false;
  }

  /**
   * Check if a predicate breakpoint exists.
   * @param {string} id
   * @returns {boolean}
   */
  hasPredicateBreakpoint(id) {
    return this.#predicateBreakpoints.has(id);
  }

  /**
   * Get all predicate breakpoint ids.
   * @returns {string[]}
   */
  getPredicateBreakpointIds() {
    return [...this.#predicateBreakpoints.keys()];
  }

  /**
   * Clear all predicate breakpoints.
   */
  clearPredicateBreakpoints() {
    this.#predicateBreakpoints.clear();
  }

  /**
   * Clear all breakpoints (column and predicate).
   */
  clearAll() {
    this.#columnBreakpoints.clear();
    this.#predicateBreakpoints.clear();
  }

  /**
   * Check if the current step matches any active breakpoint.
   * If a predicate breakpoint matches, returns its id.
   * If a column breakpoint matches, returns the virtual column as a string.
   * Returns null if no breakpoint matches or breakpoints are disabled.
   *
   * @param {number} currentStep - The current virtual column step
   * @returns {string | number | null}
   */
  checkBreakpoints(currentStep) {
    if (!this.#enabled) {
      return null;
    }

    // Check column breakpoints first (exact match)
    if (this.#columnBreakpoints.has(currentStep)) {
      return currentStep;
    }

    // Check predicate breakpoints (requires evaluating at current step)
    // Note: This is a read-only check against the current StepTrace state
    for (const [id, predicate] of this.#predicateBreakpoints) {
      const state = this.#stepTrace.currentState;
      const size = state.size();
      const re = new Float64Array(size);
      const im = new Float64Array(size);
      for (let i = 0; i < size; i++) {
        re[i] = state.getRe(i);
        im[i] = state.getIm(i);
      }
      if (predicate(re, im, currentStep)) {
        return id;
      }
    }

    return null;
  }

  /**
   * Find the next breakpoint after the current step (exclusive).
   * Returns the virtual column of the next column breakpoint, or the step
   * where the next predicate breakpoint would trigger (via findStepWhere).
   * Returns -1 if no breakpoint is found ahead.
   *
   * @param {number} currentStep - The current virtual column step
   * @returns {number} Next breakpoint step, or -1
   */
  findNextBreakpoint(currentStep) {
    if (!this.#enabled) {
      return -1;
    }

    // Find next column breakpoint
    const columnBreakpoints = this.getColumnBreakpoints();
    for (const bp of columnBreakpoints) {
      if (bp > currentStep) {
        return bp;
      }
    }

    // For predicate breakpoints, we'd need to step through - but this
    // would mutate StepTrace. Instead, return -1 to indicate
    // predicate breakpoints require explicit findStepWhere calls.
    return -1;
  }

  /**
   * Find the previous breakpoint before the current step (exclusive).
   * Returns the virtual column of the previous column breakpoint.
   * Returns -1 if no breakpoint is found behind.
   *
   * @param {number} currentStep - The current virtual column step
   * @returns {number} Previous breakpoint step, or -1
   */
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

/**
 * Primary export matching the base filename (BreakpointManager.js -> BreakpointManager).
 */