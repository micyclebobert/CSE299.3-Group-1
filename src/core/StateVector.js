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

  clone() {
    const copy = new StateVector(this.#numQubits);
    copy._re.set(this.#re);
    copy._im.set(this.#im);
    return copy;
  }

  get _re() {
    return this.#re;
  }

  get _im() {
    return this.#im;
  }
}
