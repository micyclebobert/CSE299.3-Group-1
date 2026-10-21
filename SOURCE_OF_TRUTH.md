# `Source of Truth.md` — SimQC Master Architecture, Conventions & Engineering Specification

> **Normative Status:** This document is the single authoritative source of truth for **SimQC**. It unifies and supersedes the *Architecture Blueprint*, *CONVENTIONS.md*, *Project Proposal*, and *Sprint Progress Reports*, incorporating all resolved architectural decisions. If any code or prior document disagrees with this specification, **this document wins**. Any architectural change requires updating this file in the same pull request.

---

## 1. Project Identity, Runtime Contract & Design Drivers

### 1.1 Executive Summary & Pedagogical Mission
* **Core Identity:** SimQC is a lightweight, browser-resident, client-side quantum circuit simulator written in pure JavaScript, paired with a zero-dependency headless Node.js CLI runner.
* **No External Quantum SDKs:** Built entirely from first principles without Qiskit, Cirq, PennyLane, or server-side execution backends.
* **Pedagogical & Research Purpose:**
  1. Demystify quantum circuit black-box mechanics where abstract linear algebra fails to build physical intuition.
  2. Visualize multi-qubit state evolution, superposition, multipartite entanglement, and phase interference step by step.
  3. Build deep implementation-level mastery of quantum circuits, logical operations, and quantum algorithms to support long-term research in quantum computing, digital logic, and computer organization/architecture.

### 1.2 Bare Node.js CLI Execution Contract
SimQC executes in modern browsers and in **bare Node.js** with **strictly zero external dependencies** and **no build step** (no `npm` packages, no Vite/Webpack bundlers, no external JS libraries). Bare Node.js fulfills three mandatory architectural roles:
1. **Headless Unit & Property Testing:** All core, circuit, and simulator test suites run directly via native `node --test` and native ES Modules (`import ... from './file.js'`).
2. **Real-Time Cross-Library Differential Pipe (`stdin` $\to$ `stdout`):** The CLI runner accepts canonical v1 JSON circuit definitions on `stdin` and outputs the resulting state vector to `stdout`, enabling external Python verification scripts to test SimQC against Qiskit and Cirq in real time without browser orchestration.
3. **Zero-DOM Architectural Guardrail:** Core math, circuit, and simulation modules must never touch `window`, `document`, or DOM globals. Executing in bare Node enforces this boundary automatically—any DOM reference crashes immediately.

### 1.3 Three Primary Design Drivers
1. **High Discard Probability for Optional Leaf Features:**
   * Optional features (`debugger/`, `inspector/`, `ai/`) must be isolated leaves imported **only** by `main.js`.
   * Deleting any optional feature folder must require at most a 2-line diff in `main.js`, with zero inter-feature dependencies.
2. **High-Leverage, Low-Line-Count V8 Optimizations:**
   * No GPU/WebGL shaders and no $\mathcal{O}(4^n)$ dense matrices in the execution loop.
   * **Human-Readable `Matrix` Authoring $\to$ Flat TypedArray Execution:** Gates are defined using `Complex` and `Matrix` classes once for readability and unitarity validation, then flattened at definition time into contiguous 8-number tuples (`number[8]` / `Float64Array(8)`). State vectors use split `Float64Array` buffers (`re[]`, `im[]`), eliminating heap allocations and pointer chasing ($\approx 80\%\text{--}100\%$ reduction in GC pressure; $3\times\text{--}8\times$ speedup).
   * **Bare Module Functions + Native ESM Namespace Imports (`import * as Kernel from './kernel.js'`):** Hot-path kernels are exported as bare module-level functions rather than static class methods. This eliminates V8 Inline Cache (IC) property lookups on constructor maps and implicit `this` receivers. Because ESM namespace bindings are immutable and resolved at parse/link time, V8 compiles `Kernel.applySingleQubitGate(...)` as a direct lexical access and inlines inner loops via TurboFan directly into register-level scalar operations without polluting global or local scopes.
3. **Strict Core/UI Separation:**
   * **The core thinks in indices; the UI thinks in labels.** No display formatting or big-endian string reversal ever leaks into the simulation core, and no index bit-math or normalization is ever performed in the UI.
   * **Qubit rows, not wires:** The circuit grid has no "wires" metaphor; each added qubit is simply a horizontal **qubit row** indexed $q \in \{0, \dots, n-1\}$ from top to bottom.

### 1.4 Explicitly Dropped Ceremony & Non-Goals
* **Time Parameter ($t$) Removed:** Continuous animation time $t$ is completely omitted from gate definitions, `Evaluator`, and `StepTrace`. Circuits are discrete, column-wise schedules.
* **Closure JSDoc (`checkJs`) Dropped:** Flat `Float64Array` buffers and bare numeric tuples gain little from object-oriented Closure type annotations and avoid false-positive `checkJs` friction.
* **License Headers Omitted:** Apache-2.0 boilerplate headers are omitted during active development.
* **No General-Purpose Linear Algebra Library:** QR, LQ, SVD, eigendecomposition, determinants, matrix-level Bloch/angle-axis conversions, and LaTeX exports are excluded.

---

## 2. Reference Audit of `Strilanc/Quirk` & Deliberate Divergences

Derived from a line-by-line audit of `Strilanc/Quirk` (`src/`, $106$ files / $27,401$ LOC).

### 2.1 Patterns Adopted from Quirk
| Quirk Pattern | Quirk Evidence | How SimQC Adopts It |
|---|---|---|
| **Immutable Value Objects** | `CircuitDefinition.js` ($55$ methods), `Gate.js`, `withX()`, `isEqualTo()` | Passive immutable `Circuit`, `GateColumn`, and `Gate` structures enable cheap undo/redo, structural diffing, and caching. |
| **Column/Grid Circuit Model** | `CircuitDefinition.js:325`, `GateColumn.js` | Sequential column list maps naturally to virtual column steps and breakpoints. |
| **ASCII Circuit Diagrams in Tests** | `CircuitDefinition.js:325` (`fromTextDiagram`, used $\sim 30\times$ in `test/`) | Ported to dependency-free `Ascii.js` ($\sim 40$ LOC) for rapid unit and analytic assertion authoring. |
| **Named Exports & Explicit `.js`** | $106 / 106$ files in Quirk | Named exports only; explicit `.js` file extensions for native browser and bare Node ESM compatibility. |
| **Minimal Observable Primitive** | `base/Obs.js:354` | Dependency-free $\sim 80$-line reactive observable for UI state notifications. |
| **Explicit DI to Break Cycles** | `Serializer.js:48` (`initSerializer`) | Applied to `GateRegistry` injection so `circuit/` never imports `gates/`. |
| **1:1 Test-to-Source Mirroring** | `test/{base,math,circuit,gates}/` | Every source module has a 1:1 mirrored `*.test.js` executed via `node --test`. |

