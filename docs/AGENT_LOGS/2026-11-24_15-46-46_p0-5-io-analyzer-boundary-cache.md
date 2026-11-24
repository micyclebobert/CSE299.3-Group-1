Title: P0-5 — I/O Analyzer boundary selector & cache identity

Summary:
- src/ui/io-analyzer-view.js: Route through public accessors — replaced app._stepTrace with app.getStepTrace(); added a boundary <select> ("Final state"/"Virtual step") plus a step number input appended to the io-analyzer section; on analyze click, read stateBoundary/selectedStep and forward them via ioAnalyzer.analyze() options (stateBoundary, selectedStep) along with state and numQubits; sparse top-k results already displayed via onChange; report status through new public app.setStatus().
- src/ui/AppController.js: Added public setStatus(msg) delegating to _status().
- src/ai/IOAnalyzerUI.js: clearCache() now calls this.#cache.clear() to preserve the injected Cache identity instead of replacing it with new Cache(); added get cache() accessor; stateIdentity for the 'final' boundary now incorporates the actual trace step (`final@step=<traceStep>`) so pre- vs post-simulation produce different cache keys and stale sparse state is not served; 'step' boundary reuses traceStep.
- src/ai/IOAnalyzer.js: enrichWithLLM() now accepts and passes the actual instructions to explainer.explain(instructions, summaries, numQubits) instead of an empty array.
- src/ai/Cache.js: Added clear() instance method that clears the internal Map preserving instance identity.
- Tests: added/updated test/ui/io-analyzer-view.test.js (mock getStepTrace/setStatus/real Circuit; options-forwarding test), test/ai/IOAnalyzerUI.test.js (final boundary before/after cache key differs; clearCache preserves identity), test/ai/IOAnalyzer.test.js (enrichWithLLM passes instructions).
- Verification: node --input-type=module --check passes on all modified files; npm run test:ai 0 failures (88 tests); npm run test:ui 0 failures (191 tests); npm run test:features 0 failures (233 tests); all files under 400 lines; no ai/ -> debugger/ or inspector/ imports.
