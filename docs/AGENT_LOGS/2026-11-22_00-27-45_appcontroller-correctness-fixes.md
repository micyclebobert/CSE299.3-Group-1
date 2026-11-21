Title: Wave 2 Task B — AppController correctness fixes

Summary:
Fixed three controller correctness bugs in src/ui/AppController.js:

1. UNDO/REDO: _setCircuit() now accepts { record = true } and only pushes to History when record is true. undo()/redo() restore snapshots with { record: false }, so the redo branch is no longer truncated and canRedo() is correct after undo+restore.

2. GATE ARITY/CONTROL ENFORCEMENT: _tryPlace() now reads gateControlCount()/gateNeedsTarget2() from gatePalette, validates that enough free rows exist for all required controls (+ target2), and returns a conflict instead of placing an invalid controlled gate with 0 controls. CNOT/CZ require exactly 1 positive control; Toffoli requires exactly 2.

3. SHOT SAMPLING: sampleShots() now clones the StepTrace currentState facade into a real StateVector (copying re/im buffers) before passing it to sampleHistogram(), fixing the TypeError.

Verification:
- node --test test/ui/*.test.js: 23 pass, 0 fail
- node --test test/editor/*.test.js test/state/History.test.js: 56 pass, 0 fail
- node --input-type=module --check src/ui/AppController.js: SYNTAX OK

Only src/ui/AppController.js was modified.
