Title: SimQC AI agent leaf implemented (build Step 11)

Summary:
Implemented the `ai/` discardable feature leaf (SimQC build Step 11, "Built Strictly Last"), continuing from the existing 13-line `src/ai/AIExplainer.js` stub.

New source files (all under `src/ai/`, each < 400 lines, named exports only, DOM-free, bare-Node compatible):
- `AIExplainer.js` — rewrote the explainer to build a pedagogical prompt from flattened `Instruction[]` + Sparse Top-k summaries, call Ollama (`localhost:11434`, `qwen2.5:3b`, `num_ctx 4096`), and fall back to a deterministic template explanation when Ollama is unreachable. Optionally consults a content-addressed `Cache`.
- `SparseSummary.js` — pure JS sparse Top-k state summarizer: top `k=16` basis states with `P > 1e-4` in big-endian ket labels, plus per-qubit `rho00` and linear entropy `S_L`. Never serializes the full `2^n` vector into a prompt.
- `Cache.js` — in-memory content-addressed cache keyed on `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)` using a pure-JS SHA-256 (dual-runtime compatible, no Node `crypto`).
- `IOAnalyzer.js` — causal input/output analysis over the flattened schedule using `StepTrace` (changed steps + touched rows), producing input-affected/output-affected columns and a causal chain; optional LLM enrichment via `AIExplainer`.
- `AIBuilder.js` — stretch capability: natural-language prompt → canonical v1 JSON → validated `Circuit` via `Serializer.fromJson` (never injects raw matrices).

Mirrored tests under `test/ai/`: `SparseSummary.test.js`, `AIExplainer.test.js` (mocked fetch), `Cache.test.js` (known SHA-256 vectors), `IOAnalyzer.test.js` (mocked StepTrace), `AIBuilder.test.js` (mocked fetch + real Serializer).

Wiring:
- `src/main.js` — uncommented the `ai/AIExplainer.js` import, instantiated `aiExplainer`, exported it (the only file importing `ai/`; leaf remains trivially deletable).
- `AI_INTERFACE.md` — created the normative AI I/O contract.
- `.tmp/ai-e2e-smoke.js` — end-to-end smoke script (Bell circuit: serialize → flatten → StepTrace → SparseSummary → AIExplainer with cache).

Docs:
- `README.md` — project status table: Explainer AI marked ✅ Done; Builder AI kept ⬜ Planned (stretch).
- `SOURCE_OF_TRUTH.md` §9.3 — Step 11 status changed from "Planned" to "Completed".

Note: `node --test` could not be executed in this environment (Node.js is not installed on PATH), so the test suite was not run here. All static conventions were verified by inspection (400-line cap, named exports only, no default exports, no barrel files, explicit `.js` extensions, no `window`/`document`, no `var`, `ai/` imports only `core/`/`circuit/`/`sim/` and is imported only by `main.js`, no inter-leaf edges).
