# `CONVENTIONS.md` — SimQC Architecture & Simulation Core

> **Normative Contract:** This document is the single source of truth for the SimQC simulation engine, data model, execution pipeline, and module boundaries. If code and this document disagree, this document wins. Any architectural change requires updating this file in the same pull request.

---

## 1. Purpose, Runtime Contract & Design Principles

This specification fixes the numerical, memory, and structural conventions of SimQC **before** implementation of the state-vector engine and UI layers, because these decisions propagate into every gate-application kernel, the measurement module, serialization schema, debugger trace, and test suite.

### 1.1 Bare Node.js CLI Execution Contract
SimQC runs in the browser and in **bare Node.js** with **strictly zero external dependencies** and **no build step** (no `npm` packages, no Vite/Webpack bundlers, no external quantum SDKs such as Qiskit, Cirq, or PennyLane, and no Closure JSDoc `checkJs` ceremony). Bare Node serves three mandatory roles:
1. **Headless Unit & Property Testing:** All engine suites execute directly via native `node --test` and native ES Modules (`import ... from './file.js'`).
2. **Real-Time Cross-Library Differential Pipe (`stdin` $\to$ `stdout`):** The CLI runner accepts canonical v1 JSON circuits on `stdin` and outputs final state vectors to `stdout`, allowing external Python verification scripts to test SimQC against Qiskit and Cirq in real time without browser orchestration.
3. **Zero-DOM Architectural Guardrail:** Core math, circuit, and simulator modules must never reference `window`, `document`, or DOM globals. Running in bare Node enforces this invariant automatically—any DOM reference crashes immediately.

### 1.2 Four Foundational Rules
1. **The core thinks in indices; the UI thinks in labels.** No display formatting or big-endian string reversal ever leaks into the simulation core, and no index bit-math or normalization is ever performed in the UI.
2. **Qubit rows, not wires.** A circuit grid has no "wires" metaphor; each new qubit is simply a horizontal **qubit row** indexed $q \in \{0, \dots, n-1\}$ from top to bottom.
3. **The hot path allocates nothing.** Gate-application kernels operate exclusively on raw IEEE-754 `number` scalars over pre-allocated `Float64Array` buffers. `Complex` and `Matrix` objects are **never** constructed or accessed inside execution loops.
4. **Bare functions + ESM namespace imports for V8 inlining.** Hot-path kernels are written as **bare module-level functions** (never static class methods) and consumed via native ESM namespace imports (`import * as Kernel from './kernel.js'`). Module namespaces are immutable bindings resolved at parse/link time, eliminating V8 Inline Cache (IC) property lookups and implicit `this` receivers so TurboFan inlines kernels directly into register-level scalar operations.

### 1.3 Code Hygiene & Scratch Directories
* **Naming Convention:** Standard JS conventions; filename must match primary export 1:1 (`PascalCase.js` for data/value classes, `camelCase.js` for bare-function modules).
* **No Barrel Files:** Import concrete module files directly with explicit `.js` extensions.
* **File Size Cap:** Maximum $400$ lines per file.
* **Bindings:** Use `const` by default (`prefer-const`); zero module-level mutable state.
* **License Headers:** Omitted during active development.
* **Scratch Directories:**
  * `.tmp/` — Ephemeral scratch files/folders; may be deleted at any time.
  * `.dump/` — Semi-permanent artifacts, benchmark logs, and differential test dumps.
* **Source Directory Layout:** `TBD Placeholder` *(final folder hierarchy deferred until module boundaries stabilize).*

---

## 2. Bit Ordering / Endianness

**Decision: Little-endian internal indexing. Qubit row $q$ corresponds to bit $q$ of the amplitude index $i$.**

