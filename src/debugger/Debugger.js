// =============================================================================
// src/debugger/Debugger.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: stepwise playback controls, breakpoints, and timeline
// reading StepTrace. Orchestrates BreakpointManager and Timeline.
// Imported exclusively by main.js. Deleting this folder requires at most a
// 2-line diff in main.js.
// =============================================================================

import { BreakpointManager } from './BreakpointManager.js';
import { Timeline } from './Timeline.js';
import { flattenCircuit, scheduleColumns } from '../circuit/Flatten.js';
import { StepTrace } from '../sim/StepTrace.js';

/**
 * Main debugger integration class providing:
 * - Playback controls (reset, next, seek)
 * - Breakpoint management (column and predicate breakpoints)
 * - Timeline scrubbing (O(1) dense, zero-alloc ephemeral)
 * All operations read from StepTrace; no mutations of simulation state.
 */
export class Debugger {
  #stepTrace;
  #breakpointManager;
  #timeline;
  #callbacks;

  /**
   * @param {StepTrace} stepTrace - The StepTrace instance to debug
   */
  constructor(stepTrace) {
    if (!stepTrace || typeof stepTrace.next !== 'function') {
      throw new TypeError('Debugger requires a StepTrace instance');
    }
    this.#stepTrace = stepTrace;
    this.#breakpointManager = new BreakpointManager(stepTrace);
    this.#timeline = new Timeline(stepTrace);
    this.#callbacks = {
      onStep: null,
      onBreakpointHit: null,
      onReset: null,
      onSeek: null,
      onNext: null,
    };