### 2.2 Explicit Divergences from Quirk
| Quirk Convention | SimQC Normative Convention | Technical Rationale |
|---|---|---|
| **OOP Static Methods & Heap Objects in Hot Loop** (`Complex.js`, `Matrix.js`) | **Bare Functions + `import * as Kernel` + Split `Float64Array`s** | Eliminates V8 IC lookups, implicit `this` receivers, and GC pauses; guarantees TurboFan scalar inlining. |
| **Interleaved `Float64Array` or `Complex[]`** | **Two Parallel Private `Float64Array`s (`re[]`, `im[]`)** | Clean scalar loop indexing without `2 * i` / `2 * i + 1` bit-shift clutter; zero object overhead. |
| **Circuit "Wires" Metaphor** | **Qubit Rows ($q \in \{0, \dots, n-1\}$)** | Each new qubit is simply a horizontal row in the editor grid; eliminates wire-routing abstractions. |
| **Compact 2D-Array JSON for Everything** (`Serializer.js:486`) | **Two-Tier Serialization:** Verbose Canonical v1 JSON + Ephemeral `deflate-raw` Base64-URL Codec | Preserves explicit `"bitOrder": "little-endian"` and radian keys for CLI/AI while compressing URLs to $< 150$ chars. |
| **Time Parameter `t` Threaded Everywhere** (`CircuitStats.js:229`) | **Completely Removed** | Eliminates continuous time-threading across `Gate`, `Evaluator`, and `StepTrace`. |
| **Inline Display Gates on Canvas** (`gates/*Display*.js`) | **VS Code-Style Dockable Bottom Panel Tabs** | Modeling readouts as gates welds `inspector/` to `circuit/`; dockable panels keep `inspector/` deletable. |
| **Missing / Deferred Per-Qubit Bloch Readout** | **Bottom Panel Bloch Sphere Tab with Per-Qubit Subtabs** | Directly reuses the exact $2 \times 2$ reduced density matrix $\rho_q$ computed for entanglement highlighting. |
| **Closure JSDoc (`!number`) & License Headers** | **Plain ESM + Flat Array Contracts; No Headers** | Avoids JSDoc friction on flat numeric tuples and removes boilerplate noise. |

### 2.3 Rejected Quirk Subsystems & Structural Defects Prevented
* **WebGL GPU Pipeline Rejected ($\sim 6,600$ of $27,401$ LOC):** `webgl/` ($13$ files, $\sim 2,400$ LOC), `CircuitEvalContext.js:30,33,71` (`WglTexture`, `WglTextureTrader`), `circuit/{GateShaders,CircuitShaders,KetShaderUtil,KetTextureUtil}.js` ($\sim 600$ LOC), and `knownEffectToShader` across `gates/` ($\sim 3,600$ LOC). GPU texture state requires expensive GPU-to-CPU readbacks on every column step, which is incompatible with a mid-circuit stepwise debugger.
* **God Classes Stripped & Split ($400$ LOC Hard Ceiling):**
  * `ui/DisplayedCircuit.js` ($1,678$ LOC, $57$ methods) $\to$ split into `Layout.js`, `Renderer.js`, and `Interaction.js`.
  * `math/Matrix.js` ($1,456$ LOC) $\to$ stripped to definition-time unitarity checks and $N \times N$ Kronecker products for $n \le 6$ differential tests.
  * `base/Seq.js` ($1,172$ LOC) $\to$ replaced by standard JS array methods (`map`, `filter`, `reduce`).
  * `circuit/Gate.js` ($1,062$ LOC with `GateBuilder`, drawers, tooltips, click handlers) $\to$ stripped to a passive value object.
* **Four Quirk Structural Defects Explicitly Prevented:**
  1. **`draw -> ui` Inversion:** `src/draw/WidgetPainter.js:27` importing `drawCircuitTooltip` from `src/ui/DisplayedCircuit.js:1579`.
  2. **`circuit <-> gates` Folder Cycle:** `circuit/{CircuitDefinition:26, GateColumn:20, CircuitComputeUtil:23, Serializer:26}` importing `gates/AllGates.js` and hardcoding `gate === Gates.Detectors.ZDetector` (`GateColumn.js:431-432`).
  3. **`circuit -> draw` Inversion:** `src/circuit/Gate.js:18` importing `GateDrawParams.js`.
  4. **Simulation Logic Inside Data Model:** `CircuitDefinition.js:944,973,982` (`applyMainOperationsInCol`, etc.) mixing value storage with execution.

---

## 3. System Architecture, Layering Rules & Module Boundaries

### 3.1 Dependency Graph & Shared Trace Ownership
```
                       ┌────────────────────────────────────────────────────┐
                       │                      main.js                       │
                       │ (SOLE importer of gates/ and discardable features) │
                       └──────┬──────────────────┬───────────────────┬──────┘
                              │                  │                   │
              ┌───────────────┘                  │                   └───────────────┐
              ▼                                  ▼                                   ▼
     ┌─────────────────┐        ┌─────────────────────────────────┐         ┌─────────────────┐
     │     gates/      │        │  debugger/ · inspector/ · ai/   │         │     canvas/     │
     │ (Gate Catalog)  │        │     [DISCARDABLE LEAVES]        │         │ (VS Code UI/Ed) │
     └────────┬────────┘        └────────┬───────────────┬────────┘         └────────┬────────┘
              │                          │               │                           │
              ▼                          ▼               ▼                           │
     ┌──────────────────────────────────────┐   ┌────────────────────────────────────┴────────┐
     │               circuit/               │   │                    sim/                     │
     │ Gate · GateColumn · Circuit · Ascii  │──►│ Evaluator · StepTrace · kernel · Analytic   │
     │ SubCircuit · GateRegistry · Flatten  │   │               measurement/                  │
     │            Serializer                │   └──────────────────────┬──────────────────────┘
     └──────────────────┬───────────────────┘                          │
                        │                                              ▼
                        │                                     ┌─────────────────┐
                        └────────────────────────────────────►│      core/      │
                                                              │ Complex·Matrix  │
                                                              │   StateVector   │
                                                              └─────────────────┘
```

* **Load-Bearing Invariant:** `StepTrace` is an **engine output** produced by `sim/Evaluator.js`, consumed by `debugger/`, `inspector/`, and `ai/`, and **owned by none of them**. Zero import edges exist between `debugger/`, `inspector/`, and `ai/`. Running `rm -rf` on any feature directory leaves the remaining features and simulation core fully operational.

### 3.2 Directory Structure & Conceptual Layer Responsibilities
* **Scratch Directories:**
  * `.tmp/` — Ephemeral scratch files and folders; may disappear at any time.
  * `.dump/` — Semi-permanent artifacts, benchmark logs, and differential test dumps.
