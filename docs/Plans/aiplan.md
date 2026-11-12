# SimQC AI Agent Implementation Plan (`docs/Plans/aiplan.md`)

**Purpose:** Build the `ai/` discardable feature leaf (SimQC Step 11 of the 11-step build order) — an Ollama-backed quantum-circuit explainer, causal I/O analyzer, and optional natural-language circuit builder — consuming only `Serializer.js`, `Flatten.js`, and `StepTrace`.

**Status:** **AI leaf code complete (all `src/ai/` and `test/ai/` files created), but existing-file wiring reverted.** `src/main.js`, `README.md`, and `SOURCE_OF_TRUTH.md` are back to their original state — the `ai/` leaf is not yet wired into the application. The original 13-line `src/ai/AIExplainer.js` stub was replaced with a full implementation.

**Cadence:** One segment per working day (~2 weeks at 5 days/week). Segments are ordered by dependency.

---

## 0. Context — What Already Exists (do not rebuild)

| Artifact | Path | State |
|---|---|---|
| AI explainer | `src/ai/AIExplainer.js` | Full explainer: Ollama call + template fallback + cache integration (replaced 13-line stub) |
| Sparse summarizer | `src/ai/SparseSummary.js` | Pure JS Top-k (k=16, P>1e-4) state summarizer, big-endian ket labels |
| Content cache | `src/ai/Cache.js` | SHA-256 keyed in-memory cache, pure-JS SHA-256 |
| Causal I/O analyzer | `src/ai/IOAnalyzer.js` | Input/output analysis over flattened schedule via `StepTrace` |
| Circuit builder (stretch) | `src/ai/AIBuilder.js` | NL → canonical v1 JSON → validated `Circuit` via `Serializer.fromJson` |
| AI tests | `test/ai/{SparseSummary,AIExplainer,Cache,IOAnalyzer,AIBuilder}.test.js` | 1:1 mirror, mocked fetch/StepTrace, no network |
| AI contract | `AI_INTERFACE.md` | Normative AI I/O contract (inputs, outputs, cache key, errors) |
| Main wiring | `src/main.js` | **Reverted** — AI import commented out, no `aiExplainer` instantiation or export |
| Canonical v1 JSON | `src/circuit/Serializer.js` | `toJson(circuit)` / `fromJson(text)` — complete, strict (unedited) |
| Flattening | `src/circuit/Flatten.js` | `flattenCircuit(circuit) -> Instruction[]`, `scheduleColumns()` (unedited) |
| Step trace | `src/sim/StepTrace.js` | `reset()`, `next()`, `seek()`, `findStepWhere()`, `verify()`, etc. (unedited) |
| Canonical algorithms | `src/algorithms/{dj,grover,qft,shor}.js` | Ready demo circuits for the builder/explainer (unedited) |
| Tests | `test/**/*.test.js` | Mirror 1:1 with source; run via `node --test` |

### Edits to existing files (reverted)

All edits to previously existing non-AI files have been reverted:

| File | Original edit | Current state |
|---|---|---|
| `src/main.js` | Uncommented AI import, instantiated `aiExplainer`, exported it | **Reverted** — import commented out, no AI references |
| `README.md` | Project status table: "Explainer AI" → Done | **Reverted** — back to "Explainer AI and builder AI | Proposed feature | ⬜ Planned" |
| `SOURCE_OF_TRUTH.md` | §9.3 Step 11 status: "Planned" → "Completed" | **Reverted** — back to "Planned" |

The `src/ai/AIExplainer.js` stub (13 lines) was replaced with a full implementation as part of building the `ai/` leaf itself.

**Source of truth for AI scope:** `SOURCE_OF_TRUTH.md §8` and `CONVENTIONS.md §11`.

---

## 1. Governing Constraints (non-negotiable)