* Amplitude index $i$ ($0 \le i < 2^n$) is the coefficient $\alpha_i$ of computational basis state $\lvert i\rangle$.
* Qubit row $q$ of basis state $\lvert i\rangle$ has binary value `(i >>> q) & 1`.
* **Qubit $0$ (top row in the UI) is the least significant bit (LSB):** bit mask `1 << 0 = 1`, stride $1$.
* Qubit $q$ has bit mask `1 << q` and block stride $2^q$.
* The partner index for a single-qubit operation targeting qubit row $t$ is:
  $$j = i \oplus 2^t \quad \Longleftrightarrow \quad \texttt{j = i \^{} (1 << t)}$$
* A positive control mask over control qubit rows $C = \{c_1, c_2, \dots\}$ is the bitwise OR of `(1 << c)` for all $c \in C$.

```js
// Canonical 3-qubit example (n = 3):
// Amplitude index i = 0b010 = 2  ==>  q0 = 0, q1 = 1, q2 = 0
// Big-endian UI ket label: |q2 q1 q0> = |010>
```

* **Rationale:** Trivial bit shifts (`1 << q`); matches Qiskit's internal statevector ordering, enabling direct index-for-index differential testing.
* **UI Display Rule:** The UI renders basis labels in big-endian ket order $\lvert q_{n-1} \dots q_1 q_0\rangle$ so that top-to-bottom row reading matches left-to-right ket reading. This bit-reversal happens **strictly** in the UI/visualization layer—never in core modules or unit test assertions.
* **Serialization Rule:** JSON stores qubit row indices as integers (`0`, `1`, ...) and mandates `"bitOrder": "little-endian"`.

---

## 3. State Vector Representation & Tiered Memory Ceiling

### 3.1 Split `Float64Array` Memory Layout
**Decision: Two parallel private `Float64Array` buffers, `re[]` and `im[]`, each of length $2^n$.**

* Amplitude $\alpha_i = \text{re}[i] + i\,\text{im}[i]$ consumes exactly $16\text{ bytes}$ ($2 \times 8\text{-byte}$ IEEE-754 doubles), compared to $40\text{--}56\text{ bytes}$ per V8 `Complex` heap object ($\approx 3\times$ memory reduction and zero GC pressure).
* Interleaved single-array layouts (`[re0, im0, re1, im1, ...]`) and arrays of `Complex` instances are **strictly forbidden**.
* **Initialization Invariant:** A fresh `new StateVector(n)` initializes strictly to $\lvert 00\dots 0\rangle$: `re[0] = 1.0`, and all other `re[i] = 0.0`, `im[i] = 0.0`. Never `NaN`, never `undefined`.

**Public Facade Contract (`StateVector`):**
```js
class StateVector {
  constructor(n)             // allocates re[] and im[] of length 2^n; state = |00...0> (re[0] = 1)
  numQubits()                // -> n
  size()                     // -> 2^n (1 << n)
  getRe(i)                   // -> number (re[i])
  getIm(i)                   // -> number (im[i])
  get(i)                     // -> [re, im] (for tests/UI outside hot loops only)
  set(i, re, im)             // raw numbers only — passing Complex objects is FORBIDDEN
  normSquared()              // -> sum_i (re[i]^2 + im[i]^2)
  probability(i)             // -> re[i]^2 + im[i]^2
  probabilities()            // -> new Float64Array(2^n) of |alpha_i|^2
  clone()                    // -> deep copy of StateVector (used by shot sampling & dense trace)
}
```
* Internal execution kernels (`kernel.js`, `StepTrace.js`) access `re[]` and `im[]` directly via explicit internal buffer getters so inner loops remain 100% allocation-free.

### 3.2 Tiered Qubit Capacity & Memory Thresholds
To support both instantaneous pedagogical debugging and high-qubit benchmarking without browser Out-Of-Memory (OOM) crashes, SimQC enforces a **tiered qubit ceiling**:

