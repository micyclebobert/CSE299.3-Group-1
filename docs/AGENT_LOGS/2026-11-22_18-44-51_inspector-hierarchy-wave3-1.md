Title: Inspector hierarchy — 2 tabs (State + Bloch Spheres) Wave 3.1

Summary:
Verified the inspector tab-strip reduction from 3 tabs (Amplitudes, Probabilities, Bloch Spheres) to 2 tabs (State, Bloch Spheres) is fully implemented across all required files.

Changes confirmed in working tree:
1. index.html — tab-strip now has 2 buttons: data-tab="state" (State, active) and data-tab="bloch" (Bloch Spheres). Previously had 3 buttons (amplitudes/probabilities/bloch).
2. src/ui/inspector-tabs-view.js — activeTab defaults to 'state'; renderInspector() dispatches state -> renderState(), else -> renderBloch().
3. src/ui/inspector-state-view.js — renderState() composites both renderAmplitudes() and renderProbabilities() tables.
4. src/ui/browser-app.js — wires stateView.renderState and blochView.renderBloch into tabsView; shot histogram rendered separately via histogramView.renderShots() on the Sample button click.
5. test/ui/inspector-tabs-view.test.js — verifies default activeTab is 'state', state branch calls renderState(), else branch calls renderBloch().

Test results: all 21 inspector-related tests pass. Full suite (excluding the slow 21-qubit Shor test in test/algorithms/shor.test.js): 874 pass, 1 fail. The single failure is in test/ui/ai-explainer-view.test.js ("initAIExplainerView builds one SparseSummary per virtual column") — pre-existing and unrelated to inspector changes.
