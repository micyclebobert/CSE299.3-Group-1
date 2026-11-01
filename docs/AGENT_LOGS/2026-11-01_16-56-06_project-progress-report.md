# SimQC Project Progress Report

**Date:** November 1, 2026  
**Project:** SimQC — Zero-Dependency Quantum Circuit Simulator  
**Runtime:** Browser + Bare Node.js (`node --test`)  
**Test Status:** 393/393 passing  
**Build Order Status:** Steps 1a–5 complete (Sprints 1 & 2); Steps 6–11 pending  

---

## 1. Executive Summary

SimQC is a lightweight, browser-resident quantum circuit simulator written entirely in pure JavaScript with **zero external dependencies** — no Qiskit, Cirq, PennyLane, npm packages, bundlers, or server-side backends. The simulator executes unmodified in both modern browsers and bare Node.js via native ES Modules.

The architecture follows strict layering: `core/` (math) → `circuit/` (data model) → `sim/` (execution) → `gates/` (catalog, injected via `main.js` only) → discardable leaves (`debugger/`, `inspector/`, `ai/`, imported by `main.js` only).

**Current Status:** Sprints 1 and 2 complete. The mathematical foundation, circuit model, serialization, simulation engine, measurement module, and canonical algorithms are all implemented and verified by 393 passing tests.

---

## 2. Architecture & Layering

### 2.1 Dependency Graph (per SOURCE_OF_TRUTH.md §3)

```
main.js
  ├── gates/          (basis.js, param.js)
  │        └─ injected into circuit/GateRegistry.js (breaks circuit→gates cycle)
  ├── circuit/        (Gate, GateColumn, Circuit, Serializer, Flatten, GateRegistry, Ascii)
  │        └─ sim/    (kernel.js, Evaluator.js, StepTrace.js, analytic.js, limits.js)
  │                 └─ core/    (Complex.js, Matrix.js, StateVector.js)
  ├── measurement/    (collapse, sampleHistogram)
  ├── algorithms/     (qft.js, grover.js, dj.js, shor.js)
  ├── debugger/       (Discardable leaf: Debugger, Timeline, BreakpointManager)
  ├── inspector/      (Discardable leaf: InspectorUI stub)
  └── ai/             (Discardable leaf: AIExplainer stub)
```

**Invariant:** `StepTrace` is an engine output produced by `sim/`, owned by none, and consumed read-only by debugger/inspector/ai. Zero imports between any two leaf folders.

---

## 3. Core Math Layer (`src/core/`) — Sprint 1 (Completed)

### 3.1 Complex.js

A classical complex number type used at gate-definition time for readability and unitarity validation. Operations: add, sub, multiply, divide, conjugate, magnitude, phase, polar conversion. All operations return new `Complex` instances (immutable). Used **only** at definition time — never in the hot-path execution loop.

### 3.2 Matrix.js

A classical matrix type supporting: zeros, identity, addition, subtraction, scalar multiplication, matrix multiplication, conjugate transpose, Frobenius norm squared, unitarity check (`||G†G - I||_F < 1e-12`), and Kronecker tensor product. Used to author gates as explicit matrices and validate unitarity at definition time. Also serves as the naive `O(4^n)` reference for differential testing (n ≤ 6).

### 3.3 StateVector.js

The state container implementing the **split-buffer memory layout**:

```javascript
#re = new Float64Array(2^n);   // real parts
#im = new Float64Array(2^n);   // imaginary parts
```

**Quantum Theory Connection:** An n-qubit pure state is a normalized complex vector:

\|ψ⟩ = Σ_{i=0}^{2^n-1} α_i \|i⟩, α_i ∈ ℂ, Σ |α_i|² = 1

The split-buffer layout stores α_i = re[i] + i·im[i], using 16 bytes per amplitude vs 40–56 bytes for a V8 Complex object (~3× memory savings, zero GC pressure). Initialization invariant: re[0] = 1.0, all others zero → \|00...0⟩.

