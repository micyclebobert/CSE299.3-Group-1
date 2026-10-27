Title: Add missing gate/algorithm test coverage (H-13, H-14, L-26, L-27, L-28, M-07, M-08, M-09, M-10, M-11, M-13ish, M-28, M-29)

Summary:
- test/gates/basis.test.js: removed unused `approx`/`TOL` helper; added state-evolution tests through flattenCircuit/scheduleColumns/evaluate (X|0> -> |1>, H|0> -> |+>, I^2=I, H^2=I) and an Object.is bit-identical untouched-amplitudes test for CNOT(0->1). Seeds GateRegistry via import of src/main.js.
- test/gates/param.test.js: rewrote Rx/Ry/Rz(pi) tuple tests as evaluate-based -iX/-iY/-iZ identity tests up to global phase (analytic ideal states, no hardcoded tuples); kept Rx/Ry/Rz(0)=I tuple tests and length-8 test; added Cu1 tuple test + Cu1(pi) phase-flip evaluate test; added TypeError input-validation tests for Rx/Ry/Rz with non-number theta; added Object.is bit-identical untouched-amplitudes test under controlled Cu1(pi).
- test/algorithms/qft.test.js: replaced strictEqual(getIm(i), 0) with approxEqual; extended n=3 sweep to k=4 and k=6; replaced over-coupled qft(2) column-layout assertions with behavioral qftState(2,k) check for all k.
- test/algorithms/shor.test.js: replaced broad Error catch on shor(9,3) with /gcd/ message check; added N=21 (t=10, r=6) and N=35 (t=8, r=12) peak-concentration tests where r does not divide 2^t; added bit-determinism Object.is test across repeated evaluate runs.
- src/gates/param.js (deviation, required for the TypeError tests to pass): Rx/Ry/Rz now throw TypeError when theta is not a number.

Verification: `node --test` from repo root: 387 tests, 387 pass, 0 fail.
