export class Histogram {
  constructor(stepTrace) { this._stepTrace = stepTrace; }
  sample(shots, rng = Math.random) {
    const cs = this._stepTrace.currentState;
    const size = cs.size();
    const probs = new Float64Array(size);
    let acc = 0;
    for (let i = 0; i < size; i++) {
      const p = cs.probability(i);
      probs[i] = acc + p;
      acc += p;
    }
    const counts = new Map();
    for (let s = 0; s < shots; s++) {
      const r = rng();
      let idx = size - 1;
      for (let i = 0; i < size; i++) {
        if (r < probs[i]) { idx = i; break; }
      }
      counts.set(idx, (counts.get(idx) || 0) + 1);
    }
    return counts;
  }
}
