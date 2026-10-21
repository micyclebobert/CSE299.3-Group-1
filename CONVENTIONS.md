# `CONVENTIONS.md` — SimQC Engineering & Mathematical Conventions

> **Scope:** This file is the strict, actionable rulebook for all code, data schemas, math kernels, UI modules, and tests in SimQC. Architectural rationale and historical audit details live in `SOURCE_OF_TRUTH.md`.

---

## 1. Code Style, Naming & File Hygiene

* **File Naming Standards (Zero Spaces across the Entire Tree):**
  * **Root Documentation & Project Policies:** Use `SCREAMING_SNAKE_CASE.md` or standard uppercase (e.g., `CONVENTIONS.md`, `README.md`, `SOURCE_OF_TRUTH.md`, `AI_INTERFACE.md`). Spaces in file paths are strictly forbidden.
  * **Environment & Differential Test Manifests:** Use standard lowercase filenames (e.g., `requirements.txt` for the Python Qiskit/Cirq differential CLI pipe).
  * **Classes / Immutable Value Objects:** `PascalCase.js` (e.g., `StateVector.js` exports `class StateVector`).
  * **Bare-Function / Utility Modules:** `camelCase.js` (e.g., `kernel.js`, `renderTypes.js`).
  * **Test Files:** Mirror 1:1 with `*.test.js` suffix (e.g., `kernel.test.js`, `StateVector.test.js`).
* **1:1 Filename-to-Export Mapping:** Every source file exports a primary symbol matching its base filename.
* **Exports & Imports:**
  * Use **named exports only** (`export class ...`, `export function ...`). Default exports are forbidden.
  * Always include **explicit `.js` extensions** in import paths (`import { Complex } from './Complex.js'`).
  * **No Barrel Files:** Never create `index.js` re-export files. Import concrete module files directly.
  * **Namespace Imports for Bare-Function Kernels:** Consume hot-path function modules via `import * as Kernel from './kernel.js'` (never wrap stateless kernels in classes with static methods).
* **Bindings & State:**
  * Use `const` by default (`prefer-const`); use `let` only for loop counters and local accumulators. `var` is forbidden.
  * **Zero Module-Level Mutable State:** Module scope may contain only `const` primitives, frozen lookup tables, and stateless functions/classes.
* **File Size Ceiling:** Maximum **$400$ lines per file** (enforced by CI).
* **Sub Folders:** Create sub folders (recursively) to organize files and frequently check if there's a need to restructure completely.
* **Omitted Ceremony:**
  * **No License Headers:** Do not add boilerplate license headers to source files.
  * **No Closure JSDoc (`checkJs`):** Do not write Closure-style type annotations (`/** @type {!number} */`).
* **Scratch Directories:**
  * `.tmp/` — Ephemeral scratch files; may be deleted at any time and must never be imported by `src/` or `test/`.
  * `.dump/` — Semi-permanent benchmark logs and differential test outputs.

---

## 2. Runtime & Dependency Conventions

* **Zero External Dependencies:** No `npm` packages, no `node_modules`, no bundlers (Vite/Webpack/Rollup), and no external quantum libraries (Qiskit/Cirq/PennyLane) in JS.
* **Dual Runtime Compatibility:** All non-UI modules must execute unmodified in both modern browsers and **bare Node.js** via native ES Modules.
* **CLI Pipe Convention (`stdin` $\to$ `stdout`):** The headless Node CLI runner reads canonical v1 JSON from `stdin` and writes deterministic JSON state-vector output to `stdout` (all diagnostics/warnings must go to `stderr` so `stdout` remains valid JSON).

---

## 3. Layering & Module Boundary Rules

| Rule | Allowed Imports | Forbidden Imports / Globals |
| :--- | :--- | :--- |
| **Engine (`core/`, `circuit/`, `sim/`, `measurement/`)** | Downward engine layers only | `window`, `document`, DOM globals, `canvas/`, `gates/`, feature leaves |
| **`core/` (L1)** | Internal `core/` files only | Everything outside `core/` |
| **`circuit/` (L2)** | `core/` and internal `circuit/` files | `gates/`, `sim/`, `measurement/`, `canvas/`, feature leaves |
| **`sim/` & `measurement/` (L3)** | `core/`, `circuit/` | `gates/`, `canvas/`, feature leaves |
| **`gates/`** | `core/`, `circuit/` | Imported **exclusively** by `main.js` (injected into `circuit/` via `GateRegistry`) |
| **Discardable Leaves (`debugger/`, `inspector/`, `ai/`)** | `core/`, `circuit/`, `sim/` (`StepTrace`) | Imported **exclusively** by `main.js`; **zero imports between any two leaf folders** |
| **Configuration** | Layer-local only | No root `Config.js`; sim limits live in `sim/limits.js`, UI colors/metrics in `canvas/theme.js` |

