Title: Browser/DOM integration test suite (Wave 3.6)

Summary:
Created test/ui/browser-integration.test.js (370 lines) simulating the full
browser flow with the DOM shim pattern (makeElement() + globalThis.window/
document shim) following test/ui/AppController.test.js. Covers all 10 areas:
startup (2 qubits, render/inspector/code callbacks), palette placement via
pointerdown/pointerup at (80, 20) yielding H at column 0 row 0 with callback
and undo-history verification, inspector tab switching via app.notify(),
debugger transport (step/reset/seek change step/total), timeline max and
breakpoint toggle/add/clear, serialize/deserialize round-trip,
encodeURL/decodeURL round-trip, AI explainer button handler with mocked
AIExplainer plus AI Builder build flow (mocked AIBuilderUI adapter), I/O
analyze button handler (mocked IOAnalyzerUI adapter), and panel
collapse/expand via PanelModel. All 11 new tests pass; full repo suite
passes 891/891 via node --test; file passes node --input-type=module --check.
