Title: Rename kebab-case UI modules to camelCase

Summary:
Renamed all 13 kebab-case UI module source files and their mirrored test files to camelCase per CONVENTIONS.md naming standards. Updated all import paths across src/ui/browserApp.js, src/ui/inspectorBlochView.js, index.html, and all 18 affected test files. All syntax checks (node --check) pass. npm run test:ui: 209/209 pass. npm run test:interface: 274/274 pass.

Files renamed (source + test):
- ai-builder-view.js → aiBuilderView.js (exports initAIBuilderView)
- ai-explainer-view.js → aiExplainerView.js (exports initAIExplainerView)
- browser-app.js → browserApp.js (exports initBrowserApp bootstrap)
- canvas-renderer.js → canvasRenderer.js (exports initCanvasRenderer)
- code-view.js → codeView.js (exports initCodeView)
- debugger-view.js → debuggerView.js (exports initDebuggerView)
- inspector-bloch-view.js → inspectorBlochView.js (exports initInspectorBlochView, projectBloch)
- inspector-histogram-view.js → inspectorHistogramView.js (exports initInspectorHistogramView)
- inspector-state-view.js → inspectorStateView.js (exports entropyColor, fmt, initInspectorStateView)
- inspector-tabs-view.js → inspectorTabsView.js (exports initInspectorTabsView)
- io-analyzer-view.js → ioAnalyzerView.js (exports initIOAnalyzerView)
- panel-view.js → panelView.js (exports initPanelView)
- placement-view.js → placementView.js (exports initPlacementView)

Files with import paths updated:
- src/ui/browserApp.js (11 import paths)
- src/ui/inspectorBlochView.js (1 import path)
- index.html (script src)
- test/ui/browser-integration.test.js (3 import paths)
- test/ui/browser-integration-comprehensive.test.js (3 import paths)
- All 13 renamed test files (import path + URL reference updates)