| Qubit Regime | Vector Size ($2 \times 8 \times 2^n$) | `evaluate()` Policy | `StepTrace` Mode | Purity / Entanglement Policy |
|---|---|---|---|---|
| **$n \le 12$** *(Primary Scope)* | $\le 64\text{ KB}$ | Unrestricted | **Dense Mode** (snapshots every virtual column; $< 1.5\text{ MB}$ RAM, $O(1)$ scrubbing) | Automatic after every step ($< 0.2\text{ ms}$) |
| **$13 \le n \le 14$** | $128\text{ KB} \to 256\text{ KB}$ | Unrestricted (no warning) | **Ephemeral Replay Mode** (single working buffer pair; zero allocation on step) | Debounced or on-demand inspection |
| **$15 \le n \le 20$** | $512\text{ KB} \to 16.8\text{ MB}$ | Permitted with **UI Advisory Warning** | **Ephemeral Replay Mode** (single buffer pair; lazy replay on backward seek) | On-demand click only |
| **$n > 20$** *(Hard Cap $n = 24$)* | $33.5\text{ MB} \to 268.4\text{ MB}$ | **Hard Refusal on Browser Main Thread** (reserved for headless Node CLI) | Disabled in browser UI | Disabled in browser UI |

---

## 4. Hot-Path Kernel Rules

Every function that mutates state-vector buffers (`kernel.js`, measurement collapse, normalization) must obey these six rules:

1. **Bare Module Functions Only:** Export kernels as bare functions (`export function applySingleQubitGate(...)`) and import via `import * as Kernel from './kernel.js'`. Never wrap kernels in static class methods.
2. **Zero Heap Allocation:** No `Complex`, no `Matrix`, no temporary objects, no closures, and no array literals inside loops. Use the canonical unrolled $2 \times 2$ scalar complex update on flat 8-number gate tuples `g = [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]`:
   ```js
   const a0r = re[i0], a0i = im[i0], a1r = re[i1], a1i = im[i1];
   re[i0] = g00re * a0r - g00im * a0i + g01re * a1r - g01im * a1i;
   im[i0] = g00re * a0i + g00im * a0r + g01re * a1i + g01im * a1r;
   re[i1] = g10re * a0r - g10im * a0i + g11re * a1r - g11im * a1i;
   im[i1] = g10re * a0i + g10im * a0r + g11re * a1i + g11im * a1r;
   ```
3. **Stride-$2^t$ Block Iteration (No Double-Visiting):** For target qubit row $t$, set `halfBlock = 1 << t` and `fullBlock = 2 << t`. Step the outer loop by `fullBlock` and the inner loop by `1` across `[blockStart, blockStart + halfBlock)`, pairing `i0` (where bit $t$ is $0$) with `i1 = i0 | halfBlock` (where bit $t$ is $1$). Every disjoint pair $(i_0, i_1)$ is visited exactly once.
4. **Controlled & Anti-Controlled Pass-Through:** When `controlMask !== 0` or `antiControlMask !== 0`, the pair update executes **only** when:
   ```js
   (i0 & controlMask) === controlMask && (i0 & antiControlMask) === 0
   ```
   Non-matching amplitude pairs must remain **bit-identical** (`Object.is`)—never rounded, scaled, or rewritten.
5. **Control/Target & Intra-Column Disjointness:** A gate may never use the same qubit row as both control and target (`(controlMask & (1 << target)) === 0`). All gates within a single execution column must act on mutually disjoint target qubit rows.
6. **Single Complex Multiplication Identity:** $(a + bi)(c + di) = (ac - bd) + (ad + bc)i$ is implemented once in `Complex.js` (for gate authoring) and once in the unrolled kernel pattern above.

---

## 5. Gate Representation & Library Tiers

### 5.1 Dual Representation: Authoring `Matrix` vs. Runtime Flat Tuple
**Decision: Gates are authored using `Complex` and `Matrix` once for human readability, validated for unitarity, and flattened at definition time into 8-number tuples.**

