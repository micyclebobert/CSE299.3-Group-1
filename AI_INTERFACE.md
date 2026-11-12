# `AI_INTERFACE.md` — SimQC AI Subsystem Contract

> **Normative Status:** Governs the `ai/` discardable feature leaf (SimQC build Step 11). Supersedes any prior AI notes. If code disagrees with this file, update both in the same change.

---

## 1. Scope & Layering

`ai/` is a **discardable leaf** imported **exclusively** by `src/main.js`. It imports only `core/`, `circuit/`, and `sim/` (read-only `StepTrace`). Zero imports between `ai/` and `debugger/`/`inspector/`. `ai/` is DOM-free and runs unmodified in bare Node.js (`node --test`).

Capabilities:
1. **Circuit Explainer (committed):** Converts canonical 1D `Instruction[]` + sparse state summaries into pedagogical step-by-step explanations.
2. **Input/Output Causal Analysis (committed):** Analyzes user-selected input rows across the flattened schedule and explains how they combine to form selected output rows.
3. **Circuit Builder (stretch / non-guaranteed):** Translates natural-language prompts into canonical v1 JSON, validated via `Serializer.fromJson(json)`.
4. **Content-Addressed Cache:** Keyed on `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)`.

---

## 2. Runtime Stack

| Item | Value |
|---|---|
| Provider | Ollama REST API on `localhost:11434` |
| Default model | `qwen2.5:3b` (Q4_K_M, ~1.9 GB) |
| Quality reference | `qwen2.5-coder:7b` |
| Context window | `num_ctx > 2048` (circuit JSON prompts are large) |
| Browser CORS dev | `OLLAMA_ORIGINS` env var |
| Endpoint | `POST http://localhost:11434/api/chat` |
| Streaming | `stream: false` (single-shot completion) |

Hardware baseline (Phase 0–1 marked Complete): 16 GB system RAM, NVIDIA RTX 3050 Laptop GPU (4 GB VRAM), Intel Core i5 12th-Gen.

---

## 3. Sparse Top-k State Grounding

**Never** serialize the full `2^n` state vector into an LLM prompt. At each virtual column boundary, serialize only a **Sparse State Summary**:

1. Basis states with probability `P(i) = re[i]^2 + im[i]^2 > 1e-4`, capped at top `k = 16` terms.
2. Each term formatted in **big-endian ket notation** `|q_{n-1}...q_0>` (little-endian internal index `i` reversed for display — formatting happens in `ai/`, never in `core/`/`circuit/`/`sim/`).
3. Per-term amplitude `re[i]`, `im[i]`, and phase `atan2(im, re)`.
4. The `n`-element arrays of marginal `rho00(q)` and linear entropy `S_L(q) = 1 - gamma_q`.

This keeps prompts far below the context limit even at `n = 10` (full vector would exceed 150,000 tokens).

---

## 4. Data Contracts

### 4.1 SparseSummary output shape

```ts
{
  topK: Array<{
    label: string,       // big-endian ket, e.g. "|011>"
    index: number,       // little-endian basis index i
    probability: number, // re[i]^2 + im[i]^2
    amplitude: [re: number, im: number],
    phase: number,       // atan2(im, re) radians
  }>,
  marginals: Array<{
    row: number,         // qubit row q
    rho00: number,       // P(bit q = 0)
    sl: number,          // linear entropy S_L(q) in [0, 0.5]
  }>,
}
```

### 4.2 Instruction input shape (from `circuit/Flatten.js`)

```ts
{
  gateId: "H",
  target: 0,
  target2?: number,
  thetaRad?: number,
  controls: [{ row: number, on: boolean }],
  column: number,        // top-level editor column
  virtualColumn: number, // expanded execution column
  subcircuit?: string,   // origin breadcrumb or undefined
}
```

### 4.3 Explainer input / output

**Input:** `explain(instructions: Instruction[], summaries: SparseSummary[], options?: { model?: string })`

**Output:** `string` — pedagogical explanation text.

On Ollama success: returns the model's explanation. On Ollama failure/unreachable: returns a deterministic **template fallback** describing the gate sequence (the explainer flow must not depend on the LLM).

### 4.4 Cache key

```
SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)
```

* `canonicalJson` — `Serializer.toJson(circuit)` output (stable key order).
* `schemaVersion` — `"1"` matching `Serializer.VERSION`.
* `promptVersion` — version of the prompt template (bump when prompt construction changes).

Cache is in-memory `Map`; miss triggers an Ollama call and stores the result.

---

## 5. Error & Fallback Behavior

| Situation | Behavior |
|---|---|
| Ollama unreachable / connection refused | Template fallback explanation; no throw; log to stderr only |
| Ollama returns non-2xx or malformed JSON | Template fallback; log to stderr only |
| Malformed `Instruction[]` | `TypeError` (fail fast, no LLM call) |
| Empty instructions | Return a short "empty circuit" template |
| Cache hit | Return cached string; skip Ollama entirely |

---

## 6. Testing Conventions

* Every `src/ai/*.js` source file has a 1:1 `test/ai/*.test.js`.
* HTTP calls to Ollama are **mocked** via a stubbed global `fetch`; no network in `node --test`.
* Fallback (Ollama-down) path is tested by making `fetch` throw.
* Numerical tolerances match `CONVENTIONS.md §12`: `n <= 8` -> `1e-12`; `n > 8` -> `1e-9`.
* Untouched amplitudes: exact bit-equality via `Object.is`.

---

## 7. Deletability

Removing the `ai/` folder must require at most a 2-line diff in `src/main.js` (uncomment/re-comment the `ai/` import + instantiation). No other file references `ai/`.