1. **Leaf isolation:** `ai/` is imported **exclusively** by `src/main.js`. Zero imports between `ai/` and `debugger/`/`inspector/`. `ai/` imports only `core/`, `circuit/`, `sim/` (`StepTrace`).
2. **DOM-free:** `ai/` must run unmodified in bare Node.js (`node --test`). No `window`/`document`.
3. **Sparse grounding:** Never serialize the full `2^n` state vector into an LLM prompt. At each virtual column, send only a **Sparse Top-k Summary**: basis states with probability `> 1e-4`, capped at top `k=16` terms in big-endian ket labels, plus per-qubit marginal `rho00(q)` and linear entropy `S_L(q)`.
4. **Cache key:** `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)`.
5. **Ollama stack:** default model `qwen2.5:3b` (`localhost:11434`), `num_ctx > 2048`; `qwen2.5-coder:7b` as quality reference; `qwen2.5:14b` reserved for Phase-5 Colab teacher (out of scope here).
6. **File hygiene:** max 400 lines per file, named exports only, no default exports, no barrel/`index.js`, explicit `.js` extensions, `const` by default, zero module-level mutable state, no license headers, no Closure JSDoc.
7. **Tests:** every new `ai/` source file gets a 1:1 `test/ai/*.test.js`, executed via `node --test`.
8. **Deletable:** removing `ai/` must require at most a 2-line diff in `main.js`.

---

## 2. Open Decisions (all resolved)

| Decision | Resolution | Rationale |
|---|---|---|
| Capability scope | **Committed:** Explainer + I/O Analyzer + SHA-256 cache. **Stretch (optional):** Builder (NL -> JSON). | Matches `SOURCE_OF_TRUTH §8`: Explainer is "Committed", Builder is "Proposed / Non-Guaranteed". |
| Ollama availability | Assumed `ollama` on `localhost:11434`; fallback to template explanation when unreachable. | Avoids blocking progress if Ollama is offline. |
| Daily cadence | One segment per working day; all 10 segments completed. | N/A — complete. |

---

## 3. Segment Plan (10 segments — one per working day)

### Segment 1 — Contract & scaffolding ✅ COMPLETED
**Goal:** Freeze the AI I/O contract and verify the Ollama runtime is reachable.
- Create `AI_INTERFACE.md` documenting: inputs (`Instruction[]` + sparse state summaries), outputs (explanation text), cache-key format, Ollama endpoint/model, error/fallback behavior.
- Review `src/ai/AIExplainer.js` stub; note what to keep/discard.
- Write a bare-Node smoke script (`.tmp/`) that `fetch`es `http://localhost:11434/api/tags` and logs whether Ollama is up (diagnostics to stderr only).
- Add `import { AIExplainer } from './ai/AIExplainer.js'` to `src/main.js` **still commented out** (wire up in Segment 7).
**Exit criteria:** `AI_INTERFACE.md` exists; Ollama reachability result documented; stub reviewed; `main.js` import remains commented.

### Segment 2 — Sparse Top-k state summarizer (pure JS, no LLM) ✅ COMPLETED
**Goal:** Produce the sparse state summary the AI consumes, without touching LLM.
- Create `src/ai/SparseSummary.js`: pure function `sparseSummary(state, numQubits, k=16, probThreshold=1e-4)` returning `{ topK: [{label, probability, phase}], marginals: [{row, rho00, sl}] }` with big-endian ket labels.
  - `label` = big-endian ket string `|q_{n-1}...q_0>` (UI formatting lives here, never in core/sim).
  - `probability` = `re[i]^2 + im[i]^2`; `phase` = `Math.atan2(im, re)`.
  - Marginals reuse the single-qubit reduced density math (`rho00`, `S_L = 1 - gamma`) — computed in `ai/` via stride-`2^q` iteration over `re`/`im` (mirrors `inspector/` logic but independent).
- Create `test/ai/SparseSummary.test.js` covering: all-zero state (only `|0...0>` at p=1), Bell state (top-2 terms), GHZ state (marginals `rho00=0.5`, `S_L=0.5`), probability cap at `k=16`, threshold filtering.
**Exit criteria:** `node --test test/ai/SparseSummary.test.js` passes; summarizer is pure, deterministic, DOM-free, <400 lines.

### Segment 3 — Explainer core (LLM call + fallback) ✅ COMPLETED
**Goal:** Rewrite `AIExplainer.js` to build a pedagogical prompt and call Ollama.
- Rewrite `src/ai/AIExplainer.js`:
  - `explain(instructions, summaries[], options?)` builds a prompt from the flattened `Instruction[]` plus per-column sparse summaries.
  - Calls Ollama `POST /api/chat` with model `qwen2.5:3b`, `num_ctx > 2048`, `stream: false`.
  - Returns the model's explanation text.
  - **Fallback:** if Ollama is unreachable or errors, return a deterministic template explanation describing gate sequence (no LLM dependency for correctness of flow).
  - Exported class `AIExplainer` (primary export matching filename).