* **Authoring & Differential Reference (`Complex.js`, `Matrix.js`):**
  * `Matrix` supports general $N \times N$ complex matrix products and Kronecker tensor products ($A \otimes B$), used **only** once at gate-definition time and in the $\mathcal{O}(4^n)$ naive differential testing harness ($n \le 6$).
  * At construction time, every gate verifies unitarity $\lVert G^\dagger G - I\rVert_F < 10^{-12}$ and throws immediately on violation.
* **Runtime Execution Format (`number[8]` / `Float64Array(8)`):**
  * Every single-qubit gate carries a flat 8-number tuple:
    ```js
    [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]
    ```
  * Parameterized rotation gates ($R_x(\theta), R_y(\theta), R_z(\theta)$) are pure functions $\theta \mapsto \text{flat tuple}$, where $\theta$ is strictly in **radians** ($R_x(\pi) \equiv -iX$ up to global phase is verified as a test case, never used as an implementation shortcut).
  * **Multi-Qubit Gates (`CNOT`, `CZ`, `SWAP`, `Toffoli`):** Executed via dedicated bare-function index permutations/phase flips (e.g., `CNOT` swaps `re[i0] <-> re[i1]` and `im[i0] <-> im[i1]` in place with zero floating-point multiplications; `CZ` negates `re[i1]` and `im[i1]`), **never** via $4 \times 4$ dense matrices.
* **No Time Parameter ($t$):** Continuous animation time $t$ is completely omitted from gate definitions, `Evaluator`, and `StepTrace`.

### 5.2 Gate Library Tiers
1. **Committed Core Deliverable:** Pauli $X, Y, Z$, Hadamard $H$, $\text{CNOT}$, and Rotations $R_x(\theta), R_y(\theta), R_z(\theta)$.
2. **Planned Standard Extensions:** $I, S, T, \text{CZ}, \text{SWAP}, \text{Toffoli}$.
3. **Might-Do / Algorithm Helper Tier:** $S^\dagger$, `AntiControl`, modular/integer arithmetic gates (`Add`, `Sub`, `Mult`, `Increment`, `Decrement`), and reusable composite subcircuits built as needed to streamline implementing $\ge 3$ canonical algorithms (Deutsch–Jozsa, Grover, QFT, Shor).

---

## 6. Execution Pipeline, Dual-Layer Flattening & Tiered `StepTrace`

### 6.1 Dual-Layer Flattening Pipeline (`Flatten.js`)
To serve both the 1D AI/cache contract and the 2D column-wise quantum debugger without exposing non-physical intra-column states, circuit flattening proceeds in two stages:

1. **Layer 1 — Canonical 1D Flattening (`flattenCircuit(circuit)`):**
   Recursively inlines nested subcircuits in left-to-right column order and top-to-bottom row order, producing a deterministic 1D `Instruction[]` DTO consumed by the AI module and `SHA-256` explanation cache:
   ```js
   {
     gateId: "H",
     target: 0,              // Target qubit row index
     controls: [{ row: 1, on: true }],
     thetaRad: undefined,    // Numeric angle in radians if parameterized
     column: 3,              // Top-level editor column index
     virtualColumn: 5,       // Expanded execution column index (after subcircuit inlining)
     subcircuit: "Grover"    // Origin breadcrumb (undefined for top-level gates)
   }
   ```
2. **Layer 2 — Schedule Projection (`scheduleColumns(instructions)`):**
   A lightweight, zero-copy grouper that buckets adjacent instructions sharing the same `virtualColumn` into 2D `ExecutionColumn[]` slices.

