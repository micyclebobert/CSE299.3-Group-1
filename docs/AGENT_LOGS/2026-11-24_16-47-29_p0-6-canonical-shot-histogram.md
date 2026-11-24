Title: P0-6 — Canonical shot histogram moved under State Inspector tab

Summary:
Rewrote src/ui/inspector-histogram-view.js: initInspectorHistogramView(app, containerEl) now returns { renderShots, setBoundary }; the histogram renders into a container managed by the view and appended to the inspector content area. Bar width scales as max(12, floor(cssW / shown.length)) so bars always fit within the canvas; when they exceed cssW the container scrolls horizontally. The 256-bar cap sorts by count desc, takes the top 256, re-sorts by index, and shows a visible "Showing top 256 of N outcomes by count; remaining outcomes have 0 or negligible counts." caption. Keeps true integer/zero-count sampling via app.sampleShots(), truthful ket labels, and DPR scaling. setBoundary(binding) binds the histogram to app.getStateAtStep(step) so it reflects the selected state boundary.

Updated src/ui/inspector-tabs-view.js: initInspectorTabsView accepts a renderHistogram callback and invokes it when the State tab is active (histogram drawn under the State tab content, not a separate bottom panel).

Updated src/ui/browser-app.js: histogramView containers into inspectorEl and passes renderHistogram: histogramView.renderShots to the tabs view; removed the now-unused #shot-hist element from index.html.

Updated tests: test/ui/inspector-histogram-view.test.js (bar fit/scaling, 256 cap + caption, zero counts, boundary binding), test/ui/inspector-tabs-view.test.js (histogram under State tab), test/ui/browser-app.test.js (dropped shot-hist from expected IDs).

Verification: node --input-type=module --check clean on all modified files; npm run test:ui -> 201 pass, 0 fail; full npm test -> 1047 pass, 0 fail. All files under 400 lines.