* **Source Tree Layout:** `TBD Placeholder` *(final folder hierarchy deferred until module boundaries stabilize; conceptual layer responsibilities are fixed below)*:
  * **`main.js`:** Application bootstrap and dependency wiring. The **only** file permitted to import `gates/` or discardable feature modules.
  * **`core/` (L1 — Pure Math & State Memory):** `Complex.js`, `Matrix.js`, `StateVector.js`. Zero DOM, zero upward imports.
  * **`circuit/` (L2 — Passive Data Model & Serialization):** `Gate.js`, `GateColumn.js`, `Circuit.js`, `SubCircuit.js`, `GateRegistry.js`, `Flatten.js`, `Ascii.js`, `Serializer.js`. Imports `core/` only; **never** imports `gates/`.
  * **`gates/` (Gate Definitions):** Standard, parameterized, controlled, and helper gates + registry builder. Imported by `main.js` **only**.
  * **`sim/` & `measurement/` (L3 — Execution Engine):** `kernel.js` (bare-function hot-path operations), `Evaluator.js`, `StepTrace.js`, `Analytic.js`, `measurement/` (single-shot collapse and repeated-shot sampling).
  * **`algorithms/` (Canonical Quantum Algorithms):** Verified circuit builders and runners for Deutsch–Jozsa, Grover, QFT, and Shor.
  * **`canvas/` / `editor/` / `visualization/` (L4 — VS Code IDE & Canvas):** `geom.js` (`Point`, `Rect`), `Layout.js` (pure coordinate math, Node-testable), `Renderer.js` (pure painting), `Interaction.js` (drag-and-drop state machine), `renderTypes.js` (`Map<renderType, painter>` with boxed-symbol default), dockable panel manager, and bottom-panel readouts.
  * **`debugger/` (Discardable Leaf):** Step controls, breakpoint manager, and active virtual-column pointer reading `StepTrace`.
  * **`inspector/` (Discardable Leaf):** Amplitude/probability bar charts, per-qubit Bloch sphere subtabs, and single-qubit purity ($\text{Tr}(\rho_q^2)$) calculator reading `StepTrace`.
  * **`ai/` (Discardable Leaf — Built Last):** Explainer, Builder (`NL -> Canonical JSON`), Input/Output analyzer, and `SHA-256` explanation cache.
  * **`state/History.js`:** Linear undo/redo stack storing immutable `Circuit` object references compared via `isEqualTo()` (never serialized strings).
  * **Layer-Local Config:** No root `Config.js` god file; simulation limits live in `sim/limits.js` and visual constants live in `canvas/theme.js`.

### 3.3 Mechanically Enforced Layering Rules
| # | Architectural Rule | Mechanical Enforcement |
|---|---|---|
| 1 | **Zero DOM in Engine:** `core/`, `circuit/`, `sim/`, `measurement/` must never reference `window`, `document`, or DOM globals. | ESLint `no-restricted-globals` + bare Node CLI execution |
| 2 | **Gate Isolation:** `gates/` is imported by `main.js` and **nothing else**. | ESLint `no-restricted-imports` |
| 3 | **Feature Leaf Isolation:** Nothing outside `main.js` may import `debugger/`, `inspector/`, or `ai/`. | ESLint `no-restricted-imports` |
| 4 | **Zero Inter-Feature Edges:** No imports between `debugger/`, `inspector/`, and `ai/`. | ESLint `no-restricted-imports` + CI discardability test |
| 5 | **Shared Trace Ownership:** `StepTrace` is produced by `sim/` and owned by no feature. | Code review + Rule 4 |
| 6 | **No Barrel Files:** Import concrete module files directly with explicit `.js` extensions (`import * as Kernel from './kernel.js'`). | ESLint `no-restricted-imports` |
| 7 | **1:1 Naming Convention:** Filename matches primary export (`PascalCase.js` for classes, `camelCase.js` for bare-function modules). | CI filename-export check |
| 8 | **File Size Cap:** No source file may exceed $400$ lines. | CI line-count script |
| 9 | **Immutable Bindings:** Use `const` by default; zero module-level mutable state. | ESLint `prefer-const` |

---

## 4. Normative Simulation Core Conventions (`CONVENTIONS.md` Contract)

### 4.1 Mathematical Formulation & Matrix-Free Pairwise Updates
* **$n$-Qubit Pure State:** Represented as a normalized complex vector of dimension $2^n$:
  $$\lvert\psi\rangle = \sum_{i=0}^{2^n - 1} \alpha_i \lvert i\rangle, \qquad \alpha_i \in \mathbb{C}, \qquad \sum_{i=0}^{2^n - 1} \lvert\alpha_i\rvert^2 = 1$$
* **Why Textbook Kronecker Lifting Is Forbidden in Execution:** Lifting a single-qubit gate $G$ on target qubit row $t$ to $U_t = I^{\otimes t} \otimes G \otimes I^{\otimes (n-1-t)}$ materializes a $2^n \times 2^n$ matrix ($\approx 34\text{ GB}$ RAM at $n = 16$, with $75\%$ zero entries even for $n = 3$) and costs $\mathcal{O}(4^n)$ per gate.
* **Why Lazy Unentangled Qubit Vectors Are Forbidden:** Keeping $n$ separate $2 \times 1$ vectors fails the moment an entangling gate acts ($c_{00}c_{11} - c_{01}c_{10} \neq 0$). SimQC maintains the explicit $2^n$ state vector from initialization.
* **Matrix-Free Pairwise Update ($\mathcal{O}(2^n)$ per Gate):** A single-qubit gate $G = \begin{pmatrix} g_{00} & g_{01} \\ g_{10} & g_{11} \end{pmatrix}$ targeting qubit row $t$ updates the $2^{n-1}$ disjoint amplitude pairs $(i_0, i_1)$ whose indices differ only in bit $t$ ($i_1 = i_0 \oplus 2^t$):
  $$\begin{pmatrix} \alpha'_{i_0} \\ \alpha'_{i_0 \oplus 2^t} \end{pmatrix} = \begin{pmatrix} g_{00} & g_{01} \\ g_{10} & g_{11} \end{pmatrix} \begin{pmatrix} \alpha_{i_0} \\ \alpha_{i_0 \oplus 2^t} \end{pmatrix}$$

### 4.2 Bit Ordering / Endianness & Bidirectional CNOT Proof
**Decision: Little-endian internal indexing. Qubit row $q$ corresponds to bit $q$ of amplitude index $i$.**

* Amplitude index $i$ ($0 \le i < 2^n$) is the coefficient $\alpha_i$ of computational basis state $\lvert i\rangle$.
* Qubit row $q$ of basis state $\lvert i\rangle$ has binary value `(i >>> q) & 1`.
* **Qubit row $0$ (top row in the UI) is the least significant bit (LSB):** bit mask `1 << 0 = 1`, stride $1$.
* Qubit row $q$ has bit mask `1 << q` and block stride $2^q$.
* Partner index for target qubit row $t$: `j = i ^ (1 << t)` (or `i1 = i0 | (1 << t)` when bit $t$ of `i0` is $0$).
* Positive control mask over control qubit rows $C$: bitwise OR of `(1 << c)` for all $c \in C$.
* **UI Display Rule:** The UI renders basis labels in big-endian ket string order $\lvert q_{n-1} \dots q_1 q_0\rangle$ so top-to-bottom qubit rows read left-to-right in ket notation (e.g., for $n = 3$, index `0b010 = 2` has $q_0 = 0, q_1 = 1, q_2 = 0$ and displays as $\lvert 010\rangle$). This reversal happens **strictly** in `visualization/` and `editor/`—never in core modules or test assertions.

