Title: Wave 3 Task C — Inspector tab handling and readouts in index.html

Summary:
Fixed three Inspector issues in index.html only (no other files edited):

1. Tab listener moved from #inspector-content to #tab-strip so clicking the Amplitudes/Probabilities/Bloch Spheres tab buttons updates activeTab and re-renders.
2. renderInspector() now renders real readouts: Amplitudes shows a table of basis states with big-endian ket labels (app.ketLabels()), amplitude re/im, and probability (app.amplitudes()); Probabilities shows a distribution table with percent and a text bar (app.probabilities() + app.ketLabels()); Bloch lists each qubit row with its Bloch vector (app.bloch(q)), magnitude |r|, and linear entropy S_L (app.linearEntropy(q)) as conceptual per-qubit subtabs.
3. app.draw() is called at the end of renderInspector() so the canvas purity glow reflects state; app.onInspector(() => renderInspector()) remains wired and step/simulate/reset trigger live updates via notify().

Verification:
- node --input-type=module --check passed for all modules index.html imports (src/canvas/Renderer.js, src/ui/theme.js, src/main.js, src/ui/AppController.js).
- node --test "test/canvas/*.test.js" "test/editor/*.test.js": 57 passed, 0 failed.
- git status confirms only index.html was modified in this session (other working-tree changes pre-existed).
