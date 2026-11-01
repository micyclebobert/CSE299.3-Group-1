export class Bloch {
  constructor(stepTrace) { this._stepTrace = stepTrace; }
  vector(q, outBuffer, offset = 0) {
    const cs = this._stepTrace.currentState;
    const n = cs.numQubits();
    const size = cs.size();
    const bit = 1 << (n - 1 - q);
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
    const x = 2 * re01;
    const y = -2 * im01;
    const z = rho00 - rho11;
    if (outBuffer) {
      outBuffer[offset] = x;
      outBuffer[offset + 1] = y;
      outBuffer[offset + 2] = z;
    }
    return { x, y, z };
  }
}
