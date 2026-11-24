Title: Inspector, Debugger, and Visualization Completeness Features

Summary:
Implemented all QA items from docs/Plans/UI.md TODO across 5 source files:

1. src/canvas/Renderer.js — Added distinct gate symbols (CZ phase marker, Toffoli target circle with double controls, SWAP × symbol via swapCross), anti-control markers (controlDot.on field distinguishes filled vs hollow), current virtual-column marker (vertical line at active step), breakpoint markers on canvas columns, and verified row glow uses linear entropy SL(q) via entropy parameter (with purity fallback).

2. src/ui/app-controller-inspector.js — Added purityGamma(q) returning γq, gammas() returning all γq values, densityMatrix(q) returning single-qubit reduced density matrix ρq, stateVectorText() returning full formatted state vector with big-endian ket labels, and draw() now passes purity (γq), entropy (SL(q)), and gamma to renderer.

3. src/ui/app-controller-debugger.js — Added stepPrevious(), playPause(), runToPreviousBreakpoint(), getCurrentVirtualColumn() for debugger navigation and current-step marking.

4. src/ui/inspectorStateView.js — Added stateVectorText(app) exported function rendering all 2^n amplitudes with real/imaginary parts, phase, and probability, including zero-state (|00...0⟩) handling, integrated into renderState().

5. src/debugger/BreakpointManager.js — Added per-predicate-breakpoint enabled state via { predicate, enabled } objects, setPredicateBreakpointEnabled(id, enabled), isPredicateBreakpointEnabled(id), and checkBreakpoints() skips disabled predicates.

6. src/debugger/DebuggerUI.js — Added setPredicateBreakpointEnabled and isPredicateBreakpointEnabled delegating via BreakpointManager for breakpoint predicate configuration UI.

All 1068 tests pass (0 failures, 23 Shor's tests skipped by default).