**Normative Bidirectional CNOT Verification ($n = 3$, indices $0 \dots 7$):**
To prevent big-endian intuition slips and catch directional loop-stride bugs ($\text{control} < \text{target}$ inner-loop filtering vs. $\text{control} > \text{target}$ outer-block filtering), unit tests must verify **both** directions:
1. **$\text{CNOT}(0 \to 1)$ (Control = row $0$ [mask $1$], Target = row $1$ [mask $2$, stride $2$]):**
   * Control condition `(i & 1) === 1` selects odd indices $\{1, 3, 5, 7\}$.
   * Target flip $j = i \oplus 2$ swaps $1\ (001_2) \leftrightarrow 3\ (011_2)$ and $5\ (101_2) \leftrightarrow 7\ (111_2)$.
   * **Exact Swapped Pairs:** **$\{1, 3\}$ and $\{5, 7\}$** (aligns with canonical Bell state $H(0)$ then $\text{CNOT}(0 \to 1)$).
2. **$\text{CNOT}(1 \to 0)$ (Control = row $1$ [mask $2$], Target = row $0$ [mask $1$, stride $1$]):**
   * Control condition `(i & 2) === 2` selects indices $\{2, 3, 6, 7\}$.
   * Target flip $j = i \oplus 1$ swaps $2\ (010_2) \leftrightarrow 3\ (011_2)$ and $6\ (110_2) \leftrightarrow 7\ (111_2)$.
   * **Exact Swapped Pairs:** **$\{2, 3\}$ and $\{6, 7\}$**.

### 4.3 `StateVector` Memory Layout & Tiered Qubit Ceiling
**Decision: Two parallel private `Float64Array` buffers, `re[]` and `im[]`, each of length $2^n$.**

* Each amplitude $\alpha_i = \text{re}[i] + i\,\text{im}[i]$ consumes $16\text{ bytes}$ ($2 \times 8\text{-byte}$ IEEE-754 doubles), compared to $40\text{--}56\text{ bytes}$ for a V8 `Complex` object ($\approx 3\times$ memory savings, zero GC pressure).
* **Initialization Invariant:** A fresh `new StateVector(n)` initializes strictly to $\lvert 00\dots 0\rangle$: `re[0] = 1.0`, and all other `re[i] = 0.0`, `im[i] = 0.0`. Never `NaN`, never `undefined`.

```js
export class StateVector {
  constructor(n)             // allocates private re[] and im[] of length 2^n; re[0] = 1.0
  numQubits()                // -> n
  size()                     // -> 2^n (1 << n)
  getRe(i)                   // -> number (re[i])
  getIm(i)                   // -> number (im[i])
  get(i)                     // -> [re, im] (for tests/UI outside hot loops only)
  set(i, re, im)             // raw numbers only — passing Complex objects is FORBIDDEN
  normSquared()              // -> sum_i (re[i]^2 + im[i]^2)
  probability(i)             // -> re[i]^2 + im[i]^2
  probabilities()            // -> new Float64Array(2^n) of |alpha_i|^2
  clone()                    // -> deep copy of StateVector (for shot sampling & dense trace)
}
```
* Execution kernels access `re[]` and `im[]` via explicit internal buffer accessors so inner loops remain 100% allocation-free.

**Tiered Qubit Capacity & Memory Thresholds:**
| Qubit Regime | Single Vector RAM ($16 \times 2^n$) | `evaluate()` Policy | `StepTrace` Storage Mode | Entanglement Purity ($\gamma_q$) Policy |
|---|---|---|---|---|
| **$n \le 12$** *(Primary Scope)* | $\le 64\text{ KB}$ | Unrestricted | **Dense Mode** (clones at every virtual column; $\approx 1.3\text{ MB}$ for $20$ cols; $O(1)$ scrubbing) | Automatic on every step ($< 0.2\text{ ms}$) |
| **$13 \le n \le 14$** | $128\text{ KB} \to 256\text{ KB}$ | Unrestricted (no warning) | **Ephemeral Replay Mode** (single mutable buffer pair; zero allocation on step) | Debounced or on-demand |
| **$15 \le n \le 20$** | $512\text{ KB} \to 16.8\text{ MB}$ | Permitted with **UI Advisory Warning** | **Ephemeral Replay Mode** (single mutable buffer pair; fast-forward replay on backward seek) | On-demand click only |
| **$n > 20$** *(Hard Cap $n = 24$)* | $33.5\text{ MB} \to 268.4\text{ MB}$ | **Hard Refusal on Browser Main Thread** (reserved for bare Node CLI) | Disabled in browser UI | Disabled in browser UI |

### 4.4 Hot-Path Kernel Rules (`kernel.js`)
Every function mutating state-vector buffers must obey these six rules:
1. **Bare Module Functions + ESM Namespace Import:** Export as bare functions (`export function applySingleQubitGate(...)`) and import via `import * as Kernel from './kernel.js'`. Never wrap kernels in static class methods.
2. **Zero Heap Allocation:** No `Complex`, no `Matrix`, no objects, no closures, and no array literals inside loops. Use the canonical unrolled $2 \times 2$ scalar complex update over flat 8-number tuples `g = [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]`:
   ```js
   const a0r = re[i0], a0i = im[i0], a1r = re[i1], a1i = im[i1];
   re[i0] = g00re * a0r - g00im * a0i + g01re * a1r - g01im * a1i;
   im[i0] = g00re * a0i + g00im * a0r + g01re * a1i + g01im * a1r;
   re[i1] = g10re * a0r - g10im * a0i + g11re * a1r - g11im * a1i;
   im[i1] = g10re * a0i + g10im * a0r + g11re * a1i + g11im * a1r;
   ```
3. **Stride-$2^t$ Block Iteration (No Double-Visiting):** For target qubit row $t$, set `halfBlock = 1 << t` and `fullBlock = 2 << t`. Step the outer loop by `fullBlock` and inner loop by `1` across `[blockStart, blockStart + halfBlock)`, pairing `i0` (bit $t = 0$) with `i1 = i0 | halfBlock` (bit $t = 1$). Every disjoint pair $(i_0, i_1)$ is visited once.
4. **Controlled & Anti-Controlled Bit-Identical Pass-Through:** When `controlMask !== 0` or `antiControlMask !== 0`, update $(i_0, i_1)$ **only** when:
   ```js
   (i0 & controlMask) === controlMask && (i0 & antiControlMask) === 0
   ```
   Non-matching amplitudes must remain **bit-identical** (`Object.is(before, after) === true`).
5. **Control/Target & Intra-Column Disjointness:** Control and target qubit rows must never overlap (`(controlMask & (1 << target)) === 0`). All gates within a single column must act on mutually disjoint qubit rows.
6. **Single Complex Multiplication Identity:** $(a + bi)(c + di) = (ac - bd) + (ad + bc)i$ is implemented once in `Complex.js` and once in the unrolled kernel pattern above.

