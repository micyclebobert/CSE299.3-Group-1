Title: Wave 2.1 Debugger/StepTrace synchronization

Summary:
Routed AppController.simulate() through the Debugger so DebuggerUI stays in sync.
- src/ui/AppController.js: simulate() now calls this._debugger.reset() then loops this._debugger.next() until end when a Debugger is present (firing onStep/onReset callbacks that update DebuggerUI state), falling back to direct _stepTrace iteration when no Debugger exists. reset() already routed through Debugger and calls notify(); stepDebugger()/runToBreakpoint()/seekDebugger() already call notify(). File stays at 379 lines (< 400).
- src/ui/debugger-view.js: no change required; btn-run already calls updateDebugStep() after app.simulate(), which now reads the correct step via app.getDebuggerStep().
- test/ui/AppController.test.js: added 4 tests (simulate routes through Debugger to end; simulate without Debugger still works; reset routes through Debugger to step 0; stepDebugger advances by 1). Seeded GateRegistry via import of src/main.js.
Verification: node --test passes 843/843 (was 839 +4 new); node --input-type=module --check passes on both modified files.
