Title: Fix browser entry module export mismatch

Summary:
Removed the invalid named import `import { main } from './src/main.js';` from the inline module script in index.html. The src/main.js module does not export a `main` symbol; it exports gate registry functions, panelModel/history/interaction/catalog, and theme instead. The missing export caused the browser to throw "The requested module 'http://localhost:8000/src/main.js' doesn't provide an export named: 'main'" and abort the ES module graph. Reload the page after pulling this change.
