Title: Add measurement test coverage for H-11, M-24, M-27

Summary:
Extended test/measurement/measurement.test.js with six new tests (no source changes):

- H-11: Born-rule sampling of H|0> = |+> via evaluate() pipeline with 10000 shots, asserting both indices land within [4800, 5200] (~50/50 tolerance); deterministic collapse on a prob=1 basis state always yields that index (100 iterations).
- M-24: sampleHistogram does not mutate the source state — re/im buffers recorded before and compared after sampling.
- M-27: collapse and sampleHistogram throw TypeError on non-StateVector arguments; sampleHistogram rejects non-integer, negative, non-number shots and shots=0.

Added helpers: circuitFromOps, plusState (builds |+> via flattenCircuit + scheduleColumns + evaluate), buffersEqual; imports evaluate, flattenCircuit, scheduleColumns, Gate, GateColumn, Circuit, and seeds the GateRegistry via '../../src/main.js'.

Verification: `node --test test/measurement/measurement.test.js` → 10/10 pass; full repo `node --test` → 393/393 pass, 0 failures.