### 4.5 Normalization & Numerical Invariants
* **Test-Only Per-Gate Normalization Check (`node --test` / Debug Mode):**
  * After every gate application in automated tests, check $\lVert\lvert\psi\rangle\rVert^2$ against $1.0$:
    * Drift $\le 10^{-9}$: do nothing (normal IEEE-754 rounding).
    * Drift $> 10^{-9}$: renormalize **and log a warning** (signals an upstream arithmetic bug; silent renormalization is forbidden).
    * Any `NaN` or `Infinity` in `re[]` or `im[]`: throw immediately.
* **Browser Production Execution:** Skip per-gate $\mathcal{O}(2^n)$ norm checks during interactive browser `evaluate()` and `StepTrace` stepping to preserve memory bandwidth and $60\text{ fps}$ responsiveness.
* **Global Phase Preservation:** $\lvert\psi\rangle$ and $e^{i\phi}\lvert\psi\rangle$ remain distinct in memory; no global-phase canonicalization is performed.
* **Test Tolerances:** $10^{-12}$ for $n \le 8$; $10^{-9}$ for $n > 8$.

---

## 5. Gate Representation, Library Tiers & Circuit Model

### 5.1 Dual Gate Representation (`Complex`/`Matrix` $\to$ Flat Tuple)
* **Authoring & Differential Reference (`Complex.js`, `Matrix.js`):**
  * `Complex` (addition, multiplication, conjugation, modulus, scalar helpers) and `Matrix` (general $N \times N$ matrix-vector, matrix-matrix, and Kronecker `tensorProduct` operations, completed in Sprint 1) are used **only** at gate-definition time and in the naive $\mathcal{O}(4^n)$ differential test harness ($n \le 6$).
  * Every gate validates unitarity $\lVert G^\dagger G - I\rVert_F < 10^{-12}$ at construction time and throws on violation.
* **Runtime Execution Format:**
  * Single-qubit gates are flattened at definition time into `number[8]` / `Float64Array(8)`: `[g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]`.
  * Parameterized rotation gates ($R_x(\theta), R_y(\theta), R_z(\theta)$) are pure functions $\theta \mapsto \text{flat tuple}$ with $\theta$ in **radians** ($R_x(\pi) \equiv -iX$ up to global phase is tested as an identity, never hardcoded as a shortcut).
  * Multi-qubit gates ($\text{CNOT}, \text{CZ}, \text{SWAP}, \text{Toffoli}$) execute via dedicated bare-function index permutations and phase flips (e.g., $\text{CNOT}$ swaps `re[i0] <-> re[i1]` and `im[i0] <-> im[i1]` in place with zero multiplications; $\text{SWAP}$ performs a 3-way swap or 3 CNOTs verified for both orderings), **never** via $4 \times 4$ matrices.

### 5.2 Gate Library Tiers
1. **Tier 1 — Committed Core Deliverables:** Pauli $X, Y, Z$, Hadamard $H$, $\text{CNOT}$, and Rotations $R_x(\theta), R_y(\theta), R_z(\theta)$.
2. **Tier 2 — Planned Standard Extensions:** $I, S, T, \text{CZ}, \text{SWAP}, \text{Toffoli}$.
3. **Tier 3 — Might-Do / Algorithm Helper Tier:** $S^\dagger$, `AntiControl`, integer/modular arithmetic gates (`Add`, `Sub`, `Mult`, `Increment`, `Decrement`), and reusable composite subcircuits built as needed to streamline implementing the $\ge 3$ canonical algorithms (Deutsch–Jozsa, Grover, QFT, Shor).

### 5.3 Passive Circuit Data Model & Subcircuits
* **`Gate`:** Passive value `{ id, flatTuple, rowSpan }`—no drawer, no blurb, no click handler, no `renderType`.
* **`Circuit` & `GateColumn`:** Immutable 2D grid of columns (`column 0` applied first left-to-right, corresponding to composite unitary $U = U_k \cdots U_2 U_1$) plus `numQubits` row count and pure transforms (`withRows`, `withColumnAt`, `tidy`, `isEqualTo`). Zero execution methods inside `Circuit`.
* **`SubCircuit` Authority Model:**
  * **Nested (`circuit/` + `Serializer.js`):** Authoritative data model.
  * **Collapsed (`canvas/`):** Presentation view only.
  * **Flattened (`Flatten.js`):** Derived, read-only execution schedule.

---

## 6. Execution Pipeline: Serialization, Flattening, `StepTrace` & Measurement

### 6.1 Two-Tier Serialization Pipeline (`Serializer.js`)
```
       [URL Hash / Query String]
                   │  (CompressionStream("deflate-raw") + Base64-URL)
                   ▼
┌──────────────────────────────────────┐
│      Canonical Schema (v1 JSON)      │ <──> File I/O, Bare Node CLI & AI Module
│  (Explicit gates, targets, controls) │
└──────────────────┬───────────────────┘
                   │
                   ▼  Flatten.js
┌──────────────────────────────────────┐
│        Flattened Instruction[]       │ ───> scheduleColumns() ───> Evaluator & StepTrace
└──────────────────────────────────────┘
```

1. **Tier 1 — Canonical v1 JSON Schema (`Serializer.js`):**
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
   * Enforces `"format": "simqc-circuit"`, `"version": 1`, `"bitOrder": "little-endian"`, integer row indices (`0` to `numQubits - 1`), registered gate string IDs (never raw matrices), explicit radian keys (`"thetaRad"`), and explicit control descriptor arrays (`controls: [{ row: 0, on: true }]`) supporting anti-controls (`on: false`).
2. **Tier 2 — Ephemeral URL Codec:**
   * Pipes the canonical v1 JSON string through `CompressionStream("deflate-raw")` (or a zero-dependency $\sim 60$-line deflate/LZ helper in bare Node) and encodes to URL-safe Base64 (`[A-Za-z0-9-_]`), shrinking a 15-column, 5-qubit circuit to $< 150$ characters with 100% lossless round-trip fidelity.

### 6.2 Dual-Layer Flattening Pipeline (`Flatten.js`)
```
                  ┌──────────────────────────────┐
                  │     Circuit Model (Tree)     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                      flattenCircuit() (Canonical 1D)
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
    AI Explainer & Cache                  scheduleColumns() (2D)
    (Consumes Canonical 1D)                         │
                                                    ▼
                                          Evaluator & StepTrace
                                     (Executes 2D Virtual Columns)
```
1. **Layer 1 — Canonical 1D Flattening (`flattenCircuit(circuit) -> Instruction[]`):**
   * Recursively inlines nested subcircuits in deterministic left-to-right column, top-to-bottom row order with fixed key ordering for AI prompt grounding and `SHA-256` explanation caching:
     ```js
     {
       gateId: "H",
       target: 0,              // Target qubit row index
       controls: [{ row: 1, on: true }],
       thetaRad: undefined,    // Radian parameter if applicable
       column: 3,              // Top-level canvas column
       virtualColumn: 5,       // Expanded execution column index (after subcircuit inlining)
       subcircuit: "Grover"    // Origin breadcrumb (undefined for top-level gates)
     }
     ```
