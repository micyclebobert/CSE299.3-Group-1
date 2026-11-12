# W4 Learning Log — Shihab Sharar

## Summary of Changes Made (AI Agent for SimQC)

During W4, I worked on building the `ai/` discardable feature leaf for SimQC — the quantum circuit simulator project. This is build Step 11 of the 11-step build order, marked as "Built Strictly Last" per `SOURCE_OF_TRUTH.md §8`.

### Context Before W4 Work
- The `ai/` folder contained only a 13-line stub: `src/ai/AIExplainer.js` with a placeholder `explain()` method returning a count string.
- `src/main.js` had the AI import commented out (line 51).
- No `test/ai/` directory existed. No `AI_INTERFACE.md`. No caching, no Ollama integration.
- All AI dependencies were already built and frozen: `Serializer.js` (canonical v1 JSON), `Flatten.js` (Instruction[] + scheduleColumns), `StepTrace.js` (tiered step trace), and canonical algorithms (`dj.js`, `grover.js`, `qft.js`, `shor.js`).

### New Files Created

1. **`src/ai/AIExplainer.js`** — Replaced the stub with a full explainer that:
   - Builds a pedagogical prompt from flattened `Instruction[]` + Sparse Top-k state summaries.
   - Calls Ollama `POST /api/chat` with model `qwen2.5:3b`, `num_ctx 4096`, `stream: false`.
   - Falls back to a deterministic template explanation when Ollama is unreachable or errors.
   - Integrates with `Cache` for content-addressed explanation caching.
   - Exported class `AIExplainer` (primary export matching filename). DOM-free, bare-Node compatible.

2. **`src/ai/SparseSummary.js`** — Pure JS sparse Top-k state summarizer:
   - `sparseSummary(state, k=16, probThreshold=1e-4)` returns `{ topK, marginals }`.
   - Top-k basis states with probability > 1e-4, formatted in big-endian ket labels `|q_{n-1}...q_0>`.
   - Per-qubit marginal `rho00(q)` and linear entropy `S_L(q)` via stride-2^q iteration over split `re`/`im` buffers.
   - Never serializes the full `2^n` state vector into an LLM prompt (sparse grounding per `AI_INTERFACE.md §3`).
   - Exported class `SparseSummary`.

3. **`src/ai/Cache.js`** — Content-addressed explanation cache:
   - In-memory `Map` keyed by `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)`.
   - Pure-JS SHA-256 implementation (no Node `crypto` dependency, dual-runtime compatible).
   - Exported class `Cache` with `get(key)`, `set(key, value)`, `has(key)`, `static computeKey(...)`.

4. **`src/ai/IOAnalyzer.js`** — Causal input/output analyzer:
   - `analyzeIO(instructions, inputRows[], outputRows[], stepTrace)` identifies which virtual columns touch selected input/output rows.
   - Produces input-affected/output-affected column lists and a causal chain of gate descriptors.
   - Optional LLM enrichment via `AIExplainer`; pure-analysis mode works without Ollama.
   - Reads `StepTrace` only; never imports `debugger/` or `inspector/`.
   - Exported class `IOAnalyzer`.

5. **`src/ai/AIBuilder.js`** — Stretch capability (optional, marked Proposed/Non-Guaranteed):
   - `build(prompt, numQubits)` asks Ollama to emit canonical v1 JSON, validates via `Serializer.fromJson(json)`, returns `Circuit` on success or structured error on failure.
   - Never injects raw matrices; only registered gate string IDs.
   - Exported class `AIBuilder`.

6. **`test/ai/SparseSummary.test.js`** — Unit tests: all-zero state, Bell state (top-2 terms |00⟩, |11⟩), GHZ state (marginals rho00=0.5, S_L=0.5), phase capture, threshold filtering, top-k cap, big-endian ket label reversal.

7. **`test/ai/AIExplainer.test.js`** — Unit tests with mocked `fetch`: Ollama success, custom model, fallback on connection refused, fallback on non-2xx, empty circuit, TypeError on non-array, cache hit (no fetch call), cache stores successful response.

8. **`test/ai/Cache.test.js`** — Unit tests: known SHA-256 vectors (empty string, "abc", "hello world"), deterministic keys including schema/prompt version, 64-char hex format, set/get/has round-trip, overwrite, independent instances.

