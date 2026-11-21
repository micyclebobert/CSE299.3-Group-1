Title: Wave 1 Task A — Fix browser startup blockers

Summary:
Fixed three browser startup blockers in index.html and src/ui/AppController.js, and added a startup smoke test.

1. index.html: removed the duplicate `theme` import from the `./src/main.js` destructuring so `theme` (and `themeCssVariables`) come only from `./src/ui/theme.js`, resolving the "Identifier 'theme' has already been declared" parse error.
2. index.html: replaced `theme: themeObj` with `theme: theme` in the AppController constructor call since `themeObj` was never defined.
3. src/ui/AppController.js: implemented `_bindCanvas()` (attaches pointermove/mousemove listeners that record `this._pointer = {x, y}`, no-ops if canvas is null) and `_bindResize()` (adds `window.addEventListener('resize', () => this.draw())` and calls `this.draw()` once).
4. test/ui/AppControllerStartup.test.js: new smoke test verifying the theme single-source import, AppController export, construction in a minimal DOM shim, `_bindCanvas`/`_bindResize` presence, pointer position recording, and resize-triggered draw.

Verification:
- `node --input-type=module --check` passes on src/ui/AppController.js, src/ui/theme.js, src/main.js, and the new test file.
- `node --test test/ui/AppControllerStartup.test.js` passes: 5/5 tests.
- `git status` confirms only index.html, src/ui/AppController.js modified and test/ui/AppControllerStartup.test.js added; no other files touched.

No remaining blocker for the browser module to start. Wave 2 tasks not started.
