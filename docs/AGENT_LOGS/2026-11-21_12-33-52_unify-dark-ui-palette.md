Title: Unify Dark-Mode UI Color Palette

Summary:
Centralized the browser UI palette in src/ui/theme.js as an immutable, semantically named dark-mode theme covering surfaces, borders, text, controls, focus/selection states, action feedback, entanglement, phase, entropy, and status colors. Exported synchronized CSS custom properties through src/main.js, replaced ad-hoc color literals in index.html with theme variables, and added consistent button hover/active/focus/disabled, selection, scrollbar, panel, code-view, and inspector styling. Expanded test/ui/theme.test.js to verify palette completeness, dark surfaces, semantic hues, WCAG AA contrast, immutable theme exports, CSS variable synchronization, and the absence of ad-hoc colors in the browser shell.

Verification:
- Focused interface tests: node --test test/ui/theme.test.js test/canvas/Renderer.test.js (10/10 passing).
- Full suite: node --test (703/703 passing, 0 failures; 6 suites).
- Static syntax checks passed for src/ui/theme.js, src/main.js, and the inline index.html module.
- First-party color audit confirms literal colors exist only in src/ui/theme.js.