### 6.2 `Evaluator` & Tiered Adaptive `StepTrace`
* **`evaluate(schedule, numQubits) -> StateVector`:** Fast single-buffer execution from virtual column $0$ to the end with zero intermediate state allocations.
* **`createStepTrace(schedule, numQubits) -> StepTrace`:** Produces the shared trace object consumed by `debugger`, `inspector`, and `ai` (owned by none of them).
  * **Dense Mode ($n \le 12$):** Lazily clones `re[]` and `im[]` strictly at **virtual column boundaries** into a snapshot array ($\approx 1.3\text{ MB}$ for $20$ columns at $n = 12$) for $O(1)$ timeline scrubbing.
  * **Ephemeral Replay Mode ($n > 12$):** Sets `snapshots = null` and maintains strictly **one** working buffer pair (`re[]`, `im[]`), mutating in place on `next()` and replaying from column $0$ on backward `seek()` with zero heap allocations.
  * **Uniform `StepTrace` API:** `reset()`, `next()`, `seek(targetVirtualCol)`, and `findStepWhere(predicate)` (evaluates breakpoints in place against active working buffers without allocating intermediate `StateVector` instances).

---

## 7. Normalization & Numerical Invariants

* **Test-Only Per-Gate Normalization Check vs. Fast Browser Execution:**
  * **In Automated Tests (`node --test` / Debug Mode):** After **every** gate application, verify $\lVert\lvert\psi\rangle\rVert^2$ against $1.0$:
    * Drift $\le 10^{-9}$: do nothing (expected IEEE-754 rounding).
    * Drift $> 10^{-9}$: renormalize **and log a warning** (indicates an upstream kernel bug; silent renormalization is forbidden).
    * Any `NaN` or `Infinity` in `re[]` or `im[]`: throw immediately.
  * **In Browser Production Runtime:** Skip per-gate $\mathcal{O}(2^n)$ norm-reduction passes during `evaluate()` and interactive `StepTrace` stepping to preserve memory bandwidth and $60\text{ fps}$ responsiveness.
* **Untouched-Amplitude Invariant:** Any amplitude index not targeted by a gate (or excluded by its control mask) must remain **bit-identical** (`Object.is(before, after) === true`).
* **Global Phase Preservation:** No global-phase canonicalization; $\lvert\psi\rangle$ and $e^{i\phi}\lvert\psi\rangle$ remain distinct in memory.
* **Numerical Tolerances:** $10^{-12}$ for $n \le 8$; $10^{-9}$ for $n > 8$.

---

## 8. Measurement Module

* **Module, Not Gate:** Measurement is non-unitary and lives in a dedicated `measurement/` module, never inside `gates/`.
* **Single-Shot Collapse:** Draw basis index $i$ according to Born probabilities $P(i) = \lvert\alpha_i\rvert^2$, then collapse the state **in place**: set `re[i] = 1.0`, `im[i] = 0.0`, and zero all other entries.
* **Repeated-Shot Histogram Sampling:** Call `state.clone()` once prior to measurement and sample $S$ independent shots against the preserved pre-measurement distribution to populate the empirical frequency histogram.

---

## 9. Single-Qubit Purity, Entanglement Highlighting & Bloch Vectors

* **Why Pairwise $c_{00}c_{11} - c_{01}c_{10} = 0$ Is Forbidden:** Only valid for isolated 2-qubit pure states; fails on $n > 2$ subsystems and misses multipartite GHZ entanglement entirely.
* **Exact Single-Qubit Reduced Density Matrix ($\rho_q$):**
  For each qubit row $q \in \{0, \dots, n-1\}$, accumulate over all indices $i$ where bit $q = 0$ and partner $j = i \oplus 2^q$:
  $$\rho_{00} = \sum_{i,\, \text{bit } q = 0} \left(\text{re}[i]^2 + \text{im}[i]^2\right), \qquad \rho_{11} = 1 - \rho_{00}, \qquad \rho_{01} = \sum_{i,\, \text{bit } q = 0} \alpha_i \alpha_j^*$$
