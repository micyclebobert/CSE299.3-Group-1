Title: Wave 3 Task H — Group leaf imports by folder in main.js

Summary:
Grouped the discardable feature leaf imports in src/main.js by folder with consecutive lines and folder marker comments, so each leaf folder's imports form a deletable contiguous block:

- debugger/ (2 lines): DebuggerUI from DebuggerUI.js, Debugger from Debugger.js
- inspector/ (2 lines): Inspector from Inspector.js, InspectorUI from InspectorUI.js
- ai/ (consecutive block): AIExplainer, IOAnalyzer, AIBuilder, SparseSummary, AIBuilderUI, IOAnalyzerUI, Cache

Also added Debugger to the export line (was missing from exports despite being imported). Syntax check passed via `node --check --input-type=module`. Test suite has pre-existing IOAnalyzer failures from `src/ai/IOAnalyzer.js:95` (`changedSet.has(col.virtualColumn + 1)`), unrelated to this change. Only src/main.js was modified (8 insertions, 1 deletion).