---

## 4. Domain Terminology & Coordinate Conventions

* **Qubit Rows, Never "Wires":** Use `row` or `qubit` ($q \in \{0, \dots, n-1\}$ from top to bottom) in all identifiers, schemas, and comments. Use `rowSpan` (not `wireSpan`) and `withRows` (not `withWires`).
* **Columns & Time:**
  * Circuits are discrete left-to-right sequences of columns (`column` $0$ executes first: $U = U_{k-1} \cdots U_1 U_0$).
  * Use `column` for the top-level editor column index and `virtualColumn` for the subcircuit-expanded execution column index.
  * **No Continuous Time ($t$):** Never add a time parameter $t$ to `Gate`, `Evaluator`, or `StepTrace` signatures.
* **Core vs. UI Separation:**
  * **Core thinks in integer indices ($0 \le i < 2^n$); UI thinks in formatted string labels.**
  * Never format ket strings in `core/`, `circuit/`, or `sim/`. Never perform bitwise index math or state normalization in `canvas/`, `debugger/`, or `inspector/`.

---

## 5. Bit Ordering & Endianness

* **Little-Endian Internal Indexing:** Qubit row $q$ corresponds to bit $q$ of basis state index $i$ ($0 \le i < 2^n$).
  * **Row $0$ (top editor row) is the LSB:** bit mask `1 << 0 = 1`, stride $1$.
  * **Row $q$ bit value:** `(i >>> q) & 1`.
  * **Row $q$ bit mask & stride:** `mask = 1 << q`, `halfBlock = 1 << q`, `fullBlock = 2 << q`.
  * **Partner index for target row $t$:** `j = i ^ (1 << t)` (or `i1 = i0 | (1 << t)` when bit $t$ of `i0` is $0$).
  * **Control bitmasks:**
    * Positive controls ($c \in C_{\text{on}}$): `controlMask |= (1 << c)`.
    * Anti-controls ($c \in C_{\text{off}}$): `antiControlMask |= (1 << c)`.
* **Big-Endian UI Ket Formatting:**
  * Basis state labels in the UI and AI state summaries must be reversed to big-endian string order $\lvert q_{n-1} \dots q_1 q_0\rangle$ so top-to-bottom rows read left-to-right (e.g., for $n = 3$, index `0b010 = 2` has $q_0 = 0, q_1 = 1, q_2 = 0$ and displays as `|010>`).
  * Unit tests must assert against raw little-endian indices (`0` to $2^n - 1$), never big-endian strings.

---

## 6. `StateVector` Memory Layout & Qubit Ceilings

* **Split Private `Float64Array` Buffers:**
  * Store amplitudes as two parallel arrays `re = new Float64Array(1 << n)` and `im = new Float64Array(1 << n)`.
  * Interleaved single-array layouts and arrays of `Complex` objects are strictly forbidden.
* **Initialization Invariant:** `new StateVector(n)` initializes strictly to $\lvert 00\dots 0\rangle$: `re[0] = 1.0`, and all other `re[i] = 0.0`, `im[i] = 0.0`.
* **Public Facade Signatures:**
  * `numQubits() -> number`, `size() -> number` ($2^n$)
  * `getRe(i) -> number`, `getIm(i) -> number`
  * `get(i) -> [re, im]` *(for tests/UI outside hot loops only)*
  * `set(i, re, im) -> void` *(accepts raw `number` scalars only; passing `Complex` throws/is forbidden)*
  * `normSquared() -> number`, `probability(i) -> number`, `probabilities() -> Float64Array`, `clone() -> StateVector`
  * Internal hot-path kernels access `re` and `im` buffers directly via explicit buffer getters (`getRawRe()`, `getRawIm()`).
* **Tiered Qubit Capacity Thresholds (`sim/limits.js`):**
  * **$n \le 12$:** Unrestricted `evaluate()`; `StepTrace` in **Dense Mode** (clones at every virtual column); automatic per-step purity $\gamma_q$.
  * **$13 \le n \le 14$:** Unrestricted `evaluate()`; `StepTrace` in **Ephemeral Replay Mode** (single working buffer pair); debounced/on-demand purity.
  * **$15 \le n \le 20$:** UI advisory warning required; `StepTrace` in **Ephemeral Replay Mode**; on-demand purity only.
  * **$n > 20$ (Hard CLI Cap $n = 24$):** Hard refusal on browser UI main thread; allowed only in bare Node CLI.

---

## 7. Hot-Path Kernel Conventions (`sim/kernel.js`)

