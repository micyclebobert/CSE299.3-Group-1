import { StateVector } from '../core/StateVector.js';
import { sampleHistogram } from '../measurement/measurement.js';

export const shotsMethods = {
  setShots(shots) {
    const value = Number(shots);
    if (!Number.isFinite(value) || value < 1) { this._status(`Invalid shots value ${shots}. Keeping ${this._shots}.`); return; }
    this._shots = Math.max(1, Math.floor(value));
  },
  sampleShots() {
    if (!this._stepTrace) return null;
    const trace = this._stepTrace;
    const state = new StateVector(trace.numQubits);
    const size = trace.size;
    const re = state.getRawRe();
    const im = state.getRawIm();
    for (let i = 0; i < size; i += 1) {
      re[i] = trace.currentState.getRe(i);
      im[i] = trace.currentState.getIm(i);
    }
    return sampleHistogram(state, this._shots);
  },
};
