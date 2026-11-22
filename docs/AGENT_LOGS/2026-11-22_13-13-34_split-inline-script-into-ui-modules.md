Title: Split inline browser script into separate ES module files under src/ui/

Summary:
Split the monolithic inline `<script type="module">` in index.html (lines 126-383) into 10 separate ES module files under src/ui/ and replaced it with a single import `<script type="module" src="./src/ui/browser-app.js"></script>`.

Files created:
- src/ui/browser-app.js — Main entry point: imports theme, AppController, and all view modules; sets CSS variables; constructs AppController; calls all init*() functions; handles initial draw, renderInspector, codeEl.value, updateDebugStep, URL hash loading, and resize.
- src/ui/canvas-renderer.js — Exports initCanvasRenderer(app, canvas, ctx); sets up app.onRender callback with the full canvas drawing loop (DPR, backing store, clearRect, renderCircuit, gate drawing).
- src/ui/inspector-view.js — Exports initInspectorView(app, inspectorContent); returns { renderInspector }; sets up app.onInspector, renderInspector() with amplitude/probability/Bloch tables, tab strip click handler, and shot sampling.
- src/ui/debugger-view.js — Exports initDebuggerView(app, stepCurrent, stepTotal); returns { updateDebugStep }; handles timeline scrubber, breakpoint toggle, run-to-breakpoint, step/run buttons, and step counter display.
- src/ui/code-view.js — Exports initCodeView(app, codeEl); handles app.onCode, Enter key JSON import, copy/import/export/share URL button handlers.
- src/ui/ai-explainer-view.js — Exports initAIExplainerView(app, aiOutput, AIExplainer); handles explain circuit button with Flatten.js import and AIExplainer via main.js export.
- src/ui/ai-builder-view.js — Exports initAIBuilderView(app, aiPrompt, builderOutput); handles build circuit button via app.aiBuilder callback.
- src/ui/io-analyzer-view.js — Exports initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput); handles analyze button via app.ioAnalyzer with Flatten.js import.
- src/ui/placement-view.js — Exports initPlacementView(app, canvas, interaction, onPlace); handles canvas pointerdown/pointermove/pointerup handlers.
- src/ui/panel-view.js — Exports initPanelView(panelModel); handles panel toggle button click handlers.

Changes to index.html:
- Replaced lines 126-383 (inline <script type="module">...</script>) with: <script type="module" src="./src/ui/browser-app.js"></script>

Verification:
- node --input-type=module --check: PASS for all 10 new module files
- node --test: 807 passed, 0 failed (no regressions)
- index.html no longer contains inline script
- All layering rules respected: ui/ modules import from main.js for feature leaves (ai/, debugger/, inspector/) and from circuit/ directly for Flatten.js
