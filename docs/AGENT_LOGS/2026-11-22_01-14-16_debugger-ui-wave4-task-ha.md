Title: Debugger UI state model + callbacks (Wave 4, task H-a)

Summary:
Enhanced src/debugger/DebuggerUI.js from a thin wrapper into a DOM-free Debugger UI
state model wrapping the Debugger controller. It delegates transport controls
(reset, step/next, seek, runToBreakpoint, runToPreviousBreakpoint), maintains a
UI state snapshot (current step, total steps, mode, numQubits, changed steps,
column/predicate breakpoints, enabled state) kept in sync by wiring the
Debugger's callbacks, and exposes its own callback set (onStepChange,
onBreakpointHit, onReset, onSeek, onNext, onBreakpointsChanged) so a DOM layer
can re-render. Added test/debugger/DebuggerUI.test.js mirror test (27 tests).
Added togglePredicateBreakpoint/getPredicateBreakpointIds/clearAllBreakpoints
to src/debugger/Debugger.js to complete its breakpoint controller API (required
by DebuggerUI validation). All modules are DOM-free and run in bare Node.js.
Verified: node --test test/debugger/ 112 pass; full suite 775 pass / 0 fail;
node --input-type=module --check passes on all touched modules.