1. **Zero Heap Allocations:** Never instantiate `Complex`, `Matrix`, objects, closures, or array literals inside kernel loops.
2. **Canonical Unrolled $2 \times 2$ Scalar Update:** Single-qubit gates use flat 8-element tuples `g = [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]`:
   ```js
   const a0r = re[i0], a0i = im[i0], a1r = re[i1], a1i = im[i1];
   re[i0] = g00re * a0r - g00im * a0i + g01re * a1r - g01im * a1i;
   im[i0] = g00re * a0i + g00im * a0r + g01re * a1i + g01im * a1r;
   re[i1] = g10re * a0r - g10im * a0i + g11re * a1r - g11im * a1i;
   im[i1] = g10re * a0i + g10im * a0r + g11re * a1i + g11im * a1r;
   ```
3. **Stride-$2^t$ Block Iteration (Single Visit per Pair):**
   * Set `halfBlock = 1 << target` and `fullBlock = 2 << target`.
   * Outer loop increments `blockStart` by `fullBlock`; inner loop iterates `offset` from `0` to `halfBlock - 1`, setting `i0 = blockStart + offset` and `i1 = i0 | halfBlock`.
4. **Control & Anti-Control Bit-Identical Pass-Through:**
   * Execute the pair update **only** when `(i0 & controlMask) === controlMask && (i0 & antiControlMask) === 0`.
   * Non-matching indices must never be touched, scaled, or rewritten (`Object.is(before, after) === true`).
5. **Disjointness Assertions:**
   * Control and target rows must be disjoint: `((controlMask | antiControlMask) & (1 << target)) === 0`.
   * All instructions within a single `ExecutionColumn` must target mutually disjoint qubit rows.

---

## 8. Gate, Circuit & Measurement Conventions

* **Dual Gate Representation:**
  * Author single-qubit gates using `Complex` and `Matrix`, validate unitarity $\lVert G^\dagger G - I\rVert_F < 10^{-12}$ at definition time, and flatten immediately to `Float64Array(8)` / `number[8]`.
  * Parameterized rotations ($R_x(\theta), R_y(\theta), R_z(\theta)$) are pure functions `thetaRad => flatTuple` where angles are strictly in **radians**.
  * Multi-qubit gates ($\text{CNOT}, \text{CZ}, \text{SWAP}, \text{Toffoli}$) execute via dedicated index-swap / phase-flip kernels in `kernel.js`, **never** via $4 \times 4$ matrices.
* **Passive Data Model (`circuit/`):**
  * `Gate`: Passive frozen record `{ id, flatTuple, rowSpan }` (zero UI drawing methods or callbacks).
  * `Circuit` & `GateColumn`: Immutable structures; all edits return new instances (`withRows`, `withColumnAt`, `tidy`) and compare structurally via `isEqualTo()`.
  * `state/History.js`: Undo/redo stacks store immutable `Circuit` object references compared with `isEqualTo()`, never serialized JSON strings.
* **Measurement (`measurement/`):**
  * Measurement is a non-unitary module in `measurement/`, **never** a gate in `gates/`.
  * **Single-Shot Collapse:** Sample index $i$ with probability $P(i) = \text{re}[i]^2 + \text{im}[i]^2$, then mutate in place (`re[i] = 1.0`, `im[i] = 0.0`, all other entries `0.0`).
  * **Repeated Shots:** Call `state.clone()` once before sampling and draw $S$ independent samples from the pre-collapse distribution.

---

## 9. Flattening, Execution & `StepTrace` Conventions

* **Layer 1 — Canonical 1D Flattening (`flattenCircuit(circuit) -> Instruction[]`):**
  * Recursively inlines `SubCircuit` instances in deterministic left-to-right column, top-to-bottom row order.
  * Every `Instruction` object must use this exact key order:
    ```js
    {
      gateId: "H",
      target: 0,
      controls: [{ row: 1, on: true }],
      thetaRad: undefined,
      column: 3,
      virtualColumn: 5,
      subcircuit: "Grover" // or undefined for top-level gates
    }
    ```
* **Layer 2 — Schedule Projection (`scheduleColumns(instructions) -> ExecutionColumn[]`):**
  * Buckets adjacent instructions sharing the same `virtualColumn` into 2D column slices for `Evaluator` and `StepTrace`.
* **`StepTrace` Lifecycle (`sim/StepTrace.js`):**
  * Produced by `sim/Evaluator.js`, consumed read-only by `debugger/`, `inspector/`, and `ai/`.
  * Exposes `reset()`, `next()`, `seek(targetVirtualCol)`, `findStepWhere(predicate)`, and `verify(analyticExpectation)` with zero heap allocations during Ephemeral Mode stepping or breakpoint searches.

---

## 10. Normalization, Purity & Bloch Vector Conventions

