Title: Wave 2 Task B — Remove no-op onInspector overwrite in index.html

Summary:
Removed line 245 (`app.onInspector(() => { });`) from index.html, which was overwriting the renderInspector callback registered at line 177 (`app.onInspector(() => { renderInspector(); });`). This restores automatic Inspector refresh on all controller notifications (place gate, undo/redo, simulate, reset, step, seek). Verified line 177 remains intact and line 245 is removed.

Verification:
- node --input-type=module --check: not applicable to HTML files (Node expects JS modules; HTML parse error expected)
- node --test: 785 tests pass, 0 fail across all test groups (core, circuit, sim, gates, measurement, algorithms, ai, debugger, canvas, editor, state, ui, inspector, cross-validation, differential)
- git diff confirms only the single line removal in index.html (plus a pre-existing colPitch/rowPitch change already in the working tree)
