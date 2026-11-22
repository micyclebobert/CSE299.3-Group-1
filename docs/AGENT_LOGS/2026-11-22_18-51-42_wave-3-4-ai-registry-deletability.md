Title: Wave 3.4 — Optional-leaf deletability for ai/

Summary:
- Created src/ai/registry.js re-exporting all 7 ai symbols (AIExplainer, IOAnalyzer, AIBuilder, SparseSummary, AIBuilderUI, IOAnalyzerUI, Cache) from their concrete modules (not a barrel/index file).
- src/main.js: replaced the 7 separate ai/ import lines with a single import from './ai/registry.js' and re-exported the ai symbols from './ai/registry.js' in a dedicated export line, so the ai/ section is 2 lines (1 import + 1 export) and deleting ai/ is a <=2-line diff.
- src/ui/ai-explainer-view.js: removed `import { SparseSummary, Cache } from '../main.js'`; initAIExplainerView now receives sparseSummary and cache as parameters and uses sparseSummary.summarize(state) plus cache || app.cache || new Cache().
- src/ui/browser-app.js: added SparseSummary to the main.js import and passes it to initAIExplainerView.
- Updated test call sites in test/ui/ai-explainer-view.test.js and test/ui/browser-integration.test.js to pass SparseSummary and a truthy Cache as the 4th/5th arguments.
- Verified: node --input-type=module --check passes on all 6 modified files; node --test passes 896/896 with 0 failures; src/main.js is 126 lines (< 400).
