Title: Restore optional-leaf deletability (2-line-diff rule) for ai/, inspector/, debugger/

Summary:
- src/main.js: Guarded `cache` instantiation with `typeof Cache !== 'undefined'` check so deleting ai/ (removing its single import line) leaves `cache` as null instead of throwing a ReferenceError. Leaf imports remain at ≤2 lines per folder (debugger: 2, inspector: 2, ai: 1 via registry.js).
- src/ui/AppController.js: Added null check `if (this._Inspector)` around inspector construction in `_setCircuit` so deleting inspector/ doesn't crash the AppController constructor.
- src/ui/browser-app.js: Added null/undefined guards for every leaf import and DOM element before use: inspector view init, debugger view init, canvas renderer, code view, AI explainer view, AI builder view, IO analyzer view, placement view, and all button/shots event listeners. All `document.getElementById` calls remain unconditional so the existing browser-app test still passes (all expected IDs requested).
- All 949 tests pass (0 failures).
