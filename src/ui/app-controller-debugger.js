export const debuggerMethods = {
  simulate() {
    if (!this._stepTrace) return;
    if (this._debugger) {
      this._debugger.reset();
      while (this._debugger.getCurrentStep() < this._debugger.getTotalSteps()) {
        this._debugger.next();
      }
    } else {
      while (this._stepTrace.step < this._stepTrace.scheduleLength) this._stepTrace.next();
    }
    this.notify();
    this._status(`Simulated ${this._stepTrace.scheduleLength} virtual column(s).`);
  },
  reset() {
    if (!this._debugger) return;
    this._debugger.reset();
    this.notify();
    this._status('Reset to |0...\u232a at step 0.');
  },
  step() {
    this.stepDebugger();
  },
  stepDebugger() {
    if (!this._debugger) return;
    this._debugger.next();
    this.notify();
  },
  stepPrevious() {
    if (!this._debugger) return;
    const prev = this._debugger.getCurrentStep() - 1;
    if (prev < 0) return;
    this._debugger.seek(prev);
    this.notify();
  },
  playPause() {
    if (!this._debugger) return;
    if (this._playInterval) {
      clearInterval(this._playInterval);
      this._playInterval = null;
      this._status('Paused.');
      return;
    }
    const stepMs = 400;
    this._playInterval = setInterval(() => {
      if (this._debugger.isAtEnd()) {
        clearInterval(this._playInterval);
        this._playInterval = null;
        this._status('Playback reached end.');
        return;
      }
      this._debugger.next();
      this.notify();
    }, stepMs);
    this._status('Playing...');
  },
  runToBreakpoint() {
    if (!this._debugger) return;
    this._debugger.runToBreakpoint();
    this.notify();
  },
  runToPreviousBreakpoint() {
    if (!this._debugger) return;
    this._debugger.runToPreviousBreakpoint();
    this.notify();
  },
  seekDebugger(col) {
    if (!this._debugger) return;
    this._debugger.seek(col);
    this.notify();
  },
  _validBreakpointCol(col) {
    return Number.isInteger(col) && col >= 0 && col <= this.getTimelineMax();
  },
  addBreakpoint(col) {
    if (!this._debugger || !this._validBreakpointCol(col)) { this._status(`Invalid breakpoint step ${col}.`); return false; }
    try { return this._debugger.addColumnBreakpoint(col); } catch (err) { this._status(`Invalid breakpoint step ${col}: ${err.message}`); return false; }
  },
  removeBreakpoint(col) {
    if (!this._debugger || !this._validBreakpointCol(col)) { this._status(`Invalid breakpoint step ${col}.`); return false; }
    return this._debugger.removeColumnBreakpoint(col);
  },
  toggleBreakpoint(col) {
    if (!this._debugger || !this._validBreakpointCol(col)) { this._status(`Invalid breakpoint step ${col}.`); return false; }
    try { return this._debugger.toggleColumnBreakpoint(col); } catch (err) { this._status(`Invalid breakpoint step ${col}: ${err.message}`); return false; }
  },
  clearAllBreakpoints() { if (this._debugger) this._debugger.clearAllBreakpoints(); },
  getBreakpoints() { return this._debugger?.getColumnBreakpoints() ?? []; },
  getBreakpointsWithStatus() {
    const step = this.getDebuggerStep();
    return this.getBreakpoints().map((col) => ({ column: col, active: col === step }));
  },
  hasBreakpoint(col) { return this._debugger?.hasColumnBreakpoint(col) ?? false; },
  getDebuggerStep() { return this._debuggerUI?.getCurrentStep() ?? 0; },
  getDebuggerTotal() { return this._debuggerUI?.getTotalSteps() ?? 0; },
  isDebuggerAtStart() { return this._debuggerUI?.isAtStart() ?? true; },
  isDebuggerAtEnd() { return this._debuggerUI?.isAtEnd() ?? true; },
  getCurrentVirtualColumn() { return this._stepTrace ? this._stepTrace.step : 0; },
  seek(col) {
    if (!this._stepTrace) return;
    this._stepTrace.seek(col);
    this.notify();
  },
  getCurrentStep() { return this._stepTrace ? this._stepTrace.step : 0; },
  getTotalSteps() { return this._stepTrace ? this._stepTrace.scheduleLength : 0; },
  getTimelineMax() { return this.getTotalSteps(); },
  isAtStart() { return this._stepTrace ? this._stepTrace.step === 0 : true; },
  isAtEnd() { return this._stepTrace ? this._stepTrace.step >= this._stepTrace.scheduleLength : true; },
};
