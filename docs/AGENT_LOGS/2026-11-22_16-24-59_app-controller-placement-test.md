Title: Add AppController browser/view-level placement E2E test (Wave 1.5)

Summary:
Created test/ui/AppControllerPlacement.test.js, a view-level placement test
that simulates the full browser flow using the real AppController with the
DOM shim pattern (makeElement, globalThis.window/document). Covers: selecting
a palette gate (H), pointerdown (Interaction.pick) at x=80,y=20 -> column 0
row 0, pointerup (placeGateFromCell), verifying H lands at column 0 row 0,
render/inspector/code callbacks firing, inspector render calls, undo history
recording (and undo reverting), gap-semantics placement at column 2 (3 columns
with empty gap columns), invalid coordinates (negative/out-of-range) conflicting
with no circuit change, and CNOT control allocation to a non-target row.

Verification:
- node --input-type=module --check on the new file: OK
- node --test test/ui/AppControllerPlacement.test.js: 4 pass, 0 fail
- node --test (full suite): 839 pass, 0 fail (previously 835)
- Only new file added: test/ui/AppControllerPlacement.test.js
