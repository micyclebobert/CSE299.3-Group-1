Title: Fix all 16 codebase rule compliance issues

Summary:
Restructured the SimQC codebase to comply with SOURCE_OF_TRUTH.md, CONVENTIONS.md, FOLDER_STRUCTURE.md, and AGENTS.md. All 132 tests pass via `node --test` and the CLI pipe contract produces correct Bell state output.

Changes:
1. Moved gate definitions (basis.js, param.js) from src/core/ to src/gates/ per CONVENTIONS §3 layering (gates/ imported only by main.js).
2. Moved src/core/kernel.js → src/sim/kernel.js (kernel belongs in sim/ L3, not core/ L1).
3. Moved src/core/registry.js → src/circuit/GateRegistry.js; rewrote to be unsealed during construction (main.js registers gates) then sealed — breaks circuit/ → gates/ cycle.
4. Created src/main.js as sole importer of gates/ and discardable leaves; injects gates into GateRegistry.
5. Moved src/cli.js → cli/cli.js per FOLDER_STRUCTURE Group 7; imports main.js to seed registry.
6. Created src/measurement/measurement.js (collapse + sampleHistogram) per SOURCE_OF_TRUTH §6.4.
7. Created src/algorithms/ (dj.js, grover.js) stubs per SOURCE_OF_TRUTH §3.2.
8. Created UI stubs: src/ui/theme.js, src/canvas/geom.js, src/editor/Layout.js, src/state/History.js.
9. Created discardable leaf stubs: src/debugger/DebuggerUI.js, src/inspector/InspectorUI.js, src/ai/AIExplainer.js.
10. Added SWAP/Toffoli dispatch in src/sim/Evaluator.js.
11. Added primary class exports matching base filenames: Serializer, Flatten, Ascii, Evaluator.
12. Fixed JSDoc .default reference in registry → named export.
13. Created 1:1 mirrored tests: test/core/{Complex,Matrix,StateVector}.test.js, test/gates/{basis,param}.test.js, test/circuit/{GateRegistry,Flatten,Ascii}.test.js, test/sim/{kernel,Evaluator}.test.js, test/measurement/measurement.test.js.
14. Removed duplicate test files: test/kernel.test.js, test/serializer.test.js.
15. Rewrote test/differential.test.js to use all 6 amplitude profiles (SOURCE_OF_TRUTH §9.2 Layer 6) across n=1..6.
16. Deleted old orphan files: src/core/{basis,kernel,param,registry}.js, src/cli.js.

All 132 tests pass. CLI produces correct Bell state JSON on stdout.