* **Single-Qubit Purity ($\gamma_q$) & Linear Entropy ($S_L$):**
  $$\gamma_q = \text{Tr}(\rho_q^2) = \rho_{00}^2 + \rho_{11}^2 + 2\left(\text{re}[\rho_{01}]^2 + \text{im}[\rho_{01}]^2\right) \in [0.5, 1.0], \qquad S_L(q) = 1 - \gamma_q \in [0, 0.5]$$
  * $S_L(q) = 0$ ($\gamma_q = 1.0$): Qubit row $q$ is in a separable pure product state.
  * $S_L(q) > 0$ ($\gamma_q < 1.0$): Qubit row $q$ is entangled with the register ($S_L(q) = 0.5$ indicates maximal entanglement).
* **Per-Qubit Bloch Vector ($\vec{r}_q$):**
  Directly derived in the same pass from $\rho_q$ to drive the Bottom Panel's per-qubit Bloch Sphere subtabs:
  $$\vec{r}_q = \left(2\,\text{Re}[\rho_{01}],\; -2\,\text{Im}[\rho_{01}],\; \rho_{00} - \rho_{11}\right), \qquad \lvert\vec{r}_q\rvert = \sqrt{2\gamma_q - 1}$$
* **Ownership & Zero-Allocation Rule:** Computed via a bare function outside `Evaluator`/`StepTrace` into pre-allocated `Float64Array` buffers; owned strictly by `inspector` / `visualization`.

---

## 10. Two-Tier Serialization & Sparse AI Grounding

### 10.1 Tier 1: Canonical v1 JSON Schema (`Serializer.js`)
Used for file I/O, bare Node CLI `stdin`/`stdout` differential pipes, undo/redo verification, and AI Builder/Explainer payloads:
```json
{
  "format": "simqc-circuit",
  "version": 1,
  "bitOrder": "little-endian",
  "numQubits": 3,
  "columns": [
    [
      { "gate": "H", "target": 0 },
      { "gate": "Rx", "target": 1, "thetaRad": 1.5707963267948966 }
    ],
    [
      { "gate": "CNOT", "target": 1, "controls": [{ "row": 0, "on": true }] }
    ]
  ]
}
```
* **Mandatory Rules:**
  1. Qubit references are integer row indices (`0` to `numQubits - 1`), never bit strings.
  2. Gates are referenced strictly by registered string ID (`"H"`, `"CNOT"`), never by inline matrix arrays.
  3. Angles use explicit radian keys (`"thetaRad"`, `"phiRad"`).
  4. Multi-qubit controls use explicit control descriptor arrays (`controls: [{ row: 0, on: true }]`), supporting anti-controls (`on: false`) uniformly.

### 10.2 Tier 2: Ephemeral URL Codec
* Compresses the canonical v1 JSON string via `CompressionStream("deflate-raw")` (or a zero-dependency $\sim 60$-line deflate/LZ helper in bare Node) and encodes to URL-safe Base64 (`[A-Za-z0-9-_]`), shrinking a 15-column, 5-qubit circuit to $< 150$ characters with 100% lossless round-trip fidelity.

### 10.3 Sparse Top-$k$ AI State Grounding (`AI_INTERFACE.md`)
* Never serialize raw $2^n$ state vectors into LLM prompts.
* At each virtual column boundary, summarize the state using **only** basis states with $\lvert\alpha_i\rvert^2 > 10^{-4}$ (capped at top $k = 16$ terms formatted in big-endian ket notation) plus the $n$-element per-qubit marginal probabilities $\rho_{00}(q)$ and linear entropies $S_L(q)$.

---

## 11. Validation Hooks Mandated by This Document

