Title: Add grouped package.json test: variants

Summary:
Added grouped test scripts to package.json that combine multiple test/<group>/ folders into single `node --test` invocations (node --test accepts multiple positional globs), layered on top of the existing per-group variants:
- test:engine = core + circuit + sim (headless engine)
- test:catalog = gates + algorithms (gate catalog + algorithm builders)
- test:interface = canvas + editor + ui (browser UI / editor shell)
- test:features = debugger + state + ai (discardable leaves)
- test:validation = measurement + cross-validation + differential
Per-group variants (test:core, test:circuit, test:sim, test:gates, test:algorithms, test:measurement, test:canvas, test:editor, test:ui, test:debugger, test:state, test:ai, test:cross-validation, test:differential) are retained for targeted runs.
Verified JSON validity; smoke-ran test:engine (238/238 pass) and previously test:gates (30/30), test:state (10/10), test:canvas (10/10). Only package.json changed.
