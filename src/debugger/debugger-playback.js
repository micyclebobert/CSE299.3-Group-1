// =============================================================================
// src/debugger/debugger-playback.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: playback control methods mixed into Debugger.
// Imported exclusively by main.js.
// =============================================================================

import { Debugger } from './Debugger.js';

Object.assign(Debugger.prototype, {
  /**
   * Reset to initial state |0...0> at step 0.
   * Clears working buffers in place, no TypedArray reallocation.
   * @returns {number} Always returns 0
   */
  reset() {
    this.stepTrace.reset();
    if (this.callbacks.onReset) {
      this.callbacks.onReset();
    }
    if (this.callbacks.onStep) {
      this.callbacks.onStep(0, this.stepTrace.scheduleLength);
    }
    return 0;
  },

  /**
   * Advance to the next virtual column (apply one ExecutionColumn).
   * In Dense Mode: caches the resulting snapshot.
   * In Ephemeral Mode: mutates in place with zero allocations.
   * @returns {number} The new step after advancing, or current step if at end
   */
  next() {
    if (this.stepTrace.step >= this.stepTrace.scheduleLength) {
      return this.stepTrace.step;
    }
    this.stepTrace.next();
    if (this.callbacks.onNext) {
      this.callbacks.onNext(this.stepTrace.step);
    }
    if (this.callbacks.onStep) {
      this.callbacks.onStep(this.stepTrace.step, this.stepTrace.scheduleLength);
    }
    // Check for breakpoint hit
    const hit = this.breakpointManager.checkBreakpoints(this.stepTrace.step);
    if (hit !== null && this.callbacks.onBreakpointHit) {
      this.callbacks.onBreakpointHit(hit, this.stepTrace.step);
    }
    return this.stepTrace.step;
  },

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
    const clamped = Math.max(0, Math.min(targetCol, this.stepTrace.scheduleLength));
    const previousStep = this.stepTrace.step;

    if (clamped === previousStep) {
      return clamped;
    }

    this.stepTrace.seek(clamped);
    if (this.callbacks.onSeek) {
      this.callbacks.onSeek(clamped, previousStep);
    }
    if (this.callbacks.onStep) {
      this.callbacks.onStep(clamped, this.stepTrace.scheduleLength);
    }
    // Check for breakpoint hit
    const hit = this.breakpointManager.checkBreakpoints(clamped);
    if (hit !== null && this.callbacks.onBreakpointHit) {
      this.callbacks.onBreakpointHit(hit, clamped);
    }
    return clamped;
  },

  /**
   * Run forward until a breakpoint is hit or the end is reached.
   * Returns the step where execution stopped.
   * @returns {number} The step where execution stopped (breakpoint or end)
   */
  runToBreakpoint() {
    while (this.stepTrace.step < this.stepTrace.scheduleLength) {
      const hit = this.breakpointManager.checkBreakpoints(this.stepTrace.step);
      if (hit !== null) {
        return this.stepTrace.step;
      }
      this.next();
    }
    // Check at final step
    const hit = this.breakpointManager.checkBreakpoints(this.stepTrace.step);
    if (hit !== null && this.callbacks.onBreakpointHit) {
      this.callbacks.onBreakpointHit(hit, this.stepTrace.step);
    }
    return this.stepTrace.step;
  },

  /**
   * Run backward to the previous breakpoint or the start.
   * @returns {number} The step where execution stopped
   */
  runToPreviousBreakpoint() {
    const prev = this.breakpointManager.findPreviousBreakpoint(this.stepTrace.step);
    if (prev >= 0) {
      return this.seek(prev);
    }
    return this.seek(0);
  },

  /**
   * Scrub to a specific step (delegates to Timeline).
   * @param {number} step
   * @returns {number}
   */
  scrub(step) {
    return this.timeline.scrub(step);
  },

  /**
   * Scrub to the start (step 0).
   * @returns {number}
   */
  scrubToStart() {
    return this.timeline.scrubToStart();
  },

  /**
   * Scrub to the end (final step).
   * @returns {number}
   */
  scrubToEnd() {
    return this.timeline.scrubToEnd();
  },
});