**Hot-path access:** `getRawRe()` / `getRawIm()` expose internal buffers directly to kernels for zero-allocation execution.

---

## 4. Gate Definitions (`src/gates/`) — Sprint 1/2 (Completed)

### 4.1 Dual Gate Representation (per SOURCE_OF_TRUTH §5.1)

Each gate is authored using `Complex`/`Matrix` for readability and unitarity validation, then **flattened at definition time** to a canonical 8-tuple:

```
[g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]
```

This flat tuple is what the hot-path kernels consume. Matrix objects never appear in the execution loop.

### 4.2 Basis Gates (`basis.js`) — Fixed Single-Qubit Gates

| Gate | Matrix | Flat Tuple | Quantum Meaning |
|------|--------|------------|-----------------|
| I | [[1,0],[0,1]] | [1,0, 0,0, 0,0, 1,0] | Identity — no change |
| X | [[0,1],[1,0]] | [0,0, 1,0, 1,0, 0,0] | Bit flip (NOT) |
| Y | [[0,-i],[i,0]] | [0,0, 0,-1, 0,1, 0,0] | Bit + phase flip |
| Z | [[1,0],[0,-1]] | [1,0, 0,0, 0,0, -1,0] | Phase flip |
| H | (1/√2)[[1,1],[1,-1]] | [s,0, s,0, s,0, -s,0] | Hadamard — superposition |
| S | [[1,0],[0,i]] | [1,0, 0,0, 0,0, 0,1] | Phase gate (√Z) |
| T | [[1,0],[0,e^{iπ/4}]] | [1,0, 0,0, 0,0, s,s] | π/8 gate |

All matrices validated unitary at definition time via `Matrix.isUnitary()`.

**Quantum Theory Connection:** These are the generators of SU(2). The Hadamard creates superposition: H\|0⟩ = (|0⟩+|1⟩)/√2. The Pauli matrices form a basis for single-qubit Hermitian operators and correspond to 180° rotations about the X, Y, Z axes of the Bloch sphere.

### 4.3 Parameterized Gates (`param.js`) — Rotation Gates

| Gate | Matrix Form | θ Unit |
|------|-------------|--------|
| R_x(θ) | [[cos(θ/2), -i·sin(θ/2)],[-i·sin(θ/2), cos(θ/2)]] | radians |
| R_y(θ) | [[cos(θ/2), -sin(θ/2)],[sin(θ/2), cos(θ/2)]] | radians |
| R_z(θ) | [[e^{-iθ/2}, 0],[0, e^{iθ/2}]] | radians |
| C_U1(θ) | diag(1,1,1,e^{iθ}) on (control,target) | radians |

**Quantum Theory Connection:** Rotation gates are continuous one-parameter subgroups of SU(2). R_x(π) ≡ -iX (global phase), R_y(π) ≡ -iY, R_z(π) ≡ -iZ. These enable arbitrary single-qubit rotations on the Bloch sphere. C_U1 is a controlled phase gate — applying e^{iθ} only when both control and target are |1⟩. In little-endian indexing, control and target are interchangeable since only the |11⟩ basis state (index 3 for n=2) is phased.

---

## 5. Circuit Model (`src/circuit/`) — Sprint 2 (Completed)

### 5.1 Gate (`GateColumn.js`)

Passive immutable value object:

```javascript
{ name: string, target: int, controls: [{row:int, on:bool}], target2?: int, thetaRad?: number }
```

**Quantum Theory Connection:** Controls implement conditional (multi-qubit) operations. A control with `on: true` is a positive control (fires when qubit row = 1); `on: false` is an anti-control (fires when qubit row = 0). The control descriptor `{row, on}` maps directly to bitmask arithmetic in the kernel layer.

### 5.2 GateColumn (`GateColumn.js`)

A vertical slice where all gates act on **disjoint qubit rows** and are applied simultaneously. Enforces intra-column disjointness: no two operations may share a target, target2, or control row.