* **Test-Only Per-Gate Normalization Check:**
  * In `node --test` / debug mode, check `normSquared()` after every gate:
    * $\lvert\text{normSq} - 1.0\rvert \le 10^{-9}$: pass silently.
    * $\lvert\text{normSq} - 1.0\rvert > 10^{-9}$: log a warning to `stderr` **and** renormalize in place (silent renormalization is forbidden).
    * Any `NaN` or `Infinity`: throw `Error` immediately.
  * In browser production runs, skip per-gate norm checks inside `evaluate()` and `StepTrace.next()`.
* **Global Phase:** Never canonicalize global phase; $\lvert\psi\rangle$ and $e^{i\phi}\lvert\psi\rangle$ remain distinct in memory.
* **Single-Qubit Reduced Density Matrix ($\rho_q$), Purity ($\gamma_q$) & Bloch Vector ($\vec{r}_q$):**
  * Never use the 2-qubit formula $c_{00}c_{11} - c_{01}c_{10} = 0$.
  * For each row $q \in \{0, \dots, n-1\}$, accumulate over all $i$ with bit $q = 0$ and $j = i \oplus 2^q$:
    $$\rho_{00} = \sum_{i,\,\text{bit } q=0} \left(\text{re}[i]^2 + \text{im}[i]^2\right), \quad \rho_{11} = 1 - \rho_{00}, \quad \rho_{01} = \sum_{i,\,\text{bit } q=0} \alpha_i \alpha_j^*$$
  * **Purity & Linear Entropy:** $\gamma_q = \rho_{00}^2 + \rho_{11}^2 + 2\left(\text{re}[\rho_{01}]^2 + \text{im}[\rho_{01}]^2\right) \in [0.5, 1.0]$; $S_L(q) = 1 - \gamma_q \in [0, 0.5]$.
  * **Bloch Vector:** $\vec{r}_q = \left(2\,\text{Re}[\rho_{01}],\; -2\,\text{Im}[\rho_{01}],\; \rho_{00} - \rho_{11}\right)$ with length $\lvert\vec{r}_q\rvert = \sqrt{2\gamma_q - 1}$.
  * Computed strictly in `inspector/` / `visualization/` using pre-allocated `Float64Array` buffers, never inside `Evaluator` or `StepTrace`.

---

## 11. Serialization, URL Codec & AI Grounding Conventions

* **Tier 1 — Canonical v1 JSON Schema (`circuit/Serializer.js`):**
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
  * Qubit targets and controls must be integer row indices (`0` to `numQubits - 1`).
  * Gates must be registered string IDs, never inline matrix arrays.
  * Angles must use `"thetaRad"` (or `"phiRad"`) in radians.
* **Tier 2 — Ephemeral URL Codec:**
  * Compress canonical v1 JSON via `CompressionStream("deflate-raw")` (or a zero-dependency Node deflate helper) and encode as URL-safe Base64 (`[A-Za-z0-9-_]`, no `=` padding).
* **AI Sparse State Grounding & Cache Key (`ai/`):**
  * Never pass full $2^n$ state vectors to LLM prompts.
  * Summarize each virtual column with: (1) basis states where $P(i) > 10^{-4}$, capped at top $k = 16$ terms in big-endian ket format, and (2) the $n$-element arrays of $\rho_{00}(q)$ and $S_L(q)$.
  * Cache explanations by `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)`.

---

## 12. Testing & Verification Conventions

* **Test Runner & Layout:** Mirror every source file 1:1 with a `*.test.js` file executed via `node --test`.
* **Numerical Tolerances:**
  * $n \le 8$: $\le 10^{-12}$ absolute error per amplitude component.
  * $n > 8$: $\le 10^{-9}$ absolute error per amplitude component.
  * Untouched amplitudes: exact bit-equality via `Object.is(actual, expected) === true`.
* **Mandatory Bidirectional Endianness Asserts ($n = 3$, indices $0 \dots 7$):**
  * `H` on row $1$ pairs $(i, i+2)$: $\{0,2\}, \{1,3\}, \{4,6\}, \{5,7\}$.
  * `CNOT(control = 0, target = 1)` swaps **exact index pairs $\{1, 3\}$ and $\{5, 7\}$**.
  * `CNOT(control = 1, target = 0)` swaps **exact index pairs $\{2, 3\}$ and $\{6, 7\}$**.
* **Differential Testing Profiles ($n \le 6$):**
  * Every gate/operation of arity $k_{\text{op}}$ must be tested across all **6 amplitude profiles** (purely real, purely imaginary, fully complex, complex–real, complex–imaginary, imaginary–real) against the naive $\mathcal{O}(4^n)$ `Matrix` Kronecker product reference and the CLI Qiskit/Cirq pipe.