| Convention | Mandatory Automated Test (`node --test`) |
|---|---|
| **Little-endian bidirectional ordering** | Partner-index & stride verification on $n = 3$: `H` on qubit row $1$ pairs $(i, i+2)$; **`CNOT(0→1)` (control = $0$, target = $1$) swaps exactly indices `{1, 3}` and `{5, 7}`**; **`CNOT(1→0)` (control = $1$, target = $0$) swaps exactly indices `{2, 3}` and `{6, 7}`**. |
| **Initialization** | Fresh `new StateVector(n)` equals $\lvert 00\dots 0\rangle$ (`re[0] === 1.0`, all other `re[i] === 0.0`, `im[i] === 0.0`). |
| **Pairwise bare-function kernel** | Differential test against naive $2^n \times 2^n$ `Matrix` Kronecker product path for $n \le 6$ across all 6 amplitude profiles (real, imag, complex, and 3 asymmetric pairs). |
| **Control & anti-control semantics** | Controlled gate leaves non-matching amplitudes **bit-identical** (`Object.is`). |
| **Test-mode normalization** | Norm checked after every gate in test mode ($\in 1 \pm 10^{-9}$); injected drift $> 10^{-9}$ triggers warning + renormalization; `NaN`/`Infinity` throws. |
| **Gate unitarity** | Every gate in `gates/` passes $\lVert G^\dagger G - I\rVert_F < 10^{-12}$ at definition time. |
| **Single-qubit purity ($\gamma_q$)** | Product states yield $\gamma_q = 1.0$ ($S_L = 0$); 2-qubit Bell state and 3-qubit GHZ state yield $\gamma_q = 0.5$ ($S_L = 0.5$) on all entangled rows. |
| **Serialization round-trip** | `fromJson(toJson(circuit))` and URL codec `decode(encode(circuit))` are structurally identical (`isEqualTo`). |
| **Canonical algorithms** | Verify $\ge 3$ of Deutsch–Jozsa, Grover's search, QFT, and Shor's algorithm against theoretical distributions. |

---

## 12. Summary Table

| # | Convention | Normative Decision |
|---|---|---|
| 1 | **Runtime** | Browser + bare Node.js CLI (`node --test`, `stdin`/`stdout` JSON pipe, zero npm packages, zero DOM in core) |
| 2 | **Endianness** | Little-endian internal (`qubit q = bit q`); big-endian ket labels in UI only |
| 3 | **Circuit Metaphor** | Horizontal **qubit rows** ($0 \dots n-1$), no wires; VS Code-style dark-mode dockable panels |
| 4 | **State Memory** | Two parallel private `Float64Array`s (`re[]`, `im[]`), never interleaved |
| 5 | **Qubit Ceilings** | $n \le 12$ Dense Trace; $13 \le n \le 14$ Ephemeral Trace; $15 \le n \le 20$ UI warning + Ephemeral Trace; $n > 20$ refused in UI ($n \le 24$ CLI cap) |
| 6 | **Hot-Path Kernels** | Bare functions + `import * as Kernel`, flat `number[8]` gate tuples, zero heap allocations |
| 7 | **Multi-Qubit Gates** | Dedicated index permutation / phase kernels (`CNOT` swaps `{1,3},{5,7}` for `0→1` and `{2,3},{6,7}` for `1→0` on $n=3$) |
| 8 | **Flattening** | Dual-layer: `flattenCircuit()` (1D for AI/cache) $\to$ `scheduleColumns()` (2D virtual columns for execution) |
| 9 | **Time Parameter ($t$)** | Completely removed from gate definitions, `Evaluator`, and `StepTrace` |
| 10 | **Normalization** | Per-gate norm check runs in automated tests (`> 1e-9` warns); skipped in browser production path |
| 11 | **Entanglement & Bloch** | Single-qubit purity $\gamma_q = \text{Tr}(\rho_q^2)$ and linear entropy $S_L = 1 - \gamma_q$ drive both row glow and Bottom Panel per-qubit Bloch subtabs |
| 12 | **Serialization** | Two-tier: Verbose canonical v1 JSON (`Serializer.js`) + ephemeral `deflate-raw` Base64-URL codec |

---

*Last updated: Update 2 (Master Audit Resolution). Owners: Group 1. Amend via PR only.*