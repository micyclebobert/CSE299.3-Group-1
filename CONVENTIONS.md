# `CONVENTIONS.md` — SimQC Simulation Core

> This file is normative for all code in `core/`, `gates/`, `circuit/`, `measurement/`, and `algorithms/`. If code and this document disagree, this document wins. Changes require a pull request that updates this file in the same commit.

---

## 1. Purpose and Scope

This document fixes the numerical and data-model conventions of the SimQC simulation core **before** the state-vector engine is implemented, because these decisions propagate into every gate-application kernel, the measurement module, serialization format, and all tests.

Two rules follow from everything below:

1. **The core thinks in indices. The UI thinks in labels.** No display formatting ever leaks into the core, and no index arithmetic is ever performed in the UI.
2. **The hot path allocates nothing.** Gate-application kernels operate exclusively on raw `number` scalars. `Complex` and `Matrix` objects are never constructed inside kernel loops.

---

## 2. Bit Ordering / Endianness

**Decision: little-endian. Qubit `q` corresponds to bit `q` of the amplitude index.**

- Amplitude `i` (0 ≤ i < 2ⁿ) is the coefficient of the basis state `|i⟩`.
- Qubit `q` of basis state `|i⟩` is `(i >>> q) & 1`.
- Qubit 0 is the **least significant bit**.
- The partner index for a gate targeting qubit `t` is `j = i ^ (1 << t)`.
- A control mask is the bitwise OR of `(1 << q)` over all control qubits q.

```js
// canonical examples (n = 3)
// index 0b010 = 2  → qubit 0 = 0, qubit 1 = 1, qubit 2 = 0
// labels as |q2 q1 q0⟩
// |010⟩ = |0 1 0⟩
```

**Rationale:** trivial bit math; matches Qiskit's internal ordering [3], simplifying differential testing.

**Display rule:** the UI renders basis labels as `|q_{n-1} … q_1 q_0⟩` (big-endian string) because circuit diagrams draw qubit 0 as the top wire. This reversal happens **only** in `visualization/` and `editor/` — never in the core, and never in test assertions, which always compare raw indices.

**Serialization rule:** JSON stores qubit indices as integers (not bit strings) and includes the field `"bitOrder": "little-endian"`. Consumers must never assume the ordering.

---

## 3. State Vector Representation

**Decision: two parallel `Float64Array`s, `re[]` and `im[]`, each of length 2ⁿ.**

- Amplitude `i` is the complex number `re[i] + i·im[i]`.
- No interleaved layout; no array of objects.
- The arrays are **private** to `StateVector`. All external access goes through the facade API (§4).

**Facade contract (public API of `StateVector`):**

```js
class StateVector {
  constructor(n)                    // allocates arrays, state = |00…0⟩ (re[0] = 1, all else 0)
  numQubits()                       // n
  size()                            // 2^n
  getRe(i)                          // → number
  getIm(i)                          // → number
  get(i)                            // → [re, im]   (outside kernels only)
  set(i, re, im)                    // raw doubles only — Complex objects are FORBIDDEN here
  normSquared()                     // → Σ re[i]² + im[i]²
  probability(i)                    // → re[i]² + im[i]²
  probabilities()                   // → Float64Array of |αᵢ|²
  clone()                           // deep copy (used by debugger and shot sampling)
}
```

- **Initialization invariant:** a fresh `StateVector` is exactly `|00…0⟩` — `re[0] = 1`, every other entry `0`. Never `NaN`, never `undefined`.
- Facade methods `get/set` are for tests, UI, and algorithms; the execution engine accesses the raw arrays through an explicitly-marked internal accessor so the kernel stays allocation-free.

---

## 4. Hot-Path Kernel Rules

These rules apply to every function that mutates the state vector (pairwise gate application, measurement collapse, normalization):

1. **No object allocation.** No `Complex`, no `Matrix`, no intermediate objects, no array literals inside loops. All math is unrolled scalar arithmetic on raw doubles:

