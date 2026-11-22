Title: AI Explainer per-column sparse summaries (Wave 2.5)

Summary:
Modified three source files and added tests to implement one SparseSummary per virtual column instead of one for the entire circuit, with cache identity reflecting the analyzed state.

Changes:

1. src/ai/AIExplainer.js
   - buildPrompt(): Changed summary indexing from instruction-order (summaryIdx counter) to virtual-column indexing: summaries[instr.virtualColumn] instead of summaries[summaryIdx]. Removed the summaryIdx counter variable.
   - explain(): Added options.stateIdentity to the cache key computation. When stateIdentity is provided, the cache key input becomes `${canonicalJson}|${stateIdentity}` before being hashed by Cache.computeKey, so different analyzed column sets produce different cache keys.

2. src/ui/ai-explainer-view.js
   - Replaced single-summary logic (SparseSummary.summarize(app._stepTrace.currentState)) with per-column summary generation.
   - Steps app._stepTrace to each unique virtual column boundary (reset + next() per column), captures currentState at each step, and builds summaries[vc] = SparseSummary.summarize(state).
   - Saves and restores the trace's prior step position via trace.seek(priorStep) so the debugger UI is unaffected.
   - Passes stateIdentity = JSON.stringify(virtualColumns) to explainer.explain() for cache key differentiation.

3. test/ai/AIExplainer.test.js (added 2 tests)
   - "indexes summaries by virtual column, not instruction order": verifies summaries[instr.virtualColumn] is used, with a gap at virtual column 1 proving summaries[1] is not consumed by an instruction at virtual column 2.
   - "builds one summary per virtual column with sparse array": verifies two instructions at virtual column 0 share summaries[0], and an instruction at virtual column 2 uses summaries[2].

4. test/ui/ai-explainer-view.test.js (new file, 2 tests)
   - "builds one SparseSummary per virtual column": places H gates at columns 0 and 1, triggers the explain click, and verifies summaries.length === 2 with entries at indices 0 and 1, undefined at index 2, and stateIdentity present in options.
   - "handles empty circuit": verifies empty-circuit message is shown.

Verification:
- node --input-type=module --check passes on both modified source files.
- All 859 tests pass via node --test (8 new tests added, 0 failures).
- All source files remain under the 400-line ceiling.
