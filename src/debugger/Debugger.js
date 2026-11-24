// =============================================================================
// src/debugger/Debugger.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: core Debugger class (constructor, state queries,
// callbacks, static facade) wired to BreakpointManager and Timeline.
// Playback controls and breakpoint management are mixed in from
// debugger-playback.js and debugger-breakpoints.js (imported by main.js).
// Imported exclusively by main.js. Deleting this folder requires at most a
// 2-line diff in main.js.
// =============================================================================

import { BreakpointManager } from './BreakpointManager.js';
import { Timeline } from './Timeline.js';
import { flattenCircuit, scheduleColumns } from '../circuit/Flatten.js';
import { StepTrace } from '../sim/StepTrace.js';

/**
 * Main debugger integration class providing:
 * - State queries and callbacks
 * - Static facade (fromCircuit)
 *
 * Playback controls (reset, next, seek, runToBreakpoint, runToPreviousBreakpoint,
 * scrub, scrubToStart, scrubToEnd) are mixed in from debugger-playback.js.
 * Breakpoint management (getBreakpointManager, column/predicate breakpoints,
 * clearAllBreakpoints) is mixed in from debugger-breakpoints.js.
 * All operations read from StepTrace; no mutations of simulation state.
 */
export class Debugger {
  stepTrace;
  breakpointManager;
  timeline;
  callbacks;

  /**
   * @param {StepTrace} stepTrace - The StepTrace instance to debug
   */
  constructor(stepTrace) {
    if (!stepTrace || typeof stepTrace.next !== 'function') {
      throw new TypeError('Debugger requires a StepTrace instance');
    }
    this.stepTrace = stepTrace;
    this.breakpointManager = new BreakpointManager(stepTrace);
    this.timeline = new Timeline(stepTrace);
    this.callbacks = {
      onStep: null,
      onBreakpointHit: null,
      onReset: null,
      onSeek: null,
      onNext: null,
    };

    // Wire up timeline callbacks to debugger callbacks
    this.timeline.onStepChange((step, total) => {
      if (this.callbacks.onStep) {
        this.callbacks.onStep(step, total);
      }
      // Check for breakpoint hit after step change
      const hit = this.breakpointManager.checkBreakpoints(step);
      if (hit !== null && this.callbacks.onBreakpointHit) {
        this.callbacks.onBreakpointHit(hit, step);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Timeline accessor
  // ---------------------------------------------------------------------------

  /**
   * Get the Timeline instance.
   * @returns {Timeline}
   */
  getTimeline() {
    return this.timeline;
  }

  // ---------------------------------------------------------------------------
  // State readers
  // ---------------------------------------------------------------------------

  /**
   * Get the current state vector (read-only).
   * @returns {StateVectorView}
   */
  getCurrentState() {
    return this.stepTrace.currentState;
  }

  /**
   * Peek at a state without changing position (Dense Mode only).
   * @param {number} step
   * @returns {StateVectorView | null}
   */
  peekState(step) {
    return this.timeline.peekState(step);
  }

  /**
   * Get timeline summary for UI rendering.
   * @returns {TimelineSummary}
   */
  getTimelineSummary() {
    return this.timeline.getSummary();
  }

  // ---------------------------------------------------------------------------
  // State Queries
  // ---------------------------------------------------------------------------

  /**
   * Get the current virtual column step.
   * @returns {number}
   */
  getCurrentStep() {
    return this.stepTrace.step;
  }

  /**
   * Get the total number of steps.
   * @returns {number}
   */
  getTotalSteps() {
    return this.stepTrace.scheduleLength;
  }

  /**
   * Get the StepTrace mode ('dense' or 'ephemeral').
   * @returns {string}
   */
  getMode() {
    return this.stepTrace.mode;
  }

  /**
   * Get the number of qubits.
   * @returns {number}
   */
  getNumQubits() {
    return this.stepTrace.numQubits;
  }

  /**
   * Check if at the start (step 0).
   * @returns {boolean}
   */
  isAtStart() {
    return this.stepTrace.step === 0;
  }

  /**
   * Check if at the end (final step).
   * @returns {boolean}
   */
  isAtEnd() {
    return this.stepTrace.step >= this.stepTrace.scheduleLength;
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
    this.callbacks.onStep = callback;
  }

  /**
   * Register callback for breakpoint hits.
   * @param {(breakpointId: string|number, step: number) => void} callback
   */
  onBreakpointHit(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onBreakpointHit callback must be a function');
    }
    this.callbacks.onBreakpointHit = callback;
  }

  /**
   * Register callback for reset.
   * @param {() => void} callback
   */
  onReset(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onReset callback must be a function');
    }
    this.callbacks.onReset = callback;
  }

  /**
   * Register callback for seek operations.
   * @param {(newStep: number, oldStep: number) => void} callback
   */
  onSeek(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onSeek callback must be a function');
    }
    this.callbacks.onSeek = callback;
  }

  /**
   * Register callback for next step.
   * @param {(step: number) => void} callback
   */
  onNext(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onNext callback must be a function');
    }
    this.callbacks.onNext = callback;
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
