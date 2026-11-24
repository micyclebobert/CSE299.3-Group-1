// =============================================================================
// src/debugger/DebuggerUI.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: Debugger UI state model + callbacks.
// DOM-free wrapper around Debugger that maintains a snapshot of UI-relevant
// state (current step, total steps, mode, breakpoints, changed steps) and
// exposes transport controls plus callbacks so a DOM layer can re-render.
// Imported exclusively by main.js. Deleting this folder requires at most a
// 2-line diff in main.js.
// =============================================================================

const REQUIRED_METHODS = [
  'reset', 'next', 'seek', 'runToBreakpoint', 'runToPreviousBreakpoint',
  'getCurrentStep', 'getTotalSteps', 'getMode', 'getNumQubits',
  'getTimeline', 'getBreakpointManager', 'getCurrentState',
  'onStep', 'onBreakpointHit', 'onReset', 'onSeek', 'onNext',
  'addColumnBreakpoint', 'removeColumnBreakpoint', 'toggleColumnBreakpoint',
  'hasColumnBreakpoint', 'getColumnBreakpoints',
  'addPredicateBreakpoint', 'removePredicateBreakpoint', 'togglePredicateBreakpoint',
  'hasPredicateBreakpoint', 'getPredicateBreakpointIds', 'setBreakpointsEnabled',
  'areBreakpointsEnabled',
];

function validateDebugger(dbg) {
  if (dbg === null || dbg === undefined || typeof dbg !== 'object') {
    throw new TypeError('DebuggerUI requires a Debugger instance');
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof dbg[method] !== 'function') {
      throw new TypeError(`DebuggerUI requires Debugger.${method} to be a function`);
    }
  }
}

function newState() {
  return {
    currentStep: 0,
    totalSteps: 0,
    mode: 'dense',
    numQubits: 0,
    changedSteps: [],
    columnBreakpoints: [],
    predicateBreakpointIds: [],
    breakpointsEnabled: true,
  };
}

function syncState(state, dbg) {
  const timeline = dbg.getTimeline();
  const breakpointManager = dbg.getBreakpointManager();
  state.currentStep = dbg.getCurrentStep();
  state.totalSteps = dbg.getTotalSteps();
  state.mode = dbg.getMode();
  state.numQubits = dbg.getNumQubits();
  state.changedSteps = timeline.getChangedSteps();
  state.columnBreakpoints = breakpointManager.getColumnBreakpoints();
  state.predicateBreakpointIds = breakpointManager.getPredicateBreakpointIds();
  state.breakpointsEnabled = breakpointManager.isEnabled();
}

export class DebuggerUI {
  #dbg;
  #state;
  #callbacks;

  constructor(dbg) {
    validateDebugger(dbg);
    this.#dbg = dbg;
    this.#state = newState();
    this.#callbacks = {
      onStepChange: null,
      onBreakpointHit: null,
      onReset: null,
      onSeek: null,
      onNext: null,
      onBreakpointsChanged: null,
    };
    syncState(this.#state, dbg);
    this.#wireDebugger();
  }

  #wireDebugger() {
    const d = this.#dbg;
    const state = this.#state;
    const cb = this.#callbacks;

    d.onStep((step, total) => {
      state.currentStep = step;
      state.totalSteps = total;
      state.changedSteps = d.getTimeline().getChangedSteps();
      if (cb.onStepChange) {
        cb.onStepChange(step, total);
      }
    });

    d.onBreakpointHit((id, step) => {
      if (cb.onBreakpointHit) {
        cb.onBreakpointHit(id, step);
      }
    });

    d.onReset(() => {
      syncState(state, d);
      if (cb.onReset) {
        cb.onReset();
      }
    });

    d.onSeek((newStep, oldStep) => {
      state.currentStep = newStep;
      if (cb.onSeek) {
        cb.onSeek(newStep, oldStep);
      }
    });

