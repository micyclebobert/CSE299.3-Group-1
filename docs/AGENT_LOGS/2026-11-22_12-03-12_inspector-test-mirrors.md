Title: Wave 2 Task E — Inspector module test mirrors

Summary:
Created 5 mirrored test files for the Inspector feature leaf under test/inspector/:
- Purity.test.js: gamma() and linearEntropy() for |0>, |+>, |00> product, Bell state (gamma=0.5, S_L=0.5), GHZ state (gamma=0.5 all rows, S_L=0.5), and computeAll() buffer writing.
- Bloch.test.js: vector() for |0> (0,0,+1), |1> (0,0,-1), |+> (+1,0,0), |-> (-1,0,0), |i> (0,+1,0), |-i> (0,-1,0), Bell state (0,0,0 both rows, |r|=0), and outBuffer offset writing.
- Histogram.test.js: sample() returns Map, |0>/|1> collapse to single index, |+> deterministic rng splits 50/50, rng=0 picks lowest nonzero index, total counts equal shots.
- Inspector.test.js: amplitudes() one entry per index with {index,re,im,prob}, probabilities() delegation, ketLabels() little-endian binary labels for 1 and 2 qubits, superposition probabilities.
- InspectorUI.test.js: probabilities() delegates to currentState.probabilities(), returns Float64Array, construction.

All mocks use a stepTrace.currentState facade with numQubits/size/getRe/getIm/probability/probabilities/normSquared. Verified: node --input-type=module --check passes on all 5 files; node --test test/inspector/ yields 27 passed, 0 failed; full node --test yields 807 passed, 0 failed (EXIT_CODE=0), no regressions.
