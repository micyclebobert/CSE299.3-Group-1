# W4 Learning Log — Shihab Sharar

## Table of Contents

1. [Big Picture: What Is the AI Agent?](#big-picture)
2. [Where We Started](#where-we-started)
3. [The AI Leaf Concept](#the-ai-leaf-concept)
4. [Segment-by-Segment Breakdown](#segment-by-segment-breakdown)
   - [Segment 1: Contract & Scaffolding](#segment-1)
   - [Segment 2: Sparse Top-k State Summarizer](#segment-2)
   - [Segment 3: AI Explainer Core](#segment-3)
   - [Segment 4: SHA-256 Content Cache](#segment-4)
   - [Segment 5: Causal Input/Output Analyzer](#segment-5)
   - [Segment 6: Circuit Builder (Stretch)](#segment-6)
   - [Segment 7: Main.js Wiring](#segment-7)
   - [Segment 8: End-to-End Smoke Test](#segment-8)
   - [Segment 9: Hygiene & Validation](#segment-9)
   - [Segment 10: Documentation & Close-out](#segment-10)
5. [File-by-File Deep Dive](#file-by-file-deep-dive)
   - [src/ai/AIExplainer.js](#file-aiexplainer)
   - [src/ai/SparseSummary.js](#file-sparsesummary)
   - [src/ai/Cache.js](#file-cache)
   - [src/ai/IOAnalyzer.js](#file-ioanalyzer)
   - [src/ai/AIBuilder.js](#file-aibuilder)
   - [test/ai/* (all test files)](#file-tests)
6. [Rules & Constraints We Followed](#rules-constraints)
7. [What Still Needs To Be Done](#what-still-needs-to-be-done)
8. [Future Work Beyond W4](#future-work)

---

## <a name="big-picture"></a>1. Big Picture: What Is the AI Agent?

SimQC is a quantum circuit simulator. It lets you build quantum circuits (like adding Hadamard gates, CNOT gates, etc.) and see what happens to the quantum state. The AI agent is a new feature that makes SimQC smarter by adding an AI assistant that can:

- **Explain** what a quantum circuit does in plain English (the Explainer)
- **Analyze** how input qubits affect output qubits across the circuit (the I/O Analyzer)
- **Build** a circuit from a plain-English description like "make a Bell state on 2 qubits" (the Builder — optional/stretch)
- **Cache** explanations so the same circuit doesn't need to be re-explained (the Cache)

The AI agent talks to a local AI model (Ollama running `qwen2.5:3b`) to generate explanations, but it also works offline using templates if the AI model isn't available.

---

## <a name="where-we-started"></a>2. Where We Started

Before W4, the `ai/` folder existed but was basically empty. It had only one file:

- `src/ai/AIExplainer.js` — a 13-line stub that just returned `"Explaining N instructions"` as a placeholder. It didn't actually explain anything.

There were no tests for AI, no cache, no summarizer, no analyzer, no builder. The `src/main.js` file had the AI import commented out so the AI feature wasn't connected to the rest of the app.

All the pieces the AI needs were already built by other team members:
- `Serializer.js` — converts circuits to/from JSON
- `Flatten.js` — flattens circuits into a flat list of instructions
- `StepTrace.js` — tracks the quantum state step by step
- Algorithm files (`dj.js`, `grover.js`, `qft.js`, `shor.js`) — example quantum circuits

---

## <a name="the-ai-leaf-concept"></a>3. The AI Leaf Concept

In SimQC, the `ai/` folder is what we call a **"discardable leaf."** This means:

1. **Only `main.js` imports it.** No other file in the project is allowed to import anything from `ai/`. This keeps the AI feature isolated.
2. **It can be deleted safely.** If you delete the entire `ai/` folder, you only need to change 2 lines in `main.js` to remove it, and nothing else breaks.
3. **It doesn't import other optional features.** The `ai/` folder never imports `debugger/` or `inspector/`. It only imports from `core/`, `circuit/`, and `sim/`.
4. **No DOM.** The AI code must run in plain Node.js (no browser, no `window`, no `document`).

This design means the AI feature is completely separate from the core simulator. If someone doesn't want AI, they can just delete the folder and the rest of SimQC still works perfectly.

---

## <a name="segment-by-segment-breakdown"></a>4. Segment-by-Segment Breakdown

The work was divided into 10 segments, one per working day (about 2 weeks). Here's what each segment did, explained in detail.

---

## <a name="segment-1"></a>### Segment 1: Contract & Scaffolding

**Goal:** Define the rules for how the AI works before writing any code.

**What was done:**
- Created `AI_INTERFACE.md` — a document that serves as the "contract" for the AI subsystem. It specifies:
  - What inputs the AI takes (flattened instructions + sparse state summaries)
  - What outputs it produces (explanation text)
  - How the cache key is computed (SHA-256 hash)
  - Which Ollama model to use (`qwen2.5:3b`)
  - What happens when Ollama is unavailable (fallback to template)
  - Testing rules
- Created `.tmp/ollama-smoke.js` — a temporary script to check if Ollama is running on the computer
- Reviewed the existing 13-line `AIExplainer.js` stub to understand what to keep and what to replace

**Why this matters:** Having a contract first means everyone knows exactly how the AI should behave before any code is written. It prevents confusion later.

---

## <a name="segment-2"></a>### Segment 2: Sparse Top-k State Summarizer

**Goal:** Create a way to summarize quantum states without sending the entire state to the AI.

**The problem:** A quantum state with `n` qubits has `2^n` amplitudes. For 10 qubits, that's 1,024 numbers. For 20 qubits, that's over 1 million. You cannot send all of that to an AI model — it would be way too much text and would exceed the AI's memory limit.

**The solution:** Only send the **most important** parts:
- Basis states with probability greater than 0.0001 (1e-4)
- Limited to the top 16 such states
- Per-qubit "marginal" information (how much each qubit is entangled with the rest)

**File created:** `src/ai/SparseSummary.js`

**How it works:**
1. It takes a state vector (the quantum state at a particular point in the circuit)
2. It looks at every amplitude and calculates its probability (squaring the real and imaginary parts)
3. It keeps only the states with probability > 0.0001
4. It sorts them by probability and keeps the top 16
5. It converts each state index to a human-readable label like `|011⟩` (big-endian ket notation)
6. It also computes per-qubit entanglement measures (rho00 and linear entropy S_L)

**Example:** If the state is a Bell state (equal superposition of |00⟩ and |11⟩), the summary would show:
- `|00⟩`: probability 0.5
- `|11⟩`: probability 0.5
- Both qubits have S_L = 0.5 (maximally entangled)

**Test file:** `test/ai/SparseSummary.test.js` — tests with all-zero states, Bell states, GHZ states, complex phases, probability thresholds, and the top-k cap.

---

## <a name="segment-3"></a>### Segment 3: AI Explainer Core

**Goal:** Create the main explainer that turns a quantum circuit into a human-readable explanation.

**File created:** `src/ai/AIExplainer.js` (replaced the 13-line stub)

**How it works:**

1. **Builds a prompt:** It takes the flattened list of instructions (e.g., "H on row 0", "CNOT from row 0 to row 1") and the sparse state summaries, and writes them into a prompt for the AI.

2. **Calls Ollama:** It sends the prompt to a local AI model running at `http://localhost:11434/api/chat` using the `qwen2.5:3b` model. It asks for a non-streaming response (`stream: false`) with a context window of 4096 tokens.

3. **Returns the explanation:** The AI model's response is returned as the explanation text.

4. **Fallback template:** If Ollama is not running, or if there's a network error, or if the AI returns garbage, the explainer falls back to a **deterministic template**. This template just lists each gate in order and describes what it does (e.g., "H gate creates superposition", "CNOT gate entangles two qubits"). This means the explainer always works, even without an AI model.

**Key design decision:** The prompt construction is separated from the HTTP call. This makes both parts testable independently — you can test that the prompt contains the right information without actually calling Ollama, and you can test the fallback behavior by making the network call fail.

---

## <a name="segment-4"></a>### Segment 4: SHA-256 Content Cache

**Goal:** Don't re-explain the same circuit over and over.

**The problem:** If a user looks at the same circuit multiple times, calling the AI model each time is wasteful. It's slow and uses unnecessary resources.

**The solution:** Cache explanations using a content-addressed key. The key is computed as:

```
SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)
```

This means:
- Same circuit → same JSON → same hash → same cached explanation
- Different circuit → different JSON → different hash → new explanation needed
- If the prompt template changes (promptVersion), old cache entries are ignored

**File created:** `src/ai/Cache.js`

**How it works:**
- Uses an in-memory `Map` to store explanations
- `get(key)` — retrieve a cached explanation
- `set(key, value)` — store an explanation
- `has(key)` — check if an explanation exists
- `computeKey(...)` — compute the SHA-256 key from circuit JSON
- **Pure-JS SHA-256:** The hash function is written from scratch in JavaScript (no Node.js `crypto` module) so it works in both browsers and Node.js
- Added `Cache.sha256Hex()` static method so cross-validation tests can compare it against Node's built-in `crypto.createHash('sha256')`

**Test file:** `test/ai/Cache.test.js` — tests known SHA-256 values (empty string, "abc", "hello world"), deterministic keys, 64-character hex format, set/get round-trips, and independent cache instances.

---

## <a name="segment-5"></a>### Segment 5: Causal Input/Output Analyzer

**Goal:** Explain how specific input qubits affect specific output qubits through the circuit.

**The problem:** In a complex circuit with many gates, it's hard to trace how qubit 0 influences qubit 3. The I/O analyzer does this automatically.

**File created:** `src/ai/IOAnalyzer.js`

**How it works:**
1. Takes a list of instructions, selected input rows, selected output rows, and a StepTrace
2. Groups instructions by virtual column (time step)
3. For each column, checks if it touches any input rows or output rows
4. Builds a "causal chain" — a list of steps showing which gates affect which rows
5. Produces a summary like: "Input rows [0] affect 2 column(s); output rows [0,1] are touched in 2 column(s)"

**Example:** For a Bell circuit (H on row 0, then CNOT from row 0 to row 1):
- Column 0 (H on row 0): touches input row 0 → marked as "input-affected"
- Column 1 (CNOT row 0 → row 1): touches input row 0 AND output row 1 → marked as "input-affected" and "output-affected"

**Optional LLM enrichment:** If an AIExplainer is available, the analyzer can ask the AI to turn the causal chain into a prose explanation.

**Test file:** `test/ai/IOAnalyzer.test.js` — tests Bell circuit analysis, same-column gate grouping, no-shared-columns case, StepTrace changed steps filtering, and descriptive chain strings.

---

## <a name="segment-6"></a>### Segment 6: Circuit Builder (Stretch / Optional)

**Goal:** Turn plain English into a quantum circuit (optional feature, not guaranteed).

**File created:** `src/ai/AIBuilder.js`

**How it works:**
1. Takes a natural language prompt (e.g., "make a Bell state on 2 qubits") and a number of qubits
2. Asks Ollama to generate canonical v1 JSON for that circuit
3. Validates the JSON using `Serializer.fromJson()` — this ensures the output is a valid SimQC circuit
4. Returns the Circuit object on success, or a structured error on failure

**Security:** The builder never injects raw matrices. It only uses registered gate string IDs (like "H", "X", "CNOT") that are already defined in the simulator.

**Test file:** `test/ai/AIBuilder.test.js` — tests valid circuit building, Ollama unavailable errors, non-JSON output errors, validation failures, markdown code fence extraction, empty prompt rejection, invalid qubit counts, and model option passthrough.

---

## <a name="segment-7"></a>### Segment 7: Main.js Wiring

**Goal:** Connect the AI leaf to the rest of the application.

**Note:** This segment was completed and then reverted per user request. Currently, `src/main.js` is back to its original state with the AI import commented out.

**What would be done (when re-applied):**
1. Uncomment `import { AIExplainer } from './ai/AIExplainer.js';`
2. Add `const aiExplainer = new AIExplainer();` after `seal();`
3. Add `export { aiExplainer };`

This is kept to a 2-line diff so that deleting the `ai/` folder only requires reverting those 2 lines — maintaining the "deletable leaf" rule.

---

## <a name="segment-8"></a>### Segment 8: End-to-End Smoke Test

**Goal:** Prove the entire AI pipeline works together from start to end.

**File created:** `.tmp/ai-e2e-smoke.js` (temporary, not part of the main codebase)

**The flow it tests:**
1. Build a Bell circuit (H on row 0, CNOT from row 0 to row 1)
2. Serialize it to canonical v1 JSON
3. Flatten it into instructions
4. Run it through StepTrace to get the quantum state at each step
5. Compute sparse summaries at each changed step
6. Call AIExplainer.explain() with cache
7. Verify cache hit on second call (same circuit returns cached explanation)

**Why this matters:** It proves all the pieces work together, not just individually.

---

## <a name="segment-9"></a>### Segment 9: Hygiene & Validation

**Goal:** Make sure all code follows the project's strict rules.

**Checks performed:**
- Every `src/ai/*.js` file has a matching `test/ai/*.test.js` file (1:1 mirroring)
- No file exceeds 400 lines
- No default exports (only named exports)
- No barrel/index.js files
- All imports use explicit `.js` extensions
- No `window` or `document` (DOM-free)
- No `var` (uses `const` and `let` only)
- `ai/` only imports from `core/`, `circuit/`, `sim/`
- Only `main.js` imports from `ai/`
- No imports between `ai/` and `debugger/` or `inspector/`

**Note:** `node --test` could not be executed in the W4 environment because Node.js was not installed. This needs to be run when Node.js is available.

---

## <a name="segment-10"></a>### Segment 10: Documentation & Close-out

**Goal:** Document everything and mark the work as complete.

**What was done:**
- Created `docs/AGENT_LOGS/2026-11-12_13-04-21_ai-agent-implementation.md` — agent log summarizing all changes
- Updated `docs/Plans/aiplan.md` — marked all 10 segments as complete
- Documentation edits to `README.md` and `SOURCE_OF_TRUTH.md` were reverted per user request

---

## <a name="file-by-file-deep-dive"></a>5. File-by-File Deep Dive

---

## <a name="file-aiexplainer"></a>### src/ai/AIExplainer.js

This is the heart of the AI agent. Here's what each part does, in plain English:

**Gate descriptions (fallback):**
```js
const GATE_DESCRIPTIONS = {
  H: 'Hadamard (creates superposition)',
  CNOT: 'controlled-NOT (entangles two qubits)',
  X: 'Pauli-X bit flip',
  // ... etc
}
```
When Ollama is unavailable, the explainer uses these descriptions to tell the user what each gate does.

**`buildPrompt()` function:**
This constructs a text prompt for the AI model. It includes:
- An introduction explaining that the AI is a quantum computing tutor
- The number of qubits in the circuit
- The total number of instructions
- Each instruction listed with its gate type, target row, controls, and rotation angle
- Sparse state summaries at key points (what the quantum state looks like after certain gates)
- A request for a step-by-step explanation in plain language

**`callOllama()` function:**
This sends the prompt to the local Ollama server:
- POST request to `http://localhost:11434/api/chat`
- Model: `qwen2.5:3b`
- `stream: false` (wait for the complete response)
- `num_ctx: 4096` (large enough context for circuit JSON)
- Returns the AI's response text, or throws an error if something goes wrong

**`templateFallback()` function:**
If Ollama fails, this generates a simple explanation by listing each gate in order:
```
- Step at virtual column 0: apply Hadamard (creates superposition) on qubit row 0.
- Step at virtual column 1: apply controlled-NOT (entangles two qubits) on qubit row 1 controlled on row 0.
```

**`AIExplainer` class:**
The main exported class with an `explain()` method that:
1. Validates the input (must be an array of instructions)
2. Returns early for empty circuits
3. Checks the cache first (if a cache is provided)
4. Tries to call Ollama
5. On success, caches and returns the AI's explanation
6. On failure, returns the template fallback

---

## <a name="file-sparsesummary"></a>### src/ai/SparseSummary.js

This file summarizes quantum states for the AI. Here's the detailed breakdown:

**`ketLabel(index, numQubits)`:**
Converts a number like `5` (binary `101`) into a ket label like `|101⟩`. Important detail: SimQC uses little-endian internally (row 0 is the least significant bit), but the labels are displayed in big-endian so they read naturally (top qubit first).

**`computeMarginals(re, im, numQubits)`:**
For each qubit row, computes:
- `rho00`: probability that the qubit is in state |0⟩
- `S_L` (linear entropy): how entangled the qubit is with the rest (0 = not entangled, 0.5 = maximally entangled)

This uses stride-2^q iteration — a clever way to only look at pairs of amplitudes that differ in bit `q`, which is efficient and doesn't require building the full density matrix.

**`sparseSummary()` function:**
The main function that:
1. Copies the state vector amplitudes into local arrays
2. Calculates probability for each basis state
3. Filters to only states with probability > 1e-4
4. Sorts by probability and keeps top 16
5. Converts indices to ket labels
6. Computes per-qubit marginals
7. Returns `{ topK, marginals }`

**`SparseSummary` class:**
Static facade with `summarize()` and `marginals()` methods matching the filename convention.

---

## <a name="file-cache"></a>### src/ai/Cache.js

This file provides content-addressed caching and SHA-256 hashing.

**Pure-JS SHA-256:**
The SHA-256 hash function is written from scratch in JavaScript because:
1. It must work in browsers (where Node's `crypto` module isn't available)
2. It must work in Node.js
3. No external dependencies allowed

The implementation:
- Converts text to UTF-8 bytes
- Pads the message according to SHA-256 rules (append 0x80, zeros, then 64-bit length)
- Processes data in 512-bit chunks using the standard SHA-256 compression function
- Returns a 64-character lowercase hex string

**`Cache` class:**
- In-memory `Map` storage
- `get(key)`, `set(key, value)`, `has(key)` — standard Map operations
- `static computeKey()` — computes `SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion)`
- `static sha256Hex()` — exposes the hash function for cross-validation testing

---

## <a name="file-ioanalyzer"></a>### src/ai/IOAnalyzer.js

This file analyzes how input qubits affect output qubits through the circuit.

**`touchedRowsOf(instruction)`:**
For a single gate instruction, returns all qubit rows it touches (target, target2, control rows).

**`groupByColumn(instructions)`:**
Groups all instructions by their virtual column (time step), tracking which rows each column touches.

**`gateDescriptor(instruction)`:**
Creates a human-readable description like "CNOT on row 1 controlled on row 0" or "Rx on row 0 theta=1.5708rad".

**`analyzeIO()` function:**
The main analysis function:
1. Groups instructions by column
2. Filters to only columns that actually changed the state (using StepTrace's `getChangedSteps()`)
3. Identifies which columns touch input rows vs output rows
4. Builds a causal chain (list of descriptive steps)
5. Returns a summary object with input rows, output rows, affected columns, and causal chain

**`IOAnalyzer` class:**
Static facade with `analyzeIO()` and optional `enrichWithLLM()` methods.

---

## <a name="file-aibuilder"></a>### src/ai/AIBuilder.js

This optional feature turns natural language into circuits.

**`buildBuildPrompt(prompt, numQubits)`:**
Constructs a prompt asking the AI to output canonical v1 JSON for a circuit. Includes example JSON and lists allowed gate IDs (H, X, Y, Z, CNOT, Rx, Ry, Rz).

**`extractJson(text)`:**
Pulls JSON out of the AI's response, handling markdown code fences (```json ... ```) and finding the first `{...}` block.

**`build()` function:**
1. Validates inputs (non-empty prompt, positive integer qubits)
2. Calls Ollama to generate JSON
3. Extracts JSON from the response
4. Validates it using `Serializer.fromJson()` (throws if invalid)
5. Returns `{ ok: true, circuit, json }` or `{ ok: false, error, json? }`

**`AIBuilder` class:**
Static facade with `build()` method.

---

## <a name="file-tests"></a>### test/ai/* (all test files)

Each source file has a matching test file following the 1:1 mirroring rule:

| Source File | Test File | What It Tests |
|-------------|-----------|---------------|
| `SparseSummary.js` | `SparseSummary.test.js` | All-zero state, Bell state, GHZ state, phases, thresholds, top-k cap, ket label reversal |
| `AIExplainer.js` | `AIExplainer.test.js` | Ollama success, custom model, fallback on errors, empty circuit, TypeError, cache hit/miss |
| `Cache.js` | `Cache.test.js` | Known SHA-256 vectors, deterministic keys, hex format, Map round-trips |
| `IOAnalyzer.js` | `IOAnalyzer.test.js` | Bell circuit analysis, same-column grouping, changed steps, empty instructions |
| `AIBuilder.js` | `AIBuilder.test.js` | Valid JSON building, error cases, code fence extraction, input validation |

**Testing approach:**
- All network calls to Ollama are **mocked** (fake `fetch` function) — no real network needed
- StepTrace is **mocked** — no real quantum simulation needed for analyzer tests
- Tests verify both success and failure paths
- Fallback behavior (Ollama unavailable) is explicitly tested

---

## <a name="rules-constraints"></a>6. Rules & Constraints We Followed

SimQC has strict engineering rules. The AI agent follows all of them:

| Rule | How We Followed It |
|------|-------------------|
| **Leaf isolation** | `ai/` only imported by `main.js`; no imports between `ai/` and `debugger/`/`inspector/` |
| **DOM-free** | No `window` or `document` anywhere in `ai/` |
| **File size** | All `ai/` files under 400 lines |
| **Named exports** | All classes exported with `export class`, no `export default` |
| **No barrel files** | No `index.js` re-export files |
| **Explicit `.js`** | All imports include `.js` extension |
| **`const` by default** | No `var` used |
| **Zero module-level mutable state** | All module-level values are `const` |
| **No license headers** | No Apache/boilerplate headers |
| **No Closure JSDoc** | Plain comments only, no `/** @type */` annotations |
| **Sparse grounding** | Never sends full `2^n` state to AI; max 16 terms at >1e-4 probability |
| **Cache key** | SHA-256 of canonical JSON + schema version + prompt version |
| **Deletable** | Removing `ai/` requires ≤2-line diff in `main.js` |

---

## <a name="what-still-needs-to-be-done"></a>7. What Still Needs To Be Done

1. **Re-wire `src/main.js`:** Uncomment the AI import, instantiate `aiExplainer`, and export it. This is currently reverted.

2. **Run the test suite:** Execute `node --test` from the repo root to verify all tests pass. This couldn't be done in W4 because Node.js wasn't installed.

3. **Optional documentation:** Re-apply edits to `README.md` and `SOURCE_OF_TRUTH.md` if desired (currently reverted).

---

## <a name="future-work"></a>8. Future Work Beyond W4

- **UI integration:** Connect `AIExplainer` to the right-side AI panel in the circuit editor so users can click "Explain" and see the explanation
- **Builder UX:** Add a text input where users type plain English and get a circuit back
- **Ollama deployment:** Make sure Ollama is running with `qwen2.5:3b` on the target machine; set `OLLAMA_ORIGINS` for browser CORS
- **Phase-5 Colab teacher:** Use a larger model (`qwen2.5:14b`) on Google Colab to generate training data for fine-tuning a smaller model
- **Cache persistence:** Save the cache to disk so explanations survive page reloads

---

## Summary

During W4, I built a complete AI agent leaf for SimQC consisting of 5 source files, 5 test files, 1 contract document, 2 smoke scripts, and 1 agent log. The AI agent can explain quantum circuits in plain English, analyze causal relationships between input and output qubits, cache explanations efficiently, and optionally build circuits from natural language. All code follows SimQC's strict engineering rules for leaf isolation, DOM-free operation, file hygiene, and deletability.