Title: Split inspector-view.js into 4 modules (Wave 3 split)

Summary:
Split the 343-line src/ui/inspector-view.js (edited by Wave 2.7 plus Wave 3 tasks 3.1/3.2/3.3) into four modules so Wave 3 work can be parallelized:
- src/ui/inspector-tabs-view.js — tab strip + dispatch (activeTab state, renderInspector, app.onInspector wiring; returns renderInspector/getActiveTab/setActiveTab)
- src/ui/inspector-state-view.js — amplitudes/probabilities tables (entropyColor, fmt, renderAmplitudes, renderProbabilities, renderState compositing both tables); imports theme from ./theme.js; exports entropyColor and fmt for reuse by the Bloch view
- src/ui/inspector-bloch-view.js — Bloch sphere canvas + per-qubit subtabs (blochSubtab state, renderBloch, drawSphere, projectBloch, draw); imports theme and entropyColor/fmt from state view; exports renderBloch and projectBloch
- src/ui/inspector-histogram-view.js — shot histogram (renderShots); imports theme; exports renderShots
Deleted src/ui/inspector-view.js and test/ui/inspector-view.test.js.
Modified src/ui/browser-app.js to import from the 4 new modules and wire stateView/blochView/histogramView/tabsView; btn-sample now calls histogramView.renderShots(); shots-input listener moved into browser-app.js.
Aligned index.html tab-strip to the new data-tab="state"/"bloch" model (was amplitudes/probabilities/bloch) so the consolidated State tab renders correctly.
Created 1:1 mirrored tests under test/ui/ for all four modules.
Verification: node --input-type=module --check passes on all new/modified files; `node --test` from repo root passes 891/891 with 0 failures. All modules under 400 lines; named exports only; no barrel files.
