// =============================================================================
// src/debugger/DebuggerUI.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: stepwise playback controls reading StepTrace.
// Imported exclusively by main.js. Deleting this folder requires at most a
// 2-line diff in main.js.
// =============================================================================

export class DebuggerUI {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
  }
  step() {
    this._stepTrace.next();
  }
  seek(col) {
    this._stepTrace.seek(col);
  }
}
