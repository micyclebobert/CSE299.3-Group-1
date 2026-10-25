export class StateVector {
  #numQubits;
  #size;
  #re;
  #im;

  constructor(numQubits) {
    this.#numQubits = numQubits;
    this.#size = 1 << numQubits;
    this.#re = new Float64Array(this.#size);
    this.#im = new Float64Array(this.#size);
    this.#re[0] = 1.0;
  }

  numQubits() {
    return this.#numQubits;
  }

  size() {
    return this.#size;
  }

  getRe(i) {
    return this.#re[i];
  }

  getIm(i) {
    return this.#im[i];
  }

  probability(i) {
    const r = this.#re[i];
    const im = this.#im[i];
    return r * r + im * im;
  }

  probabilities() {
    const out = new Float64Array(this.#size);
    for (let i = 0; i < this.#size; i++) {
      const r = this.#re[i];
      const im = this.#im[i];
      out[i] = r * r + im * im;
    }
    return out;
  }

  normSquared() {
    let sum = 0.0;
    for (let i = 0; i < this.#size; i++) {
      const r = this.#re[i];
      const im = this.#im[i];
      sum += r * r + im * im;
    }
    return sum;
  }

  renormalize() {
    const norm = Math.sqrt(this.normSquared());
    if (!Number.isFinite(norm) || norm === 0.0) {
      throw new Error("Cannot renormalize a non-finite or zero StateVector");
    }
    for (let i = 0; i < this.#size; i++) {
      this.#re[i] /= norm;
      this.#im[i] /= norm;
    }
  }

  get(i) {
    return [this.#re[i], this.#im[i]];
  }

  set(i, re, im) {
    if (typeof re !== "number" || typeof im !== "number") {
      throw new TypeError("set(i, re, im) accepts raw numbers only");
    }
    this.#re[i] = re;
    this.#im[i] = im;
  }

  clone() {
    const copy = new StateVector(this.#numQubits);
    copy.getRawRe().set(this.#re);
    copy.getRawIm().set(this.#im);
    return copy;
  }

  getRawRe() {
    return this.#re;
  }

  getRawIm() {
    return this.#im;
  }
}