**Circuit Theory Connection:** Columns correspond to tensor factors in the composite unitary. Since gates in a column act on disjoint qubits, they commute and the column unitary is U_col = U_{g1} ⊗ U_{g2} ⊗ ... Applied left-to-right: total U = U_{k-1} ∘ ... ∘ U_1 ∘ U_0.

### 5.3 Circuit (`Circuit.js`)

Immutable `{numQubits, columns[]}` with `withColumnAt(index, column)` and `withRows(numQubits)` returning new instances. Structural equality via `isEqualTo()`.

**Circuit Theory Connection:** A circuit is an ordered list of column unitaries applied sequentially. Column 0 executes first (leftmost in the editor). The composite unitary is the matrix product of column unitaries in reverse order (rightmost column applied last).

### 5.4 Serializer (`Serializer.js`) — Canonical v1 JSON

Two-tier serialization:
- **Tier 1:** Canonical v1 JSON with `"format": "simqc-circuit"`, `"version": 1`, `"bitOrder": "little-endian"`, `"numQubits"`, `"columns"` array of gate descriptors
- **Tier 2:** Ephemeral URL codec (deflate-raw + Base64URL) for shareable links < 150 chars

**Quantum Theory Connection:** Little-endian bit ordering means qubit row q corresponds to bit q of the basis state index i. The top editor row (row 0) is the LSB. UI displays big-endian ket strings \|q_{n-1}...q_0⟩ but core uses little-endian indices — this reversal happens only in visualization/UI, never in core.

### 5.5 Flatten (`Flatten.js`) — Dual-Layer Pipeline

**Layer 1:** `flattenCircuit(circuit)` → `Instruction[]` (1D, canonical ordering for AI/cache):
```
{gateId, target, target2?, thetaRad?, controls[], column, virtualColumn, subcircuit?}
```

**Layer 2:** `scheduleColumns(instructions)` → `ExecutionColumn[]` (2D, grouped by virtualColumn for execution).

**Circuit Theory Connection:** Subcircuit inlining recursively expands nested circuits into successive virtual columns. Subsequent top-level gates shift accordingly. This preserves the left-to-right, top-to-bottom execution order of the original circuit tree.

### 5.6 GateRegistry (`GateRegistry.js`)