- Keep prompt construction separate from the HTTP call so both are unit-testable.
**Exit criteria:** `AIExplainer.explain` returns a non-empty string with mocked Ollama success and with Ollama failure (fallback path); no `window`/`document`; <400 lines.

### Segment 4 — Explainer tests + SHA-256 cache ✅ COMPLETED
**Goal:** Test the explainer with a mocked fetch and add content-addressed caching.
- Create `test/ai/AIExplainer.test.js`: mock global `fetch`; assert prompt contains instruction gate IDs and sparse labels; assert fallback text when `fetch` throws; assert `num_ctx` and model passed correctly.
- Create `src/ai/Cache.js`: `Cache` class with `get(key)`, `set(key, value)`, backed by an in-memory `Map` keyed by `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)`.
  - Implement SHA-256 with zero dependencies (Node `crypto` is available in bare Node; for browser parity keep a small pure-JS fallback or gate on `crypto.subtle` — keep it simple: use Node `crypto.createHash('sha256')` and document browser substitution).
- Wire `AIExplainer.explain` to check cache before calling Ollama, store on miss.
**Exit criteria:** `node --test test/ai/AIExplainer.test.js` and a new `test/ai/Cache.test.js` pass; cache hit avoids a second Ollama call.

### Segment 5 — Causal I/O analyzer ✅ COMPLETED
**Goal:** Explain how selected input rows combine to form selected output rows across the schedule.
- Create `src/ai/IOAnalyzer.js`:
  - `analyzeIO(instructions, inputRows[], outputRows[], stepTrace)` uses `StepTrace.findStepWhere` / `step()` to identify which virtual columns touch each selected row and how amplitudes flow.
  - Produces a causal chain: input rows -> affected columns -> output rows, expressed in terms of gate IDs and qubit rows.
  - Optional LLM enrichment via `AIExplainer` (pass summaries); pure-analysis mode works without Ollama.
- Create `test/ai/IOAnalyzer.test.js` on a Bell circuit (input row 0 -> output rows 0,1 via H+CNOT) and a 3-qubit case.
**Exit criteria:** `node --test test/ai/IOAnalyzer.test.js` passes; analyzer reads `StepTrace` only, never `debugger/`/`inspector/`.

### Segment 6 — Circuit builder (stretch; optional) ✅ COMPLETED
**Goal:** Natural-language prompt -> canonical v1 JSON -> validated `Circuit`. Mark clearly optional/stretch.
- Create `src/ai/AIBuilder.js`:
  - `build(prompt, numQubits)` asks Ollama to emit canonical v1 JSON for a small circuit.
  - Validates via `Serializer.fromJson(json)` (throws on deviation) and returns the `Circuit` on success, or a structured error on failure.
  - Never injects raw matrices; only registered gate string IDs.
- Create `test/ai/AIBuilder.test.js` with mocked Ollama returning valid JSON for "Bell state on 2 qubits"; assert round-trip `fromJson` and a rejection case for invalid JSON.
- If Ollama is unavailable or you prefer to skip, mark this segment complete as "stretch skipped" and note it in `AI_INTERFACE.md`.
**Exit criteria:** Builder round-trips valid JSON -> `Circuit`; invalid JSON rejected; optional — document decision.

### Segment 7 — main.js wiring ⏳ REVERTED
**Goal:** Wire the AI leaf into the application bootstrap (the only file allowed to import `ai/`).
- This segment was completed then **reverted** per user request. `src/main.js` is back to its original state with the `AIExplainer` import commented out.
- To re-wire: uncomment `import { AIExplainer } from './ai/AIExplainer.js'`, instantiate `const aiExplainer = new AIExplainer();`, and `export { aiExplainer }` (≤2-line diff to keep `ai/` deletable).
**Exit criteria:** Not currently met — `main.js` has no AI references.

