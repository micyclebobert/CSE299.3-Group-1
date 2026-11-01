export class Purity {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
  }
  gamma(q, outBuffer) {
    const cs = this._stepTrace.currentState;
    const n = cs.numQubits();
    const size = cs.size();
    const half = size >> 1;
    // reduced density matrix for qubit q
    // rho00 = sum over basis with bit q=0 |amp|^2
    // rho01 = sum over pairs differing in bit q
    let rho00 = 0, rho11 = 0;
    let re01 = 0, im01 = 0;
    const bit = 1 << (n - 1 - q);
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
    const gamma = rho00 * rho00 + rho11 * rho11 + 2 * (re01 * re01 + im01 * im01);
    if (outBuffer) outBuffer[q] = gamma;
    return gamma;
  }
  linearEntropy(q) { return 1 - this.gamma(q); }
  computeAll(outBuffer) {
    const n = this._stepTrace.currentState.numQubits();
    for (let q = 0; q < n; q++) this.gamma(q, outBuffer);
    return outBuffer;
  }
}
