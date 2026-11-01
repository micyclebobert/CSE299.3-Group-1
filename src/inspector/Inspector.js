import { Purity } from './Purity.js';
import { Bloch } from './Bloch.js';
import { Histogram } from './Histogram.js';

export class Inspector {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
    this.purity = new Purity(stepTrace);
    this.bloch = new Bloch(stepTrace);
    this.histogram = new Histogram(stepTrace);
  }
  amplitudes() {
    const cs = this._stepTrace.currentState;
    const size = cs.size();
    const out = [];
    for (let i = 0; i < size; i++) {
      out.push({ index: i, re: cs.getRe(i), im: cs.getIm(i), prob: cs.probability(i) });
    }
    return out;
  }
  probabilities() {
    return this._stepTrace.currentState.probabilities();
  }
  ketLabels() {
    const n = this._stepTrace.currentState.numQubits();
    const size = 1 << n;
    const labels = [];
    for (let i = 0; i < size; i++) {
      labels.push('|' + i.toString(2).padStart(n, '0') + '>');
    }
    return labels;
  }
}
