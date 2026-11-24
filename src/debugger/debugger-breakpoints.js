// =============================================================================
// src/debugger/debugger-breakpoints.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: breakpoint management methods mixed into Debugger.
// Imported exclusively by main.js.
// =============================================================================

import { Debugger } from './Debugger.js';

Object.assign(Debugger.prototype, {
  /**
   * Get the BreakpointManager instance.
   * @returns {BreakpointManager}
   */
  getBreakpointManager() {
    return this.breakpointManager;
  },

  /**
   * Add a column breakpoint.
   * @param {number} virtualColumn
   * @returns {boolean}
   */
  addColumnBreakpoint(virtualColumn) {
    return this.breakpointManager.addColumnBreakpoint(virtualColumn);
  },

  /**
   * Add a step breakpoint (alias for addColumnBreakpoint; virtual columns == state steps).
   * @param {number} step
   * @returns {boolean}
   */
  addStepBreakpoint(step) {
    return this.addColumnBreakpoint(step);
  },

  /**
   * Remove a column breakpoint.
   * @param {number} virtualColumn
   * @returns {boolean}
   */
  removeColumnBreakpoint(virtualColumn) {
    return this.breakpointManager.removeColumnBreakpoint(virtualColumn);
  },

  /**
   * Remove a step breakpoint (alias for removeColumnBreakpoint; virtual columns == state steps).
   * @param {number} step
   * @returns {boolean}
   */
  removeStepBreakpoint(step) {
    return this.removeColumnBreakpoint(step);
  },

  /**
   * Toggle a column breakpoint.
   * @param {number} virtualColumn
   * @returns {boolean} true if now enabled
   */
  toggleColumnBreakpoint(virtualColumn) {
    return this.breakpointManager.toggleColumnBreakpoint(virtualColumn);
  },

  /**
   * Toggle a step breakpoint (alias for toggleColumnBreakpoint; virtual columns == state steps).
   * @param {number} step
   * @returns {boolean} true if now enabled
   */
  toggleStepBreakpoint(step) {
    return this.toggleColumnBreakpoint(step);
  },

  /**
   * Check if a column breakpoint exists.
   * @param {number} virtualColumn
   * @returns {boolean}
   */
  hasColumnBreakpoint(virtualColumn) {
    return this.breakpointManager.hasColumnBreakpoint(virtualColumn);
  },

  /**
   * Check if a step breakpoint exists (alias for hasColumnBreakpoint; virtual columns == state steps).
   * @param {number} step
   * @returns {boolean}
   */
  hasStepBreakpoint(step) {
    return this.hasColumnBreakpoint(step);
  },

  /**
   * Get all column breakpoints.
   * @returns {number[]}
   */
  getColumnBreakpoints() {
    return this.breakpointManager.getColumnBreakpoints();
  },

  /**
   * Get all step breakpoints (alias for getColumnBreakpoints; virtual columns == state steps).
   * @returns {number[]}
   */
  getStepBreakpoints() {
    return this.getColumnBreakpoints();
  },

  /**
   * Add a predicate breakpoint.
   * @param {string} id
   * @param {(re, im, step) => boolean} predicate
   * @returns {boolean}
   */
  addPredicateBreakpoint(id, predicate) {
    return this.breakpointManager.addPredicateBreakpoint(id, predicate);
  },

  /**
   * Remove a predicate breakpoint.
   * @param {string} id
   * @returns {boolean}
   */
  removePredicateBreakpoint(id) {
    return this.breakpointManager.removePredicateBreakpoint(id);
  },

  /**
   * Check if a predicate breakpoint exists.
   * @param {string} id
   * @returns {boolean}
   */
  hasPredicateBreakpoint(id) {
    return this.breakpointManager.hasPredicateBreakpoint(id);
  },

  /**
   * Find the exact virtual column where a predicate becomes true.
   * Uses StepTrace.findStepWhere internally (zero intermediate allocations).
   * @param {(re, im, step) => boolean} predicate
   * @returns {number} The step index, or -1 if not found
   */
  findStepWhere(predicate) {
    return this.stepTrace.findStepWhere(predicate);
  },

  /**
   * Get all predicate breakpoint ids.
   * @returns {string[]}
   */
  getPredicateBreakpointIds() {
    return this.breakpointManager.getPredicateBreakpointIds();
  },

  /**
   * Toggle a predicate breakpoint.
   * @param {string} id
   * @returns {boolean} true if now enabled
   */
  togglePredicateBreakpoint(id) {
    return this.breakpointManager.togglePredicateBreakpoint(id);
  },

  /**
   * Enable/disable all breakpoints globally.
   * @param {boolean} enabled
   */
  setBreakpointsEnabled(enabled) {
    this.breakpointManager.setEnabled(enabled);
  },

  /**
   * Check if breakpoints are globally enabled.
   * @returns {boolean}
   */
  areBreakpointsEnabled() {
    return this.breakpointManager.isEnabled();
  },

  /**
   * Clear all column and predicate breakpoints.
   */
  clearAllBreakpoints() {
    this.breakpointManager.clearAll();
  },
});
