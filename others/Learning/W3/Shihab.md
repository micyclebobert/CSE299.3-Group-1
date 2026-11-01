# Work Done Today

## Sprint 3 — Member 3 (Inspector)

I implemented the read-only inspector leaf modules for SimQC. These modules only read from `StepTrace.currentState()` and never mutate simulation state.

### Files created

- `src/inspector/Inspector.js` — Main orchestrator. Exposes `amplitudes()` (amplitude + probability per basis state), `probabilities()`, and `ketLabels()` (big-endian ket labels like `|00>`). Holds sub-instances of Purity, Bloch, and Histogram.
- `src/inspector/Purity.js` — Computes single-qubit purity `γ_q = Tr(ρ_q²)` and linear entropy `S_L = 1 − γ_q`. Builds the reduced density matrix for a qubit by summing over basis states. Writes results into a pre-allocated `Float64Array` buffer.
- `src/inspector/Bloch.js` — Computes the Bloch vector `r = (2 Re[ρ01], −2 Im[ρ01], ρ00 − ρ11)` for a qubit. Can write x, y, z into a buffer at a given offset.
- `src/inspector/Histogram.js` — Shot sampler. Draws repeated measurement samples from the pre-collapse probability distribution and returns a `Map<number, number>` of outcome counts summing to the number of shots.

### Fix made

- `src/inspector/InspectorUI.js` — Changed `this._stepTrace.currentState()` to `this._stepTrace.currentState` because `currentState` is a getter on `StepTrace`, not a method.

### Notes

- No imports from `debugger/` or `ai/`, keeping the inspector a deletable leaf.
- Tests under `test/inspector/` were not added because Node.js is not available in this environment to validate them.