```js
// canonical form of one pairwise 2×2 complex update (the ONLY pattern allowed):
// g = [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]  (flat tuple, see §5)
const a0r = re[i0], a0i = im[i0], a1r = re[i1], a1i = im[i1];
re[i0] = g00re*a0r - g00im*a0i + g01re*a1r - g01im*a1i;
im[i0] = g00re*a0i + g00im*a0r + g01re*a1i + g01im*a1r;
re[i1] = g10re*a0r - g10im*a0i + g11re*a1r - g11im*a1i;
im[i1] = g10re*a0i + g10im*a0r + g11re*a1i + g11im*a1r;
```

2. **No double-visiting.** For a target qubit `t`, iterate only indices where bit `t` is 0 (or use block iteration with stride `1 << t`); the partner is `i1 = i0 | (1 << t)`. Each pair is updated exactly once.
3. **Controlled gates.** The pair update runs only when `(i0 & controlMask) === controlMask`. Otherwise both amplitudes are left **bit-identical** — a controlled gate must never perturb, round, or even rewrite amplitudes it does not act on.
4. **Control/target disjointness.** A gate may never use the same qubit as both control and target. Asserted at application time; throws in tests, warns in production.
5. **Gates within a column act on disjoint qubits.** Enforced by the circuit editor; the executor additionally asserts it and applies column gates in left-to-right wire order.
6. **Complex arithmetic identity.** Multiplication is `(a+bi)(c+di) = (ac − bd) + (ad + bc)i`. Implemented exactly once in the kernel pattern above; no module above the complex-number layer reimplements it.

---

## 5. Gate Representation

**Decision: gates are defined with `Complex`/`Matrix` once, then flattened.**

- Each 2×2 gate has a canonical **flat tuple**: `[g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]` — a plain `number[]` of length 8, built at gate-definition time.
- Kernel signatures take flat tuples, never `Matrix` objects:

```js
applyGate(state, gateFlat, targetQubit, controlMask = 0)
```

- A gate is **named** and **parameterized** separately: a parameterized gate (e.g. `Rx(θ)`) is a function `θ → flat tuple`; θ is in **radians**. (`Rx(π)` ≡ X up to global phase; this equivalence is a test case, not an implementation shortcut.)
- Multi-qubit gates (CNOT, CZ, SWAP, Toffoli) are implemented as dedicated kernels (e.g., CNOT as in-place amplitude swap between `i0 = i & ~targetMask` and `i1 = i | targetMask` when the control mask matches), not as 4×4 dense products. SWAP is three CNOTs or a direct three-way exchange — either is acceptable, but the choice must be tested for both orderings.
- A gate must be **unitary**. The gate library validates unitarity of each defined gate at construction (‖G†G − I‖ < 1e-12) and throws otherwise.

---

## 6. Execution Model and Circuit Data Model

- A circuit is an **ordered list of columns** (time flows left → right), each column holding operations on specific qubits.
- Application order across columns: **column 0 first**. The composite unitary is `U = U_k ⋯ U_2 U_1` — matrices compose right-to-left even though columns are read left-to-right. The executor applies in column order; no code may build the composite matrix.
- The core is **fully functional with no UI attached** and is the only owner of the state vector. The UI issues commands like `"H on qubit 2 at column 4"` and never performs index arithmetic or normalization.

---

## 7. Normalization and Numerical Invariants

- After **every** gate application, the executor checks `‖|ψ⟩‖²` against 1.0:
  - drift ≤ 1e-9 → do nothing (normal floating-point behavior);
  - drift > 1e-9 → renormalize **and log a warning** (this indicates an arithmetic bug upstream — silent renormalization is forbidden because it masks exactly the bugs the validation plan is designed to catch);
  - any `NaN`/`Infinity` in the state → throw immediately.