2. **Layer 2 — Schedule Projection (`scheduleColumns(instructions) -> ExecutionColumn[]`):**
   * Lightweight, zero-copy grouper that buckets adjacent instructions sharing the same `virtualColumn` into 2D `ExecutionColumn[]` slices so `Evaluator` and `StepTrace` step strictly across physical column boundaries without exposing non-physical intra-column states.

### 6.3 `Evaluator.js` & Tiered Adaptive `StepTrace`
* **`evaluate(schedule, numQubits) -> StateVector`:** Fast single-buffer execution from virtual column $0$ to end with zero intermediate allocations.
* **`createStepTrace(schedule, numQubits) -> StepTrace`:** Dynamically selects its internal storage strategy based on qubit count $n$:
  * **Dense Mode ($n \le 12$):** Allocates persistent working buffers (`re[]`, `im[]`) plus a `snapshots` array sized to the schedule length. Lazily clones buffers strictly at virtual column boundaries ($\approx 1.3\text{ MB}$ for $20$ columns at $n = 12$) for instantaneous $O(1)$ timeline scrubbing.
  * **Ephemeral Replay Mode ($n > 12$):** Sets `snapshots = null` and maintains strictly **one** working buffer pair (`re[]`, `im[]`), mutating in place on `next()` with zero heap allocations and fast-forwarding from step $0$ on backward `seek()` (keeping RAM flat at $268.4\text{ MB}$ even at $n = 24$, preventing the $5.37\text{ GB}$ trace OOM crash).
* **Uniform `StepTrace` API:**
  * `reset()`: Zeroes working buffers in place, sets `re[0] = 1.0`, resets `step = 0` without reallocating TypedArrays.
  * `next()`: Applies the next `ExecutionColumn` via bare-function kernels in place, increments `step`, and (in Dense Mode) caches the column snapshot.
  * `seek(targetCol)`: Clamps to schedule bounds. In Dense Mode, copies cached snapshot via `TypedArray.set()`. In Ephemeral Mode, calls `reset()` and loops `next()` in place to `targetCol` with zero heap allocations.
  * `findStepWhere(predicate)`: Calls `reset()` and steps column by column, evaluating `predicate(activeBuffers, step)` in place with zero intermediate state allocations.
  * `verify(analyticExpectation)`: Pure assertion check comparing trace states against curated closed-form formulas in `Analytic.js`.

### 6.4 Measurement Module (`measurement/`)
* **Module, Not Gate:** Measurement is non-unitary and lives in `measurement/`, never inside `gates/`.
* **Single-Shot Collapse:** Draw basis index $i$ according to Born probabilities $P(i) = \lvert\alpha_i\rvert^2$, then collapse **in place**: set `re[i] = 1.0`, `im[i] = 0.0`, and zero all other entries.
* **Repeated-Shot Histogram Sampling:** Call `state.clone()` once prior to measurement and draw $S$ independent samples against the preserved pre-measurement distribution to populate the empirical frequency histogram.

---

## 7. VS Code-Style Dark-Mode UI, Purity Entanglement & Bloch Spheres

### 7.1 Dark-Mode First VS Code Dockable Layout
* **Visual Theme:** Dark-mode-first palette (`canvas/theme.js`) with high-contrast phase and entropy accents.
* **Toggleable & Draggable IDE Panels:**
  1. **Left Panel (Gate Palette / Toolbox):** Categorized draggable gates (Core, Extensions, Subcircuits/Helpers).
  2. **Main Panel (Qubit-Row Circuit Editor):** Interactive grid where each qubit is a horizontal **row** ($q \in \{0, \dots, n-1\}$, no wires). Supports drag-and-drop placement, column breakpoint markers, subcircuit expansion, and reactive row-level entanglement glow.
  3. **Right Panel (Generated Code & AI Assistant):** Live synchronized views of Canonical v1 JSON, Compressed Shareable URL, exported code, and the AI Explainer / Builder interface.
  4. **Bottom Panel (Inspector Readouts):**
     * **Tab 1 — Amplitudes, Probabilities & Shot Histogram:** Interactive statevector bar chart (formatted in big-endian ket labels $\lvert q_{n-1}\dots q_0\rangle$) and repeated-shot measurement histogram.
     * **Tab 2 — Bloch Spheres (with Per-Qubit Subtabs):** Contains individual subtabs `Qubit 0`, `Qubit 1`, ..., `Qubit n-1` (plus a register overview), rendering each qubit's reduced state vector $\vec{r}_q$ inside the Bloch sphere.

### 7.2 Single-Qubit Purity Entanglement Highlighting & Bloch Vector Math
* **Why Pairwise $c_{00}c_{11} - c_{01}c_{10} = 0$ Is Forbidden:** Valid only for isolated 2-qubit pure states; fails on $n > 2$ open subsystems and completely misses multipartite entanglement (e.g., in a 3-qubit GHZ state $\frac{1}{\sqrt{2}}(\lvert 000\rangle + \lvert 111\rangle)$, every qubit is maximally entangled with the register, yet every reduced 2-qubit pair has zero bipartite concurrence).
* **Exact Single-Qubit Reduced Density Matrix ($\rho_q$):**
  For each qubit row $q \in \{0, \dots, n-1\}$, accumulate over all indices $i$ where bit $q = 0$ and partner $j = i \oplus 2^q$:
  $$\rho_{00} = \sum_{i,\, \text{bit } q = 0} \left(\text{re}[i]^2 + \text{im}[i]^2\right), \qquad \rho_{11} = 1 - \rho_{00}, \qquad \rho_{01} = \sum_{i,\, \text{bit } q = 0} \alpha_i \alpha_j^*$$
* **Single-Qubit Purity ($\gamma_q$) & Linear Entropy ($S_L$):**
  $$\gamma_q = \text{Tr}(\rho_q^2) = \rho_{00}^2 + \rho_{11}^2 + 2\left(\text{re}[\rho_{01}]^2 + \text{im}[\rho_{01}]^2\right) \in [0.5, 1.0], \qquad S_L(q) = 1 - \gamma_q \in [0, 0.5]$$
  * $S_L(q) = 0$ ($\gamma_q = 1.0$): Qubit row $q$ is in a separable pure product state (neutral row styling; Bloch vector sits on the sphere surface, $\lvert\vec{r}_q\rvert = 1$).
  * $S_L(q) > 0$ ($\gamma_q < 1.0$): Qubit row $q$ is entangled with the register, glowing in proportion to $S_L(q)$ (maximal entanglement at $S_L(q) = 0.5$, where the Bloch vector shrinks to the origin $\lvert\vec{r}_q\rvert = 0$).