9. **`test/ai/IOAnalyzer.test.js`** — Unit tests: Bell circuit input row 0 → output rows 0,1 via H+CNOT, same-column gate grouping, no shared columns, respects StepTrace changed steps, descriptive causal chain strings, empty instructions.

10. **`test/ai/AIBuilder.test.js`** — Unit tests with mocked `fetch`: valid model JSON → Circuit, Ollama unavailable error, non-JSON output error, validation failure error, markdown code fence extraction, empty prompt rejection, invalid numQubits rejection, options.model passthrough.

11. **`AI_INTERFACE.md`** — Normative AI I/O contract documenting scope, runtime stack (Ollama localhost:11434), sparse Top-k grounding, data contracts (SparseSummary output, Instruction input, explain input/output), cache key format, error/fallback behavior, testing conventions, deletability rule.

12. **`.tmp/ollama-smoke.js`** — Ephemeral smoke script verifying Ollama reachability on `localhost:11434`.

13. **`.tmp/ai-e2e-smoke.js`** — End-to-end smoke script: build Bell circuit → serialize → flatten → StepTrace → SparseSummary → AIExplainer with cache.

14. **`docs/AGENT_LOGS/2026-11-12_13-04-21_ai-agent-implementation.md`** — Agent log summarizing the AI implementation.

### Existing Files Edited (Then Reverted)

Per user request, all edits to previously existing non-AI files were reverted:
- `src/main.js` — Reverted: AI import commented out, no `aiExplainer` instantiation/export.
- `README.md` — Reverted: status table back to `| Explainer AI and builder AI | Proposed feature | ⬜ Planned |`.
- `SOURCE_OF_TRUTH.md` — Reverted: Step 11 status back to `Planned`.

### Constraints Obeyed
- Leaf isolation: `ai/` imported only by `main.js`; zero imports between `ai/` and `debugger/`/`inspector/`; `ai/` imports only `core/`, `circuit/`, `sim/` (`StepTrace`).
- DOM-free: runs unmodified in bare Node.js; no `window`/`document`.
- File hygiene: max 400 lines per file, named exports only, no default exports, no barrel files, explicit `.js` extensions, `const` by default, no `var`, no license headers, no Closure JSDoc.
- Sparse grounding: no full `2^n` vector in LLM prompts; top-k ≤ 16, threshold 1e-4.
- Cache key: `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)`.
- Deletable: removing `ai/` requires ≤2-line diff in `main.js`.

## Plan for Continuing Work

### Immediate Next Step: Re-wire `src/main.js`
The `ai/` leaf is fully implemented but not yet wired into the application. To activate it:
1. Uncomment `import { AIExplainer } from './ai/AIExplainer.js';` in `src/main.js`.
2. Add `const aiExplainer = new AIExplainer();` after `seal();`.
3. Add `export { aiExplainer };`.
This is a ≤2-line diff, keeping `ai/` trivially deletable per the leaf isolation rule.

### Run the Test Suite
Execute `node --test` from the repo root to confirm all tests pass, including the new `test/ai/` mirror tests. Node.js was not available in the W4 environment, so this could not be executed.

### Optional: Re-edit Documentation
If desired, re-apply the documentation edits that were reverted:
- `README.md`: Mark Explainer AI as ✅ Done, keep Builder AI as ⬜ Planned (stretch).
- `SOURCE_OF_TRUTH.md §9.3`: Mark Step 11 status as "Completed".

### Future Work Beyond W4
- **UI integration**: Connect `AIExplainer` to the right panel / AI assistant interface in `canvas/`/`ui/` so users can trigger explanations from the circuit editor.
- **Builder UX**: Wire `AIBuilder` into a natural-language input field that produces a `Circuit` and inserts it into the editor grid.
- **Ollama deployment**: Ensure Ollama is running on the target deployment machine with `qwen2.5:3b` pulled and `num_ctx > 2048`; set `OLLAMA_ORIGINS` for browser CORS during development.
- **Phase-5 Colab teacher**: Use `qwen2.5:14b` on Google Colab with the simulator core as a ground-truth labeling oracle to generate synthetic fine-tuning pairs for LoRA/QLoRA adaptation (per `SOURCE_OF_TRUTH §8.3`).
- **Cache persistence**: Extend the in-memory `Cache` to disk-backed persistence so explanations survive page reloads.

### Git Policy
Do not commit unless explicitly asked. Conventional commit style matching repo history when committing.