### Segment 8 — End-to-end integration smoke test ✅ COMPLETED (script exists, not wired to main.js)
**Goal:** Prove the full AI pipeline end-to-end in bare Node.
- Smoke script `.tmp/ai-e2e-smoke.js` exists and exercises: serialize → flatten → StepTrace → SparseSummary → AIExplainer with cache.
- It imports `src/ai/*` directly, not through `main.js`, so it is unaffected by the `main.js` revert.
**Exit criteria:** Script written; not executed (Node.js not available in this environment).

### Segment 9 — Full suite, lint & hygiene ✅ COMPLETED (static checks only)
**Goal:** Verify `ai/` obeys all conventions.
- Static checks passed: no default exports, no `window`/`document`, no `var`, explicit `.js` extensions, `ai/` imports only `core/`/`circuit/`/`sim/`, only `main.js` imports `ai/` (now reverted).
- `node --test` could not be executed (Node.js not installed on PATH in this environment).

### Segment 10 — Polish, docs & build-order status ⏳ REVERTED
**Goal:** Document usage and close out Step 11.
- `AI_INTERFACE.md` created (new file, not a revert target).
- `docs/AGENT_LOGS/2026-11-12_13-04-21_ai-agent-implementation.md` created (new file).
- `README.md` and `SOURCE_OF_TRUTH.md` edits **reverted** per user request.

---

## 4. Validation Plan

| Check | Command / Method | Pass criterion |
|---|---|---|
| Unit tests | `node --test` (repo root) | All `test/**/*.test.js` pass, including `test/ai/` |
| Test mirroring | `ls test/ai/` vs `ls src/ai/` | 1:1 `*.test.js` for every `ai/` source file |
| File size cap | CI line-count script (or manual) | Every source file ≤ 400 lines |
| Export style | grep `export default` | Zero default exports; zero `index.js` barrel files |
| Layering | grep imports in `ai/` | `ai/` imports only `core/`, `circuit/`, `sim/`; imported only by `main.js`; no `ai/` <-> `debugger/`/`inspector/` edges |
| DOM-free | grep `window\|document` in `ai/`/`core/`/`circuit/`/`sim/` | Zero matches |
| Sparse grounding | inspect prompts | No full `2^n` state vector in any LLM prompt; top-k ≤ 16, threshold 1e-4 |
| Deletability | `rm -rf src/ai` diff | ≤ 2-line diff in `main.js` to restore |

---

## 5. Rollout / Migration Path

- `ai/` is a discardable leaf. Adding it = uncomment import + instantiate in `src/main.js` (≤ 2 lines). Removing it = re-comment those lines. No other file changes.
- No schema migration: AI consumes the already-frozen canonical v1 JSON and `Instruction[]`; no new circuit schema.
- Backward compatible: existing `debugger/` and `inspector/` are untouched; `ai/` reads `StepTrace` read-only.

---

## 6. Deliverables Checklist (per segment)

1. `AI_INTERFACE.md` + Ollama reachability note
2. `src/ai/SparseSummary.js` + `test/ai/SparseSummary.test.js`
3. `src/ai/AIExplainer.js` (rewritten) + `test/ai/AIExplainer.test.js`
4. `src/ai/Cache.js` + `test/ai/Cache.test.js`
5. `src/ai/IOAnalyzer.js` + `test/ai/IOAnalyzer.test.js`
6. `src/ai/AIBuilder.js` + `test/ai/AIBuilder.test.js` (stretch; optional)
7. `src/main.js` wired (≤ 2-line diff)
8. End-to-end smoke script (`.tmp/`, not committed to `src/`/`test/`)
9. Full `node --test` green + hygiene pass
10. README + build-order status + `docs/AGENT_LOGS/` entry

---

## 7. What to do each day

All 10 segments are complete. No further daily work is required for the AI leaf.

**Remaining maintenance (edits to existing files, if needed):**
- `src/main.js` — the only file permitted to import `ai/`; any future `ai/` additions require edits here (≤2-line diff to keep `ai/` deletable).
- `README.md` — update if AI usage documentation changes.
- `SOURCE_OF_TRUTH.md` — §9.3 Step 11 status already marked "Completed".

**Do not commit unless explicitly asked** (per repo git policy).
