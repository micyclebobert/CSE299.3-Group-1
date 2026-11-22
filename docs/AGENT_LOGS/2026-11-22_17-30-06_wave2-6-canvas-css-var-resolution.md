Title: Wave 2.6 — Canvas CSS-variable color resolution in inspector-view.js

Summary:
- src/ui/inspector-view.js: Added `import { theme } from './theme.js';` and replaced all 8 Canvas 2D style assignments that used unresolved `var(--simqc-...)` strings with resolved theme values:
  - ctx.strokeStyle = theme.borderStrong ('#555555') — sphere outline (was --simqc-border-strong)
  - ctx.fillStyle = theme.textMuted ('#a6a6a6') — axis labels / shot bar labels / shot title (was --simqc-text-muted, 4 sites)
  - ctx.fillStyle = theme.foreground ('#d4d4d4') — register overview text (was --simqc-foreground, 2 sites)
  - ctx.fillStyle = theme.accent ('#4daafc') — shot histogram bars (was --simqc-accent)
- File remains 330 lines (under the 400-line cap). The 3 remaining `var(--simqc...)` occurrences are HTML/DOM style assignments (lines 31, 49, 104) which resolve correctly in the browser via CSS variables set on document.documentElement in browser-app.js; they are out of scope for Canvas 2D.
- src/ui/browser-app.js: no change needed — it already imports { theme, themeCssVariables } from '../main.js' (re-exported from src/ui/theme.js) and applies them to document.documentElement.
- test/ui/inspector-view.test.js: new test file (3 tests) asserting theme import exists, no `var(` remains in canvas style assignments, and every canvas style assignment resolves to a theme hex value or valid CSS color.
- Verification: `node --check` passes on both modified files; `node --test` passes 862/862 (859 pre-existing + 3 new), 0 failures.
