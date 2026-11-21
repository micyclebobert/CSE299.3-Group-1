Title: AI Builder and I/O Analyzer UI components (Wave 4, task J-a)

Summary:
Created DOM-free UI state machines for the AI Builder and I/O Analyzer under
src/ai/, wired exclusively through callbacks so they can be integrated into
index.html/AppController later without editing those files.

- src/ai/AIBuilderUI.js (class AIBuilderUI): prompt input, numQubits, build
  status (idle/building/ok/error), generated JSON, resulting Circuit, plus
  cache hit/miss and SHA-256 cache key. Calls AIBuilder.build (Ollama ->
  Serializer.fromJson). Callbacks: onChange, onBuildStart, onBuildOk,
  onBuildError, onCacheHit, onCacheMiss. Methods: setPrompt, setNumQubits,
  build, getStateSnapshot, clearCache, reset.
- src/ai/IOAnalyzerUI.js (class IOAnalyzerUI): input/output row selectors,
  causal chain (columns touched, input-affected, output-affected), summary
  text, sparse Top-k state grounding (topK basis states + per-qubit rho00 and
  linear entropy S_L via SparseSummary), cache hit/miss/key. Calls
  IOAnalyzer.analyzeIO. Callbacks: onChange, onInputRowsChange,
  onOutputRowsChange, onAnalyzeStart, onAnalyzeOk, onAnalyzeError,
  onCacheHit, onCacheMiss. Methods: setInputRows, setOutputRows,
  setNumQubits, setStateVector, analyze, getStateSnapshot, clearCache, reset.
- test/ai/AIBuilderUI.test.js and test/ai/IOAnalyzerUI.test.js: mirror tests
  mocking fetch (Ollama) and StepTrace; no DOM, no network, no LLM.

All modules are DOM-free, use named exports with explicit .js imports, const by
default, no module-level mutable state, and are under 400 lines.

Verification: `node --test "test/ai/*.test.js"` -> 61 tests, 8 suites, all pass.
`node --input-type=module --check` on both new modules -> OK.
