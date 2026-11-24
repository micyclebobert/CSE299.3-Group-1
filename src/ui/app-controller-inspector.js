export const inspectorMethods = {
  probabilities() { return this._inspector ? this._inspector.probabilities() : new Float64Array(0); },
  amplitudes() { return this._inspector ? this._inspector.amplitudes() : []; },
  ketLabels() { return this._inspector ? this._inspector.ketLabels() : []; },
  linearEntropy(q) { return this._inspector && this._inspector.purity ? this._inspector.purity.linearEntropy(q) : 0; },
  purityGamma(q) { return this._inspector && this._inspector.purity && typeof this._inspector.purity.gamma === 'function' ? this._inspector.purity.gamma(q) : 1; },
  purityGammas() {
    const n = this.numQubits;
    const out = new Float64Array(n);
    for (let q = 0; q < n; q += 1) out[q] = this.linearEntropy(q);
    return out;
  },
  gammas() {
    const n = this.numQubits;
    const out = new Float64Array(n);
    for (let q = 0; q < n; q += 1) out[q] = this.purityGamma(q);
    return out;
  },
  densityMatrix(q) {
    if (!this._inspector) return { rho00: 1, rho11: 0, re01: 0, im01: 0 };
    const cs = this._stepTrace ? this._stepTrace.currentState : null;
    if (!cs) return { rho00: 1, rho11: 0, re01: 0, im01: 0 };
    const n = cs.numQubits();
    const size = cs.size();
    const bit = 1 << q;
    let rho00 = 0, rho11 = 0, re01 = 0, im01 = 0;
    for (let i = 0; i < size; i++) {
      const prob = cs.getRe(i) * cs.getRe(i) + cs.getIm(i) * cs.getIm(i);
      if (i & bit) rho11 += prob; else rho00 += prob;
    }
    for (let i = 0; i < size; i++) {
      if (!(i & bit)) {
        const j = i | bit;
        re01 += cs.getRe(i) * cs.getRe(j) + cs.getIm(i) * cs.getIm(j);
        im01 += cs.getIm(i) * cs.getRe(j) - cs.getRe(i) * cs.getIm(j);
      }
    }
    return { rho00, rho11, re01, im01 };
  },
  bloch(q) { return this._inspector ? this._inspector.bloch.vector(q) : { x: 0, y: 0, z: 0 }; },
  stateVectorText() {
    if (!this._inspector) return '';
    const amps = this.amplitudes();
    const labels = this.ketLabels();
    const n = this.numQubits;
    const lines = [];
    let allZero = true;
    for (let i = 0; i < amps.length; i += 1) {
      const a = amps[i];
      if (a.prob > 1e-12) allZero = false;
    }
    if (allZero && amps.length > 0) {
      lines.push(`|0${'0'.repeat(n - 1)}>: 1.000000 + 0.000000i  (prob 1.000000, phase 0.000000 rad)`);
      return lines.join('\n');
    }
    for (let i = 0; i < amps.length; i += 1) {
      const a = amps[i];
      const phase = Math.atan2(a.im, a.re);
      lines.push(`${labels[i]}: ${a.re.toFixed(6)} ${a.im >= 0 ? '+' : '-'} ${Math.abs(a.im).toFixed(6)}i  (prob ${a.prob.toFixed(6)}, phase ${phase.toFixed(6)} rad)`);
    }
    return lines.join('\n');
  },
  draw() {
    if (!this._currentCircuit || !this._renderCb) return;
    this._renderCb({
      circuit: this._currentCircuit,
      purity: this.purityGammas(),
      entropy: this.purityGammas(),
      gamma: this.gammas(),
    });
  },
};
