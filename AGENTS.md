# AGENTS.md — SimQC Agent Operating Instructions

**Mandatory pre-work:** Before reading or editing anything, read `SOURCE_OF_TRUTH.md`, `CONVENTIONS.md`, and `FOLDER_STRUCTURE.md` in full. These three files are the single source of truth and supersede this file. If anything here conflicts with them, the three canonical files win.

## Role
You are a software engineer working on SimQC: a zero-dependency, browser-resident quantum circuit simulator with a bare Node.js CLI runner. Every change must run unmodified in both modern browsers and bare Node.js (`node --test`).

## Operating Rules (do not repeat the three canonical files; these are agent-specific)

1. **Zero external dependencies.** Never `npm install`, never add `node_modules`, never import a bundler (Vite/Webpack/Rollup), never import a quantum library (Qiskit/Cirq/PennyLane). Pure JS with explicit `.js` ESM imports only.
2. **Named exports only.** Default exports are forbidden. Every source file exports a primary symbol matching its base filename (`PascalCase.js` for classes, `camelCase.js` for bare-function kernels). No barrel/`index.js` files.
3. **Core is DOM-free.** Modules under `src/core/`, `src/circuit/`, `src/sim/` must never reference `window`, `document`, or any DOM global. UI lives in `src/ui/` and `src/canvas/` only.
4. **Layering is strict.** `core/` imports only internal `core/` files. `circuit/` imports `core/` + internal `circuit/`. `sim/` + `measurement/` import `core/` + `circuit/`. `gates/` and discardable leaves (`debugger/`, `inspector/`, `ai/`) are imported **exclusively** by `main.js` and injected into `circuit/` via `GateRegistry`. Zero imports between any two leaf folders.
5. **Terminology.** Qubit `row` (never "wire"), top-to-bottom index $q \in \{0, \dots, n-1\}$, `rowSpan`/`withRows`. Columns are discrete, column-wise schedules (no continuous time $t$).
6. **Tests.** Every source module has a 1:1 mirrored `*.test.js` in `test/`, executed via native `node --test`. Tests mirror source structure (`test/{base,math,circuit,gates}/`).
7. **CLI pipe contract.** The headless runner reads canonical v1 JSON from `stdin` and writes deterministic JSON state-vector output to `stdout`. Diagnostics/warnings go to `stderr` only so `stdout` stays valid JSON.
8. **File hygiene.** Max 400 lines per file. No license headers. No Closure JSDoc (`checkJs`). `const` by default; `let` only for loop counters/accumulators; `var` forbidden. Zero module-level mutable state. No spaces anywhere in the file tree.
9. **Scratch zones.** `.tmp/` is ephemeral (never imported by `src/` or `test/`). `.dump/` holds benchmark logs and differential JSON dumps.
10. **Optional leaves are deletable.** Deleting `debugger/`, `inspector/`, or `ai/` must require at most a 2-line diff in `main.js`, with zero inter-feature dependencies.
11. **State vector format.** Core thinks in indices; UI thinks in labels. State vectors use split `Float64Array` buffers (`re[]`, `im[]`). Gates flatten at definition time into contiguous 8-number tuples (`number[8]` / `Float64Array(8)`).
12. **Git.** Commit only when explicitly asked. Conventional commit style matching repo history. Never commit secrets or `node_modules`.

## Verification
Before claiming a task is done, run `node --test` from the repo root and confirm all tests pass. Check `git status` and `git diff` to confirm only intended files changed. Never retain tests that assert hardcoded values for functions or code blocks whose outputs are not constant.

## When in doubt
Re-read `SOURCE_OF_TRUTH.md` (architecture), `CONVENTIONS.md` (actionable rules), and `FOLDER_STRUCTURE.md` (domain grouping) before proceeding. If it is still unclear, stop and ask.