* **Per-Qubit Bloch Vector ($\vec{r}_q$):**
  Derived in the exact same loop pass to drive the Bottom Panel's per-qubit Bloch Sphere subtabs:
  $$\vec{r}_q = \left(2\,\text{Re}[\rho_{01}],\; -2\,\text{Im}[\rho_{01}],\; \rho_{00} - \rho_{11}\right), \qquad \lvert\vec{r}_q\rvert = \sqrt{2\gamma_q - 1}$$
* **Zero-Allocation Execution & Decoupled Ownership:**
  * Computed by a bare function using stride-$2^q$ iteration over `re[]` and `im[]`, writing into pre-allocated `Float64Array` buffers ($< 0.2\text{ ms}$ for $n \le 12$, fitting in L1 cache).
  * Owned strictly by `inspector/` / `visualization/`—never called inside `Evaluator` or `StepTrace`.

---

## 8. AI Subsystem (`ai/`) — Built Last, Sparse Grounding & Ollama Stack

### 8.1 Insulation Contract & Feature Scope
* **Built Strictly Last (Build Step 11):** Integrated only after `Serializer.js` (v1 JSON) and `Flatten.js` (`Instruction[]`) are frozen.
* **Zero Debugger Coupling:** Consumes `Serializer.js`, `Flatten.js`, and `StepTrace` only; never imports `debugger/` or `inspector/`.
* **Capabilities:**
  1. **Circuit Explainer (Committed):** Converts canonical 1D `Instruction[]` + sparse intermediate state summaries into pedagogical step-by-step explanations.
  2. **Input/Output Causal Analysis:** Analyzes user-selected input rows independently across the flattened schedule, then explains how they combine to form selected output rows.
  3. **Circuit Builder (Proposed / Non-Guaranteed):** Translates natural-language prompts into canonical v1 JSON $\to$ validated via `Serializer.fromJson(json)` $\to$ `Circuit`.
  4. **Content-Addressed Cache:** Keyed on `SHA-256(canonical JSON || schema version || prompt version)`.

### 8.2 Sparse Top-$k$ State Grounding (`AI_INTERFACE.md`)
* **Never** serialize raw $2^n$ state vectors into LLM prompts (which would exceed $150,000$ tokens at $n = 10$).
* At each virtual column boundary, serialize a **Sparse State Summary**:
  1. Basis states with probability $\lvert\alpha_i\rvert^2 > 10^{-4}$, capped at the **top $k = 16$ terms** formatted in big-endian ket notation with amplitude/phase.
  2. The $n$-element per-qubit marginal probabilities $\rho_{00}(q)$ and linear entropies $S_L(q)$.

### 8.3 Phased Adaptation Ladder & Local Hardware Budget
SimQC adapts pretrained open-weights instruct models via a three-layer local stack (`llama.cpp` + GGUF `Q4_K_M` quantization at $\approx 4.5\text{ bits/weight}$ + Ollama REST API on `localhost:11434`), using the simulator core as a **ground-truth labeling oracle**:
* **Phase 0 (Completed):** Conceptual study + frozen `AI_INTERFACE.md` contract.
* **Phase 1 (Completed):** Hardware evaluation on target deployment machine ($16\text{ GB}$ system RAM, NVIDIA RTX 3050 Laptop GPU with $4\text{ GB}$ VRAM, Intel Core i5 12th-Gen):

| Model (Ollama Tag) | Disk Size (`Q4_K_M`) | Runtime Memory | Hardware Fit | Assigned Role |
|---|---|---|---|---|
| `qwen2.5:3b` | $1.9\text{ GB}$ | $\approx 3\text{ GB}$ | $100\%$ GPU ($\approx 40\text{ tok/s}$) | **Default dev explainer** |
| `qwen2.5-coder:7b` | $4.7\text{ GB}$ | $\approx 6\text{ GB}$ | $\approx 46\% / 54\%$ CPU/GPU | **Quality reference** |
| `qwen2.5:14b` | $9.0\text{ GB}$ | $\approx 11\text{ GB}$ | Exceeds local VRAM | **Phase-5 synthetic dataset teacher (Google Colab)** |

* **Operational Requirements:** Raise Ollama `num_ctx > 2048` for circuit JSON prompts; set `OLLAMA_ORIGINS` environment variable for browser CORS during development; use Phase-5 Colab teacher + simulator oracle to generate synthetic fine-tuning pairs for Phase-7 LoRA/QLoRA adaptation.

---

## 9. Six-Layer Validation Plan, Mandatory Test Matrix & Build Order

### 9.1 Six Hierarchical Validation Layers
1. **Layer 1 — Complex Arithmetic *(Completed in Sprint 1)*:** Unit tests verifying `Complex` addition, multiplication, conjugation, modulus, and scalar helpers against exact analytical values.
2. **Layer 2 — Canonical Single-Qubit Transformations:** Verify $H\lvert 0\rangle$, $X\lvert 0\rangle$, $Z\lvert 1\rangle$, and $R_x(\pi) \equiv -iX$ against textbook amplitudes.
3. **Layer 3 — State Invariants & Normalization:** Verify unitarity $\lVert G^\dagger G - I\rVert_F < 10^{-12}$ at gate construction, per-gate norm conservation $\sum \lvert\alpha_i\rvert^2 = 1 \pm 10^{-9}$ in test mode (with warning on injected drift $> 10^{-9}$ and throw on `NaN`/`Infinity`), and bit-identical (`Object.is`) untouched amplitudes.
4. **Layer 4 — Multi-Qubit Circuits & Algebraic Identities:** Verify Bell and 3-qubit GHZ entanglement generation, algebraic identities ($H^2 = X^2 = Y^2 = Z^2 = I$), bidirectional $\text{CNOT}(0 \to 1)$ and $\text{CNOT}(1 \to 0)$ index permutations, and **Quantum Teleportation** as a composite integration benchmark.
5. **Layer 5 — Canonical Algorithmic Benchmarks ($\ge 3$ Committed):** Verify at least three of **Deutsch–Jozsa**, **Grover's Search** (peak amplification probability), **Quantum Fourier Transform (QFT)** (exact basis phase transformations), and **Shor's Algorithm** against theoretical distributions.
6. **Layer 6 — Cross-Library Differential Testing via Bare Node CLI:** Define $m = \sum_{\text{op}} k_{\text{op}}$ where $k_{\text{op}}$ is the qubit arity of each gate/operation. Generate $6m$ test states across **six amplitude composition profiles** for $(\alpha, \beta)$:
   * Purely real, purely imaginary, fully complex, and the 3 asymmetric pairs (complex–real, complex–imaginary, imaginary–real, with randomly swapped components).
   * Compare the pairwise bare-function kernel against the naive $\mathcal{O}(4^n)$ `Matrix` Kronecker product path for $n \le 6$ (tolerance $10^{-12}$), and pipe canonical v1 JSON over bare Node `stdin`/`stdout` against Qiskit and Cirq reference runners.

