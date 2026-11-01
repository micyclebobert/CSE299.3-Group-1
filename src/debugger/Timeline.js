// =============================================================================
// src/debugger/Timeline.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: timeline scrubber over StepTrace snapshots.
// Imported exclusively by main.js. Deleting this folder requires at most a
// 2-line diff in main.js.
// =============================================================================

/**
 * Timeline scrubber providing O(1) scrubbing for Dense Mode and
 * zero-allocation fast-forward replay for Ephemeral Mode.
 * All operations read from StepTrace without mutation (except seek which
 * is a controlled state transition).
 */
export class Timeline {
  #stepTrace;
  #callbacks;
  #lastScrubTarget;

  /**
   * @param {StepTrace} stepTrace - The StepTrace instance to scrub
   */
  constructor(stepTrace) {
    if (!stepTrace || typeof stepTrace.seek !== 'function') {
      throw new TypeError('Timeline requires a StepTrace instance');
    }
    this.#stepTrace = stepTrace;
    this.#callbacks = {
      onScrub: null,
      onStepChange: null,
      onModeChange: null,
    };
    this.#lastScrubTarget = null;
  }

  /**
   * Register a callback for scrub events.
   * @param {(step: number, mode: string) => void} callback
   */
  onScrub(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onScrub callback must be a function');
    }
    this.#callbacks.onScrub = callback;
  }

  /**
   * Register a callback for step changes.
   * @param {(step: number, totalSteps: number) => void} callback
   */
  onStepChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onStepChange callback must be a function');
    }
    this.#callbacks.onStepChange = callback;
  }

  /**
   * Register a callback for mode changes.
   * @param {(mode: string) => void} callback
   */
  onModeChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onModeChange callback must be a function');
    }
    this.#callbacks.onModeChange = callback;
  }

  /**
   * Get the current StepTrace mode ('dense' or 'ephemeral').
   * @returns {string}
   */
  getMode() {
    return this.#stepTrace.mode;
  }

  /**
   * Get the current virtual column step.
   * @returns {number}
   */
  getCurrentStep() {
    return this.#stepTrace.step;
  }

  /**
   * Get the total number of steps (schedule length).
   * @returns {number}
   */
  getTotalSteps() {
    return this.#stepTrace.scheduleLength;
  }

  /**
   * Get the number of qubits.
   * @returns {number}
   */
  getNumQubits() {
    return this.#stepTrace.numQubits;
  }

  /**
   * Scrub to a specific virtual column.
   * In Dense Mode: O(1) via cached snapshot copy.
   * In Ephemeral Mode: zero-allocation fast-forward from step 0.
   *
   * @param {number} targetStep - Target virtual column (clamped to [0, scheduleLength])
   * @returns {number} The actual step after clamping
   */
  scrub(targetStep) {
    if (!Number.isInteger(targetStep)) {
      throw new TypeError('targetStep must be an integer');
    }

    const clamped = Math.max(0, Math.min(targetStep, this.#stepTrace.scheduleLength));
    const previousStep = this.#stepTrace.step;

    if (clamped !== previousStep) {
      this.#stepTrace.seek(clamped);
    }

    // Only fire callbacks if this is a new scrub target (not a repeated no-op)
    if (clamped !== this.#lastScrubTarget) {
      this.#lastScrubTarget = clamped;
      if (this.#callbacks.onScrub) {
        this.#callbacks.onScrub(clamped, this.#stepTrace.mode);
      }
      if (this.#callbacks.onStepChange) {
        this.#callbacks.onStepChange(clamped, this.#stepTrace.scheduleLength);
      }
    }

    return clamped;
  }

  /**
   * Scrub forward by a delta (can be negative to scrub backward).
   * @param {number} delta - Number of steps to move (positive or negative)
   * @returns {number} The new step after scrubbing
   */
  scrubBy(delta) {
    if (!Number.isInteger(delta)) {
      throw new TypeError('delta must be an integer');
    }
    const target = this.#stepTrace.step + delta;
    return this.scrub(target);
  }

  /**
   * Scrub to the first step (initial state |0...0>).
   * @returns {number} Always returns 0
   */
  scrubToStart() {
    return this.scrub(0);
  }

  /**
   * Scrub to the last step (final step after all columns).
   * @returns {number} The final step index
   */
  scrubToEnd() {
    return this.scrub(this.#stepTrace.scheduleLength);
  }

  /**
   * Get a read-only view of the current state vector.
   * @returns {StateVectorView}
   */
  getCurrentState() {
    return this.#stepTrace.currentState;
  }

  /**
   * Get the state vector at a specific step without changing the current position.
   * In Dense Mode: O(1) via cached snapshot.
   * In Ephemeral Mode: returns null (would require mutating position).
   *
   * @param {number} step - Virtual column to inspect
   * @returns {StateVectorView | null} Read-only state view, or null if step is invalid
   */
  peekState(step) {
    if (!Number.isInteger(step) || step < 0 || step > this.#stepTrace.scheduleLength) {
      return null;
    }

    if (this.#stepTrace.hasSnapshots()) {
      const snap = this.#stepTrace.getSnapshot(step);
      if (!snap) return null;
      return {
        numQubits: this.#stepTrace.numQubits,
        size: this.#stepTrace.size,
        getRe: (i) => snap.re[i],
        getIm: (i) => snap.im[i],
        probability: (i) => {
          const r = snap.re[i];
          const im = snap.im[i];
          return r * r + im * im;
        },
        probabilities: () => {
          const out = new Float64Array(this.#stepTrace.size);
          for (let i = 0; i < this.#stepTrace.size; i++) {
            const r = snap.re[i];
            const im = snap.im[i];
            out[i] = r * r + im * im;
          }
          return out;
        },
        normSquared: () => {
          let sum = 0.0;
          for (let i = 0; i < this.#stepTrace.size; i++) {
            const r = snap.re[i];
            const im = snap.im[i];
            sum += r * r + im * im;
          }
          return sum;
        },
      };
    }

    // Ephemeral mode: cannot peek without mutating; return null
    return null;
  }

  /**
   * Get all step indices where the state differs from the previous step.
   * Useful for rendering a compact timeline with only meaningful steps marked.
   * In Dense Mode: compares cached snapshots.
   * In Ephemeral Mode: returns empty array (would require full replay).
   *
   * @returns {number[]} Sorted array of step indices with state changes
   */
  getChangedSteps() {
    return this.#stepTrace.getChangedSteps();
  }

  /**
   * Get a summary of the timeline for UI rendering.
   * @returns {TimelineSummary}
   */
  getSummary() {
    return {
      mode: this.#stepTrace.mode,
      currentStep: this.#stepTrace.step,
      totalSteps: this.#stepTrace.scheduleLength,
      numQubits: this.#stepTrace.numQubits,
      changedSteps: this.getChangedSteps(),
    };
  }
}

/**
 * Primary export matching the base filename (Timeline.js -> Timeline).
 */