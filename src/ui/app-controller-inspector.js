export const inspectorMethods = {
  probabilities() { return this._inspector ? this._inspector.probabilities() : new Float64Array(0); },
  amplitudes() { return this._inspector ? this._inspector.amplitudes() : []; },
  ketLabels() { return this._inspector ? this._inspector.ketLabels() : []; },
  linearEntropy(q) { return this._inspector ? this._inspector.purity.linearEntropy(q) : 0; },
  purityGammas() {
    const n = this.numQubits;
    const out = new Float64Array(n);
    for (let q = 0; q < n; q += 1) out[q] = this.linearEntropy(q);
    return out;
  },
  bloch(q) { return this._inspector ? this._inspector.bloch.vector(q) : { x: 0, y: 0, z: 0 }; },
  draw() {
    if (!this._currentCircuit || !this._renderCb) return;
    this._renderCb({ circuit: this._currentCircuit, purity: this.purityGammas() });
  },
};
