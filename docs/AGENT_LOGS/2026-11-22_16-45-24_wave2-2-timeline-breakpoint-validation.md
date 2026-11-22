Title: Wave 2.2 — Timeline slider max/value sync and breakpoint validation

Summary:
- src/ui/debugger-view.js: Added refreshTimeline() that sets the timeline-scrub max via app.getTimelineMax() and value via app.getDebuggerStep(), updating step display. Called initially and after every transport action (step, run, reset, seek, run-to-BP). On input, clamps the slider value to [0, max] before calling app.seekDebugger(). Returns updateDebugStep alias for backward compatibility with browser-app.js.
- src/ui/AppController.js: Added getTimelineMax() returning getTotalSteps(). Added _validBreakpointCol(col) helper. Rewrote addBreakpoint/removeBreakpoint/toggleBreakpoint to reject negative or col > scheduleLength input with this._status() feedback, returning false on conflict, and catching RangeError/TypeError from Debugger methods.
- test/ui/AppController.test.js: Added 4 tests — addBreakpoint(-1) returns false with status feedback, addBreakpoint(999) beyond schedule length returns false, addBreakpoint(0) on empty circuit works, getTimelineMax() returns schedule length.
- Verification: node --input-type=module --check passes on both source files; node --test passes all 847 tests (843 prior + 4 new).