    // Wire up timeline callbacks to debugger callbacks
    this.#timeline.onStepChange((step, total) => {
      if (this.#callbacks.onStep) {
        this.#callbacks.onStep(step, total);
      }
      // Check for breakpoint hit after step change
      const hit = this.#breakpointManager.checkBreakpoints(step);
      if (hit !== null && this.#callbacks.onBreakpointHit) {
        this.#callbacks.onBreakpointHit(hit, step);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Playback Controls (M4.1)
  // ---------------------------------------------------------------------------

  /**
   * Reset to initial state |0...0> at step 0.
   * Clears working buffers in place, no TypedArray reallocation.
   * @returns {number} Always returns 0
   */
  reset() {
    this.#stepTrace.reset();
    if (this.#callbacks.onReset) {
      this.#callbacks.onReset();
    }
    if (this.#callbacks.onStep) {
      this.#callbacks.onStep(0, this.#stepTrace.scheduleLength);
    }
    return 0;
  }

  /**
   * Advance to the next virtual column (apply one ExecutionColumn).
   * In Dense Mode: caches the resulting snapshot.
   * In Ephemeral Mode: mutates in place with zero allocations.
   * @returns {number} The new step after advancing, or current step if at end
   */
  next() {
    if (this.#stepTrace.step >= this.#stepTrace.scheduleLength) {
      return this.#stepTrace.step;
    }
    this.#stepTrace.next();
    if (this.#callbacks.onNext) {
      this.#callbacks.onNext(this.#stepTrace.step);
    }
    if (this.#callbacks.onStep) {
      this.#callbacks.onStep(this.#stepTrace.step, this.#stepTrace.scheduleLength);
    }
    // Check for breakpoint hit
    const hit = this.#breakpointManager.checkBreakpoints(this.#stepTrace.step);
    if (hit !== null && this.#callbacks.onBreakpointHit) {
      this.#callbacks.onBreakpointHit(hit, this.#stepTrace.step);
    }
    return this.#stepTrace.step;
  }

  /**
   * Seek to a specific virtual column.
   * Dense Mode: O(1) via cached snapshot copy.
   * Ephemeral Mode: zero-allocation fast-forward from step 0.
   * @param {number} targetCol - Target virtual column (clamped to valid range)
   * @returns {number} The actual step after seeking
   */
  seek(targetCol) {
    if (!Number.isInteger(targetCol)) {
      throw new TypeError('targetCol must be an integer');
    }
    const clamped = Math.max(0, Math.min(targetCol, this.#stepTrace.scheduleLength));
    const previousStep = this.#stepTrace.step;

    if (clamped === previousStep) {
      return clamped;
    }

    this.#stepTrace.seek(clamped);
    if (this.#callbacks.onSeek) {
      this.#callbacks.onSeek(clamped, previousStep);
    }
    if (this.#callbacks.onStep) {
      this.#callbacks.onStep(clamped, this.#stepTrace.scheduleLength);
    }
    // Check for breakpoint hit
    const hit = this.#breakpointManager.checkBreakpoints(clamped);
    if (hit !== null && this.#callbacks.onBreakpointHit) {
      this.#callbacks.onBreakpointHit(hit, clamped);
    }
    return clamped;
  }

  /**
   * Run forward until a breakpoint is hit or the end is reached.
   * Returns the step where execution stopped.
   * @returns {number} The step where execution stopped (breakpoint or end)
   */
  runToBreakpoint() {
    while (this.#stepTrace.step < this.#stepTrace.scheduleLength) {
      const hit = this.#breakpointManager.checkBreakpoints(this.#stepTrace.step);
      if (hit !== null) {
        return this.#stepTrace.step;
      }
      this.next();
    }
    // Check at final step
    const hit = this.#breakpointManager.checkBreakpoints(this.#stepTrace.step);
    if (hit !== null && this.#callbacks.onBreakpointHit) {
      this.#callbacks.onBreakpointHit(hit, this.#stepTrace.step);
    }
    return this.#stepTrace.step;
  }

  /**
   * Run backward to the previous breakpoint or the start.
   * @returns {number} The step where execution stopped
   */
  runToPreviousBreakpoint() {
    const prev = this.#breakpointManager.findPreviousBreakpoint(this.#stepTrace.step);
    if (prev >= 0) {
      return this.seek(prev);
    }
    return this.seek(0);
  }

  // ---------------------------------------------------------------------------
  // Breakpoint Management (M4.2)
  // ---------------------------------------------------------------------------

  /**
   * Get the BreakpointManager instance.
   * @returns {BreakpointManager}
   */
  getBreakpointManager() {
    return this.#breakpointManager;
  }

  /**
   * Add a column breakpoint.
   * @param {number} virtualColumn
   * @returns {boolean}
   */
  addColumnBreakpoint(virtualColumn) {
    return this.#breakpointManager.addColumnBreakpoint(virtualColumn);
  }

  /**
   * Remove a column breakpoint.
   * @param {number} virtualColumn
   * @returns {boolean}
   */
  removeColumnBreakpoint(virtualColumn) {
    return this.#breakpointManager.removeColumnBreakpoint(virtualColumn);
  }

  /**
   * Toggle a column breakpoint.
   * @param {number} virtualColumn
   * @returns {boolean} true if now enabled
   */
  toggleColumnBreakpoint(virtualColumn) {
    return this.#breakpointManager.toggleColumnBreakpoint(virtualColumn);
  }

  /**
   * Check if a column breakpoint exists.
   * @param {number} virtualColumn
   * @returns {boolean}
   */
  hasColumnBreakpoint(virtualColumn) {
    return this.#breakpointManager.hasColumnBreakpoint(virtualColumn);
  }

  /**
   * Get all column breakpoints.
   * @returns {number[]}
   */
  getColumnBreakpoints() {
    return this.#breakpointManager.getColumnBreakpoints();
  }

  /**
   * Add a predicate breakpoint.
   * @param {string} id
   * @param {(re, im, step) => boolean} predicate
   * @returns {boolean}
   */
  addPredicateBreakpoint(id, predicate) {
    return this.#breakpointManager.addPredicateBreakpoint(id, predicate);
  }

  /**
   * Remove a predicate breakpoint.
   * @param {string} id
   * @returns {boolean}
   */
  removePredicateBreakpoint(id) {
    return this.#breakpointManager.removePredicateBreakpoint(id);
  }

  /**
   * Check if a predicate breakpoint exists.
   * @param {string} id
   * @returns {boolean}
   */
  hasPredicateBreakpoint(id) {
    return this.#breakpointManager.hasPredicateBreakpoint(id);
  }

  /**
   * Find the exact virtual column where a predicate becomes true.
   * Uses StepTrace.findStepWhere internally (zero intermediate allocations).
   * @param {(re, im, step) => boolean} predicate
   * @returns {number} The step index, or -1 if not found
   */
  findStepWhere(predicate) {
    return this.#stepTrace.findStepWhere(predicate);
  }

  /**
   * Enable/disable all breakpoints globally.
   * @param {boolean} enabled
   */
  setBreakpointsEnabled(enabled) {
    this.#breakpointManager.setEnabled(enabled);
  }

  /**
   * Check if breakpoints are globally enabled.
   * @returns {boolean}
   */
  areBreakpointsEnabled() {
    return this.#breakpointManager.isEnabled();
  }

  // ---------------------------------------------------------------------------
  // Timeline Scrubber (M4.3)
  // ---------------------------------------------------------------------------

  /**
   * Get the Timeline instance.
   * @returns {Timeline}
   */
  getTimeline() {
    return this.#timeline;
  }

  /**
   * Scrub to a specific step (delegates to Timeline).
   * @param {number} step
   * @returns {number}
   */
  scrub(step) {
    return this.#timeline.scrub(step);
  }

  /**
   * Scrub to the start (step 0).
   * @returns {number}
   */
  scrubToStart() {
    return this.#timeline.scrubToStart();
  }

  /**
   * Scrub to the end (final step).
   * @returns {number}
   */
  scrubToEnd() {
    return this.#timeline.scrubToEnd();
  }

  /**
   * Get the current state vector (read-only).
   * @returns {StateVectorView}
   */
  getCurrentState() {
    return this.#stepTrace.currentState;
  }

  /**
   * Peek at a state without changing position (Dense Mode only).
   * @param {number} step
   * @returns {StateVectorView | null}
   */
  peekState(step) {
    return this.#timeline.peekState(step);
  }

  /**
   * Get timeline summary for UI rendering.
   * @returns {TimelineSummary}
   */
  getTimelineSummary() {
    return this.#timeline.getSummary();
  }

  // ---------------------------------------------------------------------------
  // State Queries
  // ---------------------------------------------------------------------------

  /**
   * Get the current virtual column step.
   * @returns {number}
   */
  getCurrentStep() {
    return this.#stepTrace.step;
  }

  /**
   * Get the total number of steps.
   * @returns {number}
   */
  getTotalSteps() {
    return this.#stepTrace.scheduleLength;
  }

  /**
   * Get the StepTrace mode ('dense' or 'ephemeral').
   * @returns {string}
   */
  getMode() {
    return this.#stepTrace.mode;
  }

  /**
   * Get the number of qubits.
   * @returns {number}
   */
  getNumQubits() {
    return this.#stepTrace.numQubits;
  }

  /**
   * Check if at the start (step 0).
   * @returns {boolean}
   */
  isAtStart() {
    return this.#stepTrace.step === 0;
  }

  /**
   * Check if at the end (final step).
   * @returns {boolean}
   */
  isAtEnd() {
    return this.#stepTrace.step >= this.#stepTrace.scheduleLength;
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Register callback for step changes (including next, seek, reset).
   * @param {(step: number, totalSteps: number) => void} callback
   */
  onStep(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onStep callback must be a function');
    }
    this.#callbacks.onStep = callback;
  }

  /**
   * Register callback for breakpoint hits.
   * @param {(breakpointId: string|number, step: number) => void} callback
   */
  onBreakpointHit(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onBreakpointHit callback must be a function');
    }
    this.#callbacks.onBreakpointHit = callback;
  }

  /**
   * Register callback for reset.
   * @param {() => void} callback
   */
  onReset(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onReset callback must be a function');
    }
    this.#callbacks.onReset = callback;
  }

  /**
   * Register callback for seek operations.
   * @param {(newStep: number, oldStep: number) => void} callback
   */
  onSeek(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onSeek callback must be a function');
    }
    this.#callbacks.onSeek = callback;
  }

  /**
   * Register callback for next step.
   * @param {(step: number) => void} callback
   */
  onNext(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onNext callback must be a function');
    }
    this.#callbacks.onNext = callback;
  }

  // ---------------------------------------------------------------------------
  // Static Facade
  // ---------------------------------------------------------------------------

  /**
   * Create a Debugger from a Circuit (convenience static method).
   * @param {Circuit} circuit
   * @returns {Debugger}
   */
  static fromCircuit(circuit) {
    const instructions = flattenCircuit(circuit);
    const schedule = scheduleColumns(instructions);
    const trace = new StepTrace(schedule, circuit.numQubits);
    return new Debugger(trace);
  }
}

/**
 * Primary export matching the base filename (Debugger.js -> Debugger).
 */
export default Debugger;