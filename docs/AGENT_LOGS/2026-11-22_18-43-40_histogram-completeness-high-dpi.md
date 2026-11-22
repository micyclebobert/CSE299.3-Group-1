Title: Histogram completeness — every basis outcome + high-DPI canvas sizing

Summary:
Rewrote src/ui/inspector-histogram-view.js renderShots() to:
- Draw probabilities from app.probabilities() and labels from app.ketLabels(), multiplying by app.shots for expected counts.
- Render a bar for EVERY basis state including zero-count outcomes, sorted by index (no count-based sort, no "rest" collapsing).
- Cap at MAX_BARS=256 top-by-count states when 2^n exceeds the limit, re-sorted by index for display.
- Apply high-DPI canvas sizing: canvas.width/height = css px * (window.devicePixelRatio || 1) with ctx.setTransform(dpr, 0, 0, dpr, 0, 0); guarded window access for non-browser environments.
- Uses theme.accent/theme.textMuted only (no var(--simqc-...) in canvas 2D assignments).

Updated test/ui/inspector-histogram-view.test.js with tests verifying all basis states render (including zero-count), no "rest" bar, high-DPI canvas sizing scaled by dpr, and default dpr=1 fallback. Updated the pre-existing empty-hist mock to provide probabilities().

Verification:
- node --input-type=module --check on inspector-histogram-view.js: OK
- test/ui/inspector-histogram-view.test.js: 5/5 pass
- Full node --test: 896 tests, 895 pass, 1 fail — the single failure is ai-explainer-view.test.js, which fails independently of this change (does not import the histogram module).
