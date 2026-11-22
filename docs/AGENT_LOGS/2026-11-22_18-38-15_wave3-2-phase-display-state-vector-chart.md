Title: Wave 3.2 — Phase display + state-vector chart in inspector state view

Summary:
Modified src/ui/inspector-state-view.js:
1. Added a Phase column to renderAmplitudes() showing Math.atan2(a.im, a.re).toFixed(3) + 'rad' per amplitude.
2. Added renderStateVectorChart() which inserts a high-DPI (devicePixelRatio) <canvas> into the container and draws probability bars per basis state, labeled with ket labels, with a zero-state message when all amplitudes are ~0 (and an "Only |0…0⟩ populated" annotation for the single-|0> case).
3. renderState() is now a composite rendering amplitudes table + probabilities table + state-vector chart.
Canvas 2D assignments use theme values (theme.accent, theme.textMuted, theme.panel, theme.border, theme.phaseAccent) rather than CSS vars. The view writes to its container parameter via container.innerHTML and gracefully skips DOM drawing when no real canvas context is available (Node/test harness).

Added tests to test/ui/inspector-state-view.test.js verifying:
- Phase column header and rad-formatted phase values present in amplitudes HTML.
- Chart canvas markup created in container on renderState.
- renderState renders both tables plus the chart.

Verification:
- node --input-type=module --check on inspector-state-view.js: OK.
- node --test test/ui/inspector-state-view.test.js: 8/8 pass.
- All other UI test files pass except test/ui/ai-explainer-view.test.js, which is a pre-existing failure from an untracked prior-wave file unrelated to this change.
