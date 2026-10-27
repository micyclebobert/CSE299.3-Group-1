// =============================================================================
// src/inspector/InspectorUI.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: bottom-panel readouts (amplitudes, probabilities,
// per-qubit Bloch spheres) reading StepTrace. Imported exclusively by main.js.
// =============================================================================

export class InspectorUI {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
  }
  probabilities() {
    const state = this._stepTrace.currentState();
    return state.probabilities();
  }
}