Central lookup with `registerFixedGate(name, flatTuple)`, `registerParameterizedGate(name, fn)`, `seal()`, `getGate(name, theta)`. Imported only by `main.js` which injects gate implementations — breaking the circuit→gates dependency cycle (Quirk structural defect #2 explicitly prevented).

---

## 6. MEMBER 4 IMPLEMENTATION — Simulation Execution Engine (`src/sim/`)

**This is the core contribution of Member 4.** The simulation engine transforms passive circuit data into evolving quantum states. It consists of five modules:

### 6.1 `kernel.js` — Hot-Path Scalar Kernels

The heart of the simulator. Every function is a **bare module function** (not a static class method), imported via `import * as Kernel from './kernel.js'`. This eliminates V8 inline cache property lookups and `this` receiver overhead, allowing TurboFan to inline inner loops into register-level scalar operations.

#### 6.1.1 `apply1QubitOp(re, im, n, target, gateFlat, controlMask, antiControlMask)`

Applies a single-qubit gate G to target qubit row t using **matrix-free pairwise update** (O(2^n) per gate, not O(4^n)):

For each disjoint pair (i₀, i₁) where i₁ = i₀ | 2^t (bit t differs):

```
[α'_{i₀}]   [g₀₀  g₀₁] [α_{i₀}]
[α'_{i₁}] = [g₁₀  g₁₁] [α_{i₁}]
```

**Unrolled scalar complex multiplication (zero allocation):**

```javascript
re[i0] = g00re*a0r - g00im*a0i + g01re*a1r - g01im*a1i;
im[i0] = g00re*a0i + g00im*a0r + g01re*a1i + g01im*a1r;
re[i1] = g10re*a0r - g10im*a0i + g11re*a1r - g11im*a1i;
im[i1] = g10re*a0i + g10im*a0r + g11re*a1i + g11im*a1r;
```

**Stride-2^t block iteration:** Outer loop steps by `fullBlock = 2 << t`, inner loop iterates `[blockStart, blockStart + halfBlock)` where `halfBlock = 1 << t`. Each pair (i₀, i₁) visited exactly once — no double-visiting.

**Controlled/anti-controlled pass-through:** Pair updated only when `(i₀ & controlMask) === controlMask && (i₀ & antiControlMask) === 0`. Non-matching indices remain **bit-identical** (`Object.is(before, after) === true`).

**Quantum Theory Connection:** This implements the partial trace over all qubits except the target. The 2×2 submatrix acts on the subspace where all non-target qubits are fixed. The stride-2^t iteration is the efficient way to enumerate all such subspaces without constructing the 2^n × 2^n Kronecker-lifted matrix I^{⊗t} ⊗ G ⊗ I^{⊗(n-1-t)}, which would require O(4^n) memory and time.

#### 6.1.2 `applyCnot(re, im, n, control, target)`

Swaps amplitudes α_i ↔ α_j where j = i ⊕ 2^target, only when control qubit = 1. Uses XOR swap with `i < j` guard to avoid double-swapping.

**Bidirectional CNOT (per CONVENTIONS §4.2):**

- CNOT(0→1) on n=3: swaps exact index pairs {1,3} and {5,7} (control = row 0 = LSB = bit 1)
- CNOT(1→0) on n=3: swaps exact index pairs {2,3} and {6,7} (control = row 1 = bit 2)

These exact swap pairs are the canonical test assertions for bidirectional endianness correctness.

**Quantum Theory Connection:** CNOT is the canonical two-qubit entangling gate. CNOT(control→target) flips the target qubit when control = |1⟩. Applied to |+0⟩ = H(0)|0⟩ ⊗ |0⟩, it produces the Bell state (|00⟩ + |11⟩)/√2 — the simplest entangled state. The directionality matters: CNOT(0→1) and CNOT(1→0) produce different entanglement structures on n > 2 qubits.

#### 6.1.3 `applyCz(re, im, n, control, target)`

Phases (negates) amplitude α_i only when both control and target qubits are 1. Diagonal phase gate — no swapping, only sign flip.

**Quantum Theory Connection:** CZ is locally equivalent to CNOT (CZ = (I⊗H)·CNOT·(I⊗H)). It applies a Z gate to the target conditioned on control = |1⟩. In the computational basis, it multiplies |11⟩ by -1, leaving |00⟩, |01⟩, |10⟩ unchanged.

#### 6.1.4 `applyToffoli(re, im, n, c0, c1, target)`

Controlled-controlled-NOT: swaps target when both controls are 1. Uses XOR swap with `i < j` guard.

**Quantum Theory Connection:** Toffoli (CCNOT) is a universal reversible classical gate combined with Hadamard gives universal quantum computation. It flips the target conditioned on both controls being |1⟩ — the quantum AND operation.

#### 6.1.5 `applySwap(re, im, n, q0, q1)`

Exchanges amplitudes α_i ↔ α_j where j = i ⊕ 2^{q0} ⊕ 2^{q1} (bit swapping at positions q0 and q1), only when the bits differ.

**Quantum Theory Connection:** SWAP exchanges the states of two qubits. It can be decomposed as 3 CNOTs or implemented directly as a 3-way swap. Used in QFT to reverse qubit order at the end (little-endian → big-endian output).

### 6.2 `Evaluator.js` — Fast Single-Buffer Evaluator

```javascript
export function evaluate(schedule, numQubits) -> StateVector
```

Executes a flattened `ExecutionColumn[]` schedule against |0...0⟩ with **zero intermediate allocations**. For each column, for each instruction:
1. Resolve gate via `GateRegistry.getGate(gateId, thetaRad)` (flat tuple)
2. Compute controlMask / antiControlMask from control descriptors
3. Dispatch to appropriate kernel: CNOT, CZ, SWAP, Toffoli, or `apply1QubitOp`

**Quantum Theory Connection:** This is the Schrödinger-picture state-vector simulation. The composite unitary U = U_{k-1} ... U_1 U_0 is applied incrementally to the state vector, avoiding explicit matrix construction. Each gate application is a linear transformation on the 2^n-dimensional Hilbert space.

### 6.3 `StepTrace.js` — Tiered Adaptive Step Trace

The **crowning achievement of Member 4.** Provides column-by-column state inspection with two storage modes selected by qubit count:

| Mode | Qubits | Storage | Memory | Seek |
|------|--------|---------|--------|------|
| **Dense** | n ≤ 12 | `snapshots[step] = {re, im}` cloned at each column | ~1.3 MB for 20 cols at n=12 | O(1) via `TypedArray.set()` |
| **Ephemeral Replay** | n > 12 | Single mutable `re[]`, `im[]` | Flat at 268.4 MB even at n=24 | Fast-forward from step 0 (zero allocations) |

**API:**

```javascript
trace.reset()              // → |0...0⟩, step=0, cache initial snapshot (Dense)
trace.next()               // Apply next column, cache snapshot (Dense)
trace.seek(targetCol)      // Dense: copy cached snapshot; Ephemeral: reset + loop next()
trace.findStepWhere(pred)  // Reset, step until predicate(re, im, step) returns true
trace.verify(expectation)  // Compare against analytic.js expectations at each step
trace.currentState         // Read-only view (no buffer exposure)
```

**Quantum Theory Connection:** StepTrace enables **mid-circuit debugging** — observing state evolution at each column boundary. This is essential for understanding superposition buildup, entanglement generation, and phase interference step by step. The Dense mode snapshots implement a "density matrix of the computation history" — each snapshot is the pure state \|ψ_c⟩ = U_c ... U_1 U_0 \|0...0⟩ after column c.

**Critical Design Decision:** Dense mode clones `Float64Array` buffers at each column boundary via `new Float64Array(re)` — this is an allocation, but only O(2^n) per column, and only for n ≤ 12 where total memory is bounded (~1.3 MB for 20 columns at n=12). Ephemeral mode avoids all allocations by replaying from step 0 on backward seek — preventing the 5.37 GB trace OOM crash that would occur at n=24 with dense snapshots.

### 6.4 `analytic.js` — Curated Closed-Form Expectations

Provides mathematically exact state vectors for verification:

```javascript
bellState()      // (|00⟩ + |11⟩)/√2, amplitude 1/√2 at indices 0 and 3 (little-endian)
ghzState(n)      // (|0...0⟩ + |1...1⟩)/√2, amplitude 1/√2 at indices 0 and 2^n-1
qftState(n, k)   // QFT|k⟩ = 1/√2^n Σ_j exp(2πi·k·j/2^n) |j⟩
teleportationResource()  // Same as bellState
expectation(fn)  // Wraps expectation function for StepTrace.verify()
```

**Quantum Theory Connection:** These are the textbook states against which the simulator is validated:
- **Bell state:** The simplest entangled state, demonstrating non-local correlations
- **GHZ state:** n-qubit generalization, maximal multipartite entanglement
- **QFT state:** The Quantum Fourier Transform maps basis states to phase-encoded superpositions — the core subroutine of Shor's algorithm

### 6.5 `limits.js` — Qubit Capacity Policy

```javascript
MAX_DENSE_QUBITS = 12;
MAX_EPHEMERAL_QUBITS = 20;
HARD_CLI_CAP = 24;
```

Tiered policy per CONVENTIONS §6:
- n ≤ 12: Unrestricted evaluate(), Dense StepTrace, automatic purity γ_q
- 13 ≤ n ≤ 14: Unrestricted evaluate(), Ephemeral StepTrace, debounced purity
- 15 ≤ n ≤ 20: UI advisory warning, Ephemeral StepTrace, on-demand purity
- n > 20: Hard refusal on browser UI; allowed only in bare Node CLI (cap at 24)

**Quantum Theory Connection:** The 2^n exponential scaling of Hilbert space dimension means n=24 requires 2^24 = 16.7M amplitudes × 16 bytes = 268 MB per state vector. Dense snapshots at n=24 would require 268 MB × 20 columns = 5.37 GB — the OOM crash that Ephemeral mode prevents.

---

## 7. Measurement Module (`src/measurement/`) — Sprint 2 (Completed)

### 7.1 `collapse(state)`

Single-shot collapse via Born rule:
1. Sample index i with probability P(i) = |α_i|² = re[i]² + im[i]²
2. Collapse in place: re[i] = 1.0, im[i] = 0.0, all other entries = 0.0

**Quantum Theory Connection:** The measurement postulate of quantum mechanics. Upon measuring in the computational basis, the state collapses to the observed basis state \|i⟩ with probability |α_i|². The post-measurement state is a computational basis state (product state, no entanglement).

### 7.2 `sampleHistogram(state, shots)`

Repeated-shot sampling:
1. Clone state once (preserves pre-measurement distribution)
2. Draw S independent samples from Born probabilities
3. Return Map of outcome counts

**Quantum Theory Connection:** Estimates the Born probability distribution empirically. As shots → ∞, the histogram converges to P(i) = |α_i|². Used for algorithmic verification (e.g., Grover's search should show the marked item with high probability).

---

## 8. Canonical Algorithms (`src/algorithms/`) — Tier 3 (Completed)

### 8.1 QFT (`qft.js`)

Builds QFT on n qubits (little-endian):
```
for q = n-1 down to 0:
  H(q)
  for m = 0 to q-1:
    C_U1(2π/2^{q-m+1}) with control m, target q
SWAP(j, n-1-j) for j = 0..floor((n-1)/2)
```

**Quantum Theory Connection:** QFT|k⟩ = 1/√2^n Σ_{j=0}^{2^n-1} exp(2πi·k·j/2^n) |j⟩. The controlled phase rotations C_U1(2π/2^{q-m+1}) implement the phase kickback that creates the Fourier spectrum. The final SWAPs reverse qubit order (little-endian input → big-endian output). QFT is the core subroutine of Shor's factoring algorithm.

### 8.2 Grover (`grover.js`)

```
H⊗n (initialize superposition)
for iteration = 1 to iterations:
  oracle (marks solution states with -1 phase)
  diffusion (inversion about the mean)
```

**Quantum Theory Connection:** Amplitude amplification. The oracle flips the phase of marked states; the diffusion operator inverts about the mean, amplifying marked amplitudes. After O(√N) iterations, measuring yields the solution with high probability. Quadratic speedup over classical search.

### 8.3 Deutsch-Jozsa (`dj.js`)

```
H on all input qubits; X then H on ancilla
oracle (constant or balanced function)
H on all input qubits
measure input qubits: all-zero = constant, otherwise = balanced
```

**Quantum Theory Connection:** Determines if a function f: {0,1}^n → {0,1} is constant or balanced with one query (classical needs up to 2^{n-1}+1). Exponential speedup for this specific problem. Uses phase kickback: the ancilla in |−⟩ = (|0⟩−|1⟩)/√2 picks up phase (-1)^{f(x)} when the oracle applies.

### 8.4 Shor (`shor.js`)

Order-finding circuit:
1. H on all count qubits (superposition over x)
2. Controlled-U^{2^j} for j = 0..t-1: controlled modular multiplication by a^{2^j} mod N
3. Inverse QFT on count register
4. Measure count → continued fractions → order r → factors of N

**Quantum Theory Connection:** Shor's algorithm factors N in polynomial time (exponential speedup over classical). The key quantum subroutine is order-finding: find the smallest r such that a^r ≡ 1 (mod N). Controlled modular multiplication U|y⟩ = |(a·y) mod N⟩ is implemented as a controlled value permutation (cycle decomposition into transpositions). The inverse QFT extracts the phase (frequency) from the superposition, revealing r via continued fractions.

The implementation uses multi-controlled X decompositions (Toffoli + ancillae), value detection (reg == v via anti-controls + MCX), and uncomputation to return flags to 0.

---

## 9. Discardable Feature Leaves

### 9.1 Debugger (`src/debugger/`) — Core logic complete

| File | Purpose |
|------|---------|
| `Debugger.js` | High-level controller: reset(), next(), seek(), runToBreakpoint(), findStepWhere(), getCurrentState() |
| `Timeline.js` | Scrubbing UI: scrub(), scrubBy(), peekState(), getChangedSteps(), callbacks (onScrub, onStepChange) |
| `BreakpointManager.js` | Column breakpoints + predicate breakpoints with checkBreakpoints(step) |

**Quantum Theory Connection:** The debugger enables observation of state vector evolution at each column boundary — essential for understanding superposition buildup, entanglement generation, and phase interference. Predicate breakpoints can detect when entanglement first appears (purity γ_q < 1) or when a specific amplitude becomes non-zero.

### 9.2 Inspector (`src/inspector/`) — Stub

Reads StepTrace only. Planned: amplitude/probability bar charts, shot histograms, per-qubit Bloch sphere subtabs, single-qubit purity γ_q row-glow calculator.

**Quantum Theory Connection:** Single-qubit reduced density matrix ρ_q computed by tracing out all other qubits:
```
ρ_{00} = Σ_{i: bit q = 0} |α_i|²
ρ_{11} = 1 - ρ_{00}
ρ_{01} = Σ_{i: bit q = 0} α_i α_j*  (j = i ⊕ 2^q)
```
Purity γ_q = Tr(ρ_q²) ∈ [0.5, 1.0]. γ_q = 1 → separable pure state (Bloch vector on sphere surface, |r_q| = 1). γ_q = 0.5 → maximally entangled (Bloch vector at origin, |r_q| = 0). Linear entropy S_L(q) = 1 - γ_q quantifies entanglement.

### 9.3 AI (`src/ai/`) — Stub

Consumes Flatten.js Instruction[] and sparse Top-k state summaries. Planned: circuit explainer, I/O causal analyzer, natural-language builder, SHA-256 cache.

**Quantum Theory Connection:** Sparse grounding avoids sending full 2^n state vectors to LLMs. Instead, summarizes each column with top k=16 basis states by probability (big-endian ket format) plus per-qubit marginal probabilities and linear entropies — a compact representation that captures the essential quantum behavior without exponential prompt size.

---

## 10. Bootstrap (`src/main.js`) — Sprint 2 (Completed)

The sole importer of `gates/` and discardable leaves. Registers all gates into GateRegistry, then seals it:

```javascript
import { registerFixedGate, registerParameterizedGate, seal } from './circuit/GateRegistry.js';
import { I, X, Y, Z, H, S, T } from './gates/basis.js';
import { Cu1, Rx, Ry, Rz } from './gates/param.js';

registerFixedGate('I', I); registerFixedGate('X', X); ... 
registerParameterizedGate('Rx', Rx); registerParameterizedGate('Ry', Ry); ...
seal();  // Freezes registry — no further registration
```

Breaks the circuit→gates dependency cycle (Quirk defect #2 explicitly prevented). Deleting any leaf folder requires at most a 2-line diff in this file.

---

## 11. Test Coverage — 393 Tests Passing

| Layer | Test File | Tests | Key Assertions |
|-------|-----------|-------|----------------|
| Core | Complex.test.js | 15 | Arithmetic, polar, edge cases |
| Core | Matrix.test.js | 14 | Unitarity, Kronecker, tensor product |
| Core | StateVector.test.js | 17 | Init invariant, clone, bit-identity, norm |
| Circuit | GateColumn.test.js | 26 | Disjointness, equality, descriptors |
| Circuit | Circuit.test.js | 12 | withColumnAt, withRows, isEqualTo |
| Circuit | Serializer.test.js | 22 | Round-trip fromJson(toJson(c)) |
| Circuit | Flatten.test.js | 8 | 1D/2D flattening, subcircuit inlining |
| Circuit | GateRegistry.test.js | 16 | Registration, lookup, sealing |
| Sim | kernel.test.js | 11 | Bidirectional CNOT swap pairs, controlled gates |
| Sim | Evaluator.test.js | 10 | Bell state, Rx/Ry/Rz, anti-control |
| Sim | StepTrace.test.js | 23 | Dense/Ephemeral modes, seek, findStepWhere, verify |
| Sim | analytic.test.js | 15 | Bell, GHZ, QFT state expectations |
| Sim | limits.test.js | 16 | Qubit ceilings, advisories, hard cap |
| Gates | basis.test.js | 9 | Flat tuples, unitarity, matrixToFloat8 |
| Gates | param.test.js | 7 | Rotation tuples, Cu1, type validation |
| Algorithms | qft.test.js | 3 | QFT circuit construction |
| Measurement | measurement.test.js | 10 | Collapse, histogram, Born sampling |
| Debugger | Debugger/Timeline/BreakpointManager | 57 | Step controls, breakpoints, timeline |
| Differential | differential.test.js | 1 | Kernel vs naive Matrix (n=1..6, 6 profiles) |

---

## 12. Build Order Progress (per SOURCE_OF_TRUTH §9.3)

| Step | Deliverable | Status |
|------|-------------|--------|
| 1a | core/Complex, Matrix, CONVENTIONS | ✅ Completed (Sprint 1) |
| 1b | core/StateVector, sim/kernel, core gates, n≤6 differential | ✅ Completed (Sprint 2) |
| 2 | circuit/ — Gate, GateColumn, Circuit, Ascii | ✅ Completed |
| 3 | circuit/Serializer + GateRegistry | ✅ Completed |
| 4 | circuit/Flatten + sim/Evaluator + StepTrace + measurement | ✅ Completed |
| 5 | sim/Analytic + algorithms (DJ, Grover, QFT, Shor) | ✅ Completed (all 4) |
| 6 | canvas/ — Layout, Renderer, Interaction, VS Code panels | ⏳ Planned |
| 7 | Engine Breakpoints (findStepWhere) | ✅ Completed (in debugger) |
| 8 | state/History.js | ⏳ Planned |
| 9 | inspector/ (Amplitudes, Bloch, Purity γ_q) | 🟡 Stub only |
| 10 | debugger/ UI (Timeline, breakpoints) | ✅ Core logic done |
| 11 | ai/ (Explainer, Builder, Cache) | 🟡 Stub only |

---

## 13. Member 4 Implementation Summary

Member 4 implemented the **Simulation Execution Engine** — the critical bridge between passive circuit data and evolving quantum states. The five modules (`kernel.js`, `Evaluator.js`, `StepTrace.js`, `analytic.js`, `limits.js`) provide:

1. **Matrix-free O(2^n) gate application** via stride-2^t block iteration over split Float64Array buffers — avoiding the O(4^n) cost of Kronecker-lifted matrices
2. **Exact bidirectional CNOT semantics** with canonical swap pair assertions ({1,3}/{5,7} for CNOT(0→1), {2,3}/{6,7} for CNOT(1→0) on n=3)
3. **Controlled/anti-controlled bit-identical pass-through** — non-matching amplitudes remain Object.is identical
4. **Tiered StepTrace** — Dense mode (O(1) seek for n≤12) and Ephemeral Replay mode (zero-allocation fast-forward for n>12), preventing OOM crashes at n=24
5. **Closed-form analytic expectations** — Bell, GHZ, QFT states for verification against textbook quantum mechanics
6. **Qubit capacity policy** — Tiered limits (12/20/24) matching Hilbert space exponential scaling

These implementations connect directly to quantum computing theory: the state-vector simulation implements the Schrödinger picture, the pairwise kernel implements partial trace over non-target qubits, CNOT/CZ/Toffoli are canonical entangling gates, QFT is Shor's core subroutine, and StepTrace enables mid-circuit observation of superposition and entanglement evolution.