### 9.2 Mandatory `node --test` Validation Hooks
| Convention | Mandatory Automated Test |
|---|---|
| **Little-endian bidirectional ordering** | On $n = 3$: `H` on qubit row $1$ pairs $(i, i+2)$; **`CNOT(0→1)` swaps `{1, 3}` and `{5, 7}`**; **`CNOT(1→0)` swaps `{2, 3}` and `{6, 7}`**. |
| **Initialization** | Fresh `new StateVector(n)` has `re[0] === 1.0` and all other `re[i] === 0.0`, `im[i] === 0.0`. |
| **Pairwise bare-function kernel** | Differential test against naive $2^n \times 2^n$ `Matrix` Kronecker path for $n \le 6$ across all 6 amplitude profiles to $< 10^{-12}$. |
| **Control & anti-control semantics** | Non-matching control/anti-control amplitudes remain **bit-identical** (`Object.is`). |
| **Test-mode normalization** | Norm checked after every gate in test mode; injected drift $> 10^{-9}$ logs warning + renormalizes; `NaN`/`Infinity` throws. |
| **Gate unitarity** | Every gate in `gates/` passes $\lVert G^\dagger G - I\rVert_F < 10^{-12}$ at definition time. |
| **Single-qubit purity ($\gamma_q$)** | Product states yield $\gamma_q = 1.0$ ($S_L = 0$); 2-qubit Bell and 3-qubit GHZ states yield $\gamma_q = 0.5$ ($S_L = 0.5$) on entangled rows. |
| **Two-tier serialization round-trip** | `fromJson(toJson(circuit))` and URL codec `decode(encode(circuit))` satisfy `circuit.isEqualTo(...)`. |

### 9.3 Master 11-Step Build Order & Sprint Roadmap
| Step | Deliverable | Verification Exit Criterion | Status |
|---|---|---|---|
| **1a** | `core/Complex.js`, `core/Matrix.js` (with Kronecker product), `CONVENTIONS.md`, Ollama Phase 0–1 | Layer 1 analytical tests pass; Ollama throughput baselined | **Completed (Sprint 1)** |
| **1b** | `core/StateVector.js`, `sim/kernel.js` (bare functions), core `gates/` ($X,Y,Z,H,\text{CNOT},R_x,R_y,R_z$), $n \le 6$ differential harness | Bell state $H(0) \to \text{CNOT}(0 \to 1)$ yields $(1/\sqrt{2}, 0, 0, 1/\sqrt{2})$ and matches naive `Matrix` path within $10^{-12}$ | **Active (Sprint 2)** |
| **2** | `circuit/` — `Gate`, `GateColumn`, `Circuit`, `SubCircuit`, `Ascii.js` | `node --test` with `Ascii.js`: structural transforms preserve column and row counts | Planned |
| **3** | `circuit/Serializer.js` (v1 JSON + URL codec) + `GateRegistry` injection | Property test: `fromJson(toJson(c)).isEqualTo(c)` across generated circuits | Planned |
| **4** | `circuit/Flatten.js` (`flattenCircuit` + `scheduleColumns`) + `sim/Evaluator.js` + Tiered `StepTrace` + `measurement/` | Flatten 3-qubit circuit, evaluate & step in both Dense and Ephemeral modes, verify Born probabilities sum to $1 \pm 10^{-12}$ | Planned |
| **5** | `sim/Analytic.js` + `algorithms/` ($\ge 3$ of DJ, Grover, QFT, Shor) | Curated closed-form expectations and theoretical algorithm distributions verified | Planned |
| **6** | `canvas/` — `Layout.js` + `Renderer.js` (pure, Node-testable), then `Interaction.js` & VS Code dark-mode panels | `Layout.js` unit-tested in bare Node without DOM; interactive drag-and-drop verified | Planned |
| **7** | Engine Breakpoints (`StepTrace.findStepWhere`) | `findStepWhere` returns exact virtual column index on known multi-qubit circuits | Planned |
| **8** | `state/History.js` | Undo/redo round-trip over $100$ random circuit operations using `Circuit.isEqualTo` | Planned |
| **9** | `inspector/` (Amplitudes, Shot Histogram, Purity $\gamma_q$ Row Glow, Per-Qubit Bloch Sphere Subtabs) | Reads `StepTrace` only; Bell/GHZ states shrink Bloch vectors to $0$ and glow rows at $S_L = 0.5$ | Planned |
| **10** | `debugger/` UI (Timeline scrubber, step buttons, breakpoint toggles) | Reads `StepTrace` only; $O(1)$ scrubbing for $n \le 12$ and zero-allocation replay for $n > 12$ | Planned |
| **11** | `ai/` — Explainer, I/O Analyzer, Builder, `SHA-256` Cache (**Built Strictly Last**) | Consumes 1D `Flatten.js` DTO + Sparse Top-$k$ state summary; Builder round-trips through `Serializer.fromJson` | Planned |

---

## 10. Quick-Reference Normative Summary Table

| # | Domain | Normative Decision |
|---|---|---|
| 1 | **Runtime** | Browser + bare Node.js CLI (`node --test`, `stdin`/`stdout` JSON pipe, zero `npm` packages, zero DOM in core) |
| 2 | **Endianness** | Little-endian internal (`qubit row q = bit q`); big-endian ket labels $\lvert q_{n-1}\dots q_0\rangle$ in UI only |
| 3 | **Circuit Metaphor** | Horizontal **qubit rows** ($0 \dots n-1$), no wires; VS Code dark-mode dockable panels |
| 4 | **State Memory** | Two parallel private `Float64Array`s (`re[]`, `im[]`), never interleaved |
| 5 | **Qubit Ceilings** | $n \le 12$ Dense Trace; $13 \le n \le 14$ Ephemeral Trace; $15 \le n \le 20$ UI warning + Ephemeral Trace; $n > 20$ refused in UI ($n = 24$ CLI cap) |
| 6 | **Hot-Path Kernels** | Bare functions + `import * as Kernel`, flat `number[8]` gate tuples, stride-$2^t$ blocks, zero heap allocations |
| 7 | **Multi-Qubit Gates** | Dedicated index permutation / phase kernels (`CNOT(0→1)` swaps `{1,3},{5,7}`; `CNOT(1→0)` swaps `{2,3},{6,7}` on $n=3$) |
| 8 | **Flattening** | Dual-layer: `flattenCircuit()` (1D for AI/cache) $\to$ `scheduleColumns()` (2D virtual columns for execution) |
| 9 | **Time Parameter ($t$)** | Completely omitted from gate definitions, `Evaluator`, and `StepTrace` |
| 10 | **Normalization** | Per-gate norm check runs in automated tests (`> 1e-9` warns + renormalizes); skipped in browser production path |
| 11 | **Entanglement & Bloch** | Single-qubit purity $\gamma_q = \text{Tr}(\rho_q^2)$ and linear entropy $S_L = 1 - \gamma_q$ drive both row glow and Bottom Panel per-qubit Bloch subtabs |
| 12 | **Serialization & AI** | Canonical v1 JSON + `deflate-raw` Base64-URL codec; AI built last using top-$k$ ($k \le 16$, $P > 10^{-4}$) sparse state grounding |