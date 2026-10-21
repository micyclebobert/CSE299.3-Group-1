# SimQC — Fluid Folder Structure & Domain Grouping Plan

> **Philosophy:** Folder boundaries in SimQC exist for only three reasons: **(1) enforcing the Node/Browser DOM boundary**, **(2) preventing circular dependencies**, and **(3) making optional features deletable with `rm -rf`**. Everything inside a group remains fluid and can grow or merge organically as we code.

---

## High-Level Topology Overview

```
simqc/
├── .tmp/ · .dump/              [1. Scratch & Artifacts]
├── src/
│   ├── core/ · circuit/ · sim/ [2. Headless Simulation Engine (Zero DOM)]
│   ├── gates/ · algorithms/    [3. Quantum Catalog & Canonical Builders]
│   ├── ui/ · state/        [4. Core IDE Shell & Circuit Editor]
│   └── debugger/ · inspector/ · ai/  [5. Discardable Feature Leaves]
├── test/                       [6. Mirrored Automated Verification]
└── cli/ · scripts/             [7. Differential Pipe & CI Guardrails]
```

---

## Group 1: Root Workspace & Scratch Zones

These sit at the repository root and keep transient experiments out of source control and module graphs.

* **Root Docs & Manifests:** `CONVENTIONS.md`, `SOURCE_OF_TRUTH.md`, `README.md`, `requirements.txt`, and the browser entry (`index.html`).
* **`.tmp/` (Ephemeral Scratch):** Throwaway scripts, quick math sanity checks, and temporary spikes. Can be wiped at any moment.
* **`.dump/` (Semi-Permanent Outputs):** Benchmark logs, Ollama throughput baselines, and JSON dumps from differential test runs.

---

## Group 2: The Headless Engine (`src/` — Pure JS, Zero DOM)

This group is the mathematical and structural heart of SimQC. Every folder here must run unmodified in bare Node.js (`node --test`).

* **`core/` (Foundational Math & State Memory):**
  * Holds pure mathematical primitives and the split-buffer state vector container.
  * *Boundary:* Knows nothing about circuits, gates, columns, or UI.
* **`circuit/` (Passive Data Model & Wire Codecs):**
  * Holds the immutable grid representation, subcircuit nesting, 1D/2D flattening, ASCII diagram parsing, and JSON/URL serialization.
  * *Boundary:* Pure data and structural transforms only—never executes gates or imports the gate catalog.
* **`sim/` (Execution, Kernels & State Evolution):**
  * Holds the hot-path scalar kernels, column evaluator, tiered `StepTrace`, and analytic state checks.
  * *Fluid Seam (`measurement/`):* Non-unitary measurement and shot sampling can either live as a standalone `measurement/` sibling folder or sit naturally inside `sim/` as part of state evolution.

---

## Group 3: Quantum Catalog & Algorithms (`src/` — Domain Content)

Kept separate from the engine internals so the core circuit model never gets coupled to specific gate matrices or textbook circuits.

* **`gates/` (The Gate Catalog):**
  * Defines standard, rotation, control, and helper gates, plus the registry builder.
  * *Boundary:* Imported **only** by the application bootstrap (`main.js` / CLI runner) and injected into `circuit/`.
* **`algorithms/` (Canonical Algorithm Builders):**
  * Houses the verified circuit generators and runners for Deutsch–Jozsa, Grover, QFT, and Shor.
  * *Fluid Seam:* Can stay flat or group by algorithm if helper subcircuits grow large.

---

## Group 4: Core IDE Shell & Editor (`src/` — Browser UI)

The guaranteed visual workspace: the dark-mode VS Code dockable layout and interactive circuit grid.

* **`ui/` (or `editor/` / `canvas/`):**
  * Handles pure grid coordinate math, canvas painting, gate drag-and-drop interactions, theme constants, and the dockable panel shell (Left Toolbox, Main Grid, Right Code/AI container, Bottom Inspector container).
  * *Fluid Seam (`state/`):* Undo/redo history (`History`) and minimal reactive observables can live in a tiny `state/` sibling group or sit directly inside the editor shell group.

---

## Group 5: Discardable Feature Leaves (`src/` — Optional Modules)

Each folder in this group is a self-contained island wired only by `main.js`. Deleting any folder here must not break the build or any sibling leaf.

* **`debugger/`:** Stepwise playback controls, timeline scrubber, and breakpoint triggers reading `StepTrace`.
* **`inspector/`:** Bottom-panel visual readouts (amplitude/probability bars, shot histograms, per-qubit Bloch sphere subtabs) and the single-qubit purity ($\gamma_q$) row-glow calculator.
* **`ai/`:** Built last. Houses the Ollama/LLM explainer, causal I/O analyzer, natural-language circuit builder, Sparse Top-$k$ state summarizer, and `SHA-256` cache.

---

## Group 6: Verification & Tooling (`test/` & `cli/`)

* **`test/` (Mirrored Test Tree):**
  * Mirrors the `src/` groups (`test/core/`, `test/circuit/`, `test/sim/`, etc.) so `node --test` can run targeted or full-suite verification cleanly.
* **`cli/` or `scripts/` (Headless Runner, Differential Pipe & CI Checks):**
  * Houses the bare Node `stdin -> stdout` runner, the Python Qiskit/Cirq differential verification script (consuming `requirements.txt`), and lightweight CI guardrails (line-count cap, import-zone checker).

---

## Open Fluid Choices to Settle When Ready

1. **`measurement/` placement:** Keep as its own top-level engine folder (`src/measurement/`) or fold into `src/sim/`?
2. **UI naming (`ui/` vs. `ui/` + `canvas/`):** Keep all core IDE chrome + circuit canvas inside `src/ui/`, or split the VS Code dockable panel chrome (`src/ui/`) from the 2D circuit grid (`src/canvas/`)?
3. **`cli/` vs. `scripts/`:** Keep the Node `stdin -> stdout` pipe and Python Qiskit verifier together in `scripts/` (or `tools/`), or give the Node CLI its own `cli/` folder?