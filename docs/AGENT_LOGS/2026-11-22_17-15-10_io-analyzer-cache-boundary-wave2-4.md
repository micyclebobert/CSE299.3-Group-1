Title: I/O Analyzer cache state boundary (Wave 2.4)

Summary:
- src/ai/IOAnalyzerUI.js: analyze() now includes the state boundary identity in the analysis cache key. The key is sha256(JSON({instructions, inputRows, outputRows, numQubits})|step=<stepTrace.step>|io-v1); when stepTrace is undefined or lacks a numeric step, falls back to step=none. On cache hit, the cached entry's stored stateIdentity is compared against the current boundary; on mismatch (e.g. pre-simulation entry served after simulation) the entry is skipped and analysis is recomputed. Cached entries now store stateIdentity for this verification.
- test/ai/IOAnalyzerUI.test.js: added 4 tests - cache key changes when stepTrace.step changes (same circuit), same step yields cache hit (same key), pre-simulation vs post-simulation produce different cache entries, and undefined stepTrace degrades to step=none.
- src/ui/io-analyzer-view.js: unchanged - it already passes app._stepTrace and app._stepTrace.currentState to analyze(), so the cache-key fix in IOAnalyzerUI covers the boundary.

Verification: node --test passes 855/855 (was 851, +4 new). node --input-type=module --check on src/ai/IOAnalyzerUI.js passes.
