Title: Wave 3 Task F - Bloch sphere rendering and shot histogram

Summary:
Rewrote src/ui/inspector-view.js to replace the Bloch numeric vector table with canvas-based Bloch sphere rendering (per-qubit subtabs Qubit 0..n-1 plus register overview, entropy-colored state-vector arrow drawn via app.bloch(q) and app.linearEntropy(q)) and replace the shot text frequency list with a bar chart (app.sampleShots(), bars proportional to counts, big-endian ket labels). Histogram.js and Bloch.js left unchanged (no changes needed). Verified: node --input-type=module --check passes; test/inspector 27/27 pass; test/ui 23/23 pass.