- Untouched-amplitude contract: a gate not targeting qubit k must leave `re[k]`/`im[k]` of indices unaffected by the gate **bit-identical** (`===`, not approximate). Tests assert this with `Object.is` semantics.
- No global-phase canonicalization. `|ψ⟩` and `e^{iφ}|ψ⟩` remain distinct in memory. Initial `|00…0⟩` has α₀ = 1 + 0i.
- Tolerance convention everywhere else in tests: **1e-12** for n ≤ 8, **1e-9** for larger states.

---

## 8. Measurement

- Measurement is a **module, not a gate** — it is non-unitary and breaks the reversible pipeline.
- A single shot: draw `i` with probability `|αᵢ|²`, then **collapse in place**: `re[i] = 1, im[i] = 0`, all other entries 0.
- Repeated-shot sampling always re-simulates from the pre-measurement state (`clone()` before the first collapse); the empirical frequencies form the histogram.
- The debugger may read the state **before** measurement; the pre-measurement copy is owned by the debugger, not the core.

---

## 9. Serialization (JSON)

```json
{
  "format": "simqc-circuit",
  "version": 1,
  "bitOrder": "little-endian",
  "numQubits": 3,
  "columns": [
    [ { "gate": "H", "target": 0 },
      { "gate": "H", "target": 1 } ],
    [ { "gate": "CNOT", "control": 0, "target": 1 } ]
  ]
}
```

- Qubit references are integers, never bit strings.
- `bitOrder` is mandatory in the schema so old saved circuits remain interpretable if conventions ever change.
- Rotation parameters are serialized in radians, with the field name including the unit (e.g. `"thetaRad"`).

---

## 10. Validation Hooks Mandated by This Document

| Convention | Test that must exist |
|---|---|
| Little-endian ordering | Partner-index correctness: `H` on qubit 1 of 3-qubit state pairs (i, i+2); CNOT(0→1) swaps exactly indices {2,3} and {6,7} |
| Initialization | Fresh state ≡ \|00…0⟩ exactly |
| Pairwise kernel | Differential test vs. naive `Matrix`/Kronecker path for n ≤ 6, random states, all gates |
| Control semantics | Controlled gate leaves control-0 amplitudes bit-identical |
| Normalization | Norm after every gate ∈ 1 ± 1e-9; drift produces warning, not silent fix |
| Untouched amplitudes | Bit-identical pass-through for gates on other qubits |
| Unitarity | Every gate in the library passes G†G = I at 1e-12 |
| Endianness serialization | Round-trip: circuit → JSON → circuit is identity |

---

## 11. Summary Table

| # | Convention | Decision |
|---|---|---|
| 1 | Endianness | Little-endian (qubit q = bit q of index) |
| 2 | Display | Big-endian label strings, UI-only |
| 3 | Memory | Two `Float64Array`s (`re[]`, `im[]`), private to `StateVector` |
| 4 | State API | Facade with raw-double `set(i, re, im)`; no `Complex` in/out of state |
| 5 | Kernel | Scalar, allocation-free, single canonical 2×2 pattern |
| 6 | Gate form | Flat 8-number tuple; `Matrix` used only at definition time |
| 7 | Controls | Mask check `(i & mask) === mask`; bit-identical pass-through otherwise |
| 8 | Columns | Left-to-right execution; disjoint-qubit constraint per column |
| 9 | Normalization | Check every gate; renormalize only on >1e-9 drift, with warning |
| 10 | Measurement | Module, not gate; clone-before-collapse for shots |
| 11 | Serialization | Explicit indices, mandatory `bitOrder`, radians |
| 12 | Test tolerance | 1e-12 (n ≤ 8), 1e-9 otherwise |

---

**References:** [3] Qiskit (little-endian internal ordering); [1] Quirk (per-column display model); [11] Viamontes et al. (matrix-free O(2ⁿ) update); [31] OpenQASM (serialization precedent); [40] ECMAScript `Float64Array` spec.

*Last updated: Update 1. Owners: Group 1. Amend via PR only.*