    d.onNext((step) => {
      state.currentStep = step;
      if (cb.onNext) {
        cb.onNext(step);
      }
    });
  }

  reset() {
    return this.#dbg.reset();
  }

  step() {
    return this.next();
  }

  next() {
    return this.#dbg.next();
  }

  seek(targetCol) {
    return this.#dbg.seek(targetCol);
  }

  runToBreakpoint() {
    return this.#dbg.runToBreakpoint();
  }

  runToPreviousBreakpoint() {
    return this.#dbg.runToPreviousBreakpoint();
  }

  getCurrentStep() {
    return this.#state.currentStep;
  }

  getTotalSteps() {
    return this.#state.totalSteps;
  }

  getMode() {
    return this.#state.mode;
  }

  getNumQubits() {
    return this.#state.numQubits;
  }

  getChangedSteps() {
    return [...this.#state.changedSteps];
  }

  isAtStart() {
    return this.#state.currentStep === 0;
  }

  isAtEnd() {
    return this.#state.currentStep >= this.#state.totalSteps;
  }

  getCurrentState() {
    return this.#dbg.getCurrentState();
  }

  getTimeline() {
    return this.#dbg.getTimeline();
  }

  getBreakpointManager() {
    return this.#dbg.getBreakpointManager();
  }

  getDebugger() {
    return this.#dbg;
  }

  addColumnBreakpoint(virtualColumn) {
    const added = this.#dbg.addColumnBreakpoint(virtualColumn);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
    return added;
  }

  removeColumnBreakpoint(virtualColumn) {
    const removed = this.#dbg.removeColumnBreakpoint(virtualColumn);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
    return removed;
  }

  toggleColumnBreakpoint(virtualColumn) {
    const nowEnabled = this.#dbg.toggleColumnBreakpoint(virtualColumn);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
    return nowEnabled;
  }

  hasColumnBreakpoint(virtualColumn) {
    return this.#dbg.hasColumnBreakpoint(virtualColumn);
  }

  getColumnBreakpoints() {
    return [...this.#state.columnBreakpoints];
  }

  addPredicateBreakpoint(id, predicate) {
    const added = this.#dbg.addPredicateBreakpoint(id, predicate);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
    return added;
  }

  removePredicateBreakpoint(id) {
    const removed = this.#dbg.removePredicateBreakpoint(id);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
    return removed;
  }

  togglePredicateBreakpoint(id) {
    const nowEnabled = this.#dbg.togglePredicateBreakpoint(id);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
    return nowEnabled;
  }

  setPredicateBreakpointEnabled(id, enabled) {
    const bm = this.#dbg.getBreakpointManager();
    const ok = bm.setPredicateBreakpointEnabled(id, enabled);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
    return ok;
  }

  isPredicateBreakpointEnabled(id) {
    const bm = this.#dbg.getBreakpointManager();
    return bm.isPredicateBreakpointEnabled(id);
  }

  hasPredicateBreakpoint(id) {
    return this.#dbg.hasPredicateBreakpoint(id);
  }

  getPredicateBreakpointIds() {
    return [...this.#state.predicateBreakpointIds];
  }

  setBreakpointsEnabled(enabled) {
    this.#dbg.setBreakpointsEnabled(enabled);
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
  }

  areBreakpointsEnabled() {
    return this.#state.breakpointsEnabled;
  }

  clearAllBreakpoints() {
    this.#dbg.clearAllBreakpoints();
    syncState(this.#state, this.#dbg);
    if (this.#callbacks.onBreakpointsChanged) {
      this.#callbacks.onBreakpointsChanged();
    }
  }

  onStepChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onStepChange callback must be a function');
    }
    this.#callbacks.onStepChange = callback;
  }

  onBreakpointHit(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onBreakpointHit callback must be a function');
    }
    this.#callbacks.onBreakpointHit = callback;
  }

  onReset(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onReset callback must be a function');
    }
    this.#callbacks.onReset = callback;
  }

  onSeek(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onSeek callback must be a function');
    }
    this.#callbacks.onSeek = callback;
  }

  onNext(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onNext callback must be a function');
    }
    this.#callbacks.onNext = callback;
  }

  onBreakpointsChanged(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('onBreakpointsChanged callback must be a function');
    }
    this.#callbacks.onBreakpointsChanged = callback;
  }
}
