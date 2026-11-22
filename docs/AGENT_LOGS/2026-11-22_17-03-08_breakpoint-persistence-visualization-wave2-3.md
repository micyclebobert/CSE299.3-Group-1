Title: Breakpoint state persistence and visualization (Wave 2.3)

Summary:
- src/ui/debugger-view.js: initDebuggerView now accepts an optional 4th breakpoint-list element (or creates one dynamically / falls back to #breakpoint-list). Added refreshBreakpoints() that renders active breakpoints from app.getBreakpointsWithStatus() with active-state highlighting (breakpoint-active class) when the step is at the breakpoint. refreshBreakpoints() is called via refreshTimeline() after every transport action (timeline scrub, step, run, run-to-breakpoint) and after toggleBreakpoint.
- src/ui/AppController.js: Added getBreakpointsWithStatus() returning {column, active} per breakpoint (active when column === current step). Added clearAllBreakpoints(). Added breakpoint persistence in _setCircuit: breakpoints are captured before the circuit/Debugger is recreated and restored (via addBreakpoint, which validates against the new schedule length) so columns within the new schedule persist and those beyond it are dropped. File stays at 399 lines (under the 400 cap).
- index.html: Added #breakpoint-list div in the bottom panel toolbar plus breakpoint-list/breakpoint-row/breakpoint-active CSS.
- src/ui/browser-app.js: Passes document.getElementById('breakpoint-list') as the 4th arg to initDebuggerView.
- test/ui/AppController.test.js: Added 4 tests — breakpoints preserved across circuit edit within new length, breakpoints beyond new length dropped, getBreakpointsWithStatus active flag, clearAllBreakpoints clears all.
- Verification: node --test passes 851/851 (847 baseline + 4 new). ESM syntax checks pass on all modified source files. AppController.js is 399 lines (<= 400).
