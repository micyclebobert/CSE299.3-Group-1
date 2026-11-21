Title: README status claims — distinguish engine from browser UI

Summary:
Split the Project status table in README.md into separate "Engine" and "Browser UI" columns so engine-only capabilities are not mistaken for browser acceptance. State displays, breakpoints/stepwise inspection, and explainer/builder AI are now marked engine "✅ Done" but browser UI "⬜ Scaffold-only"; measurement browser UI is "⬜ Not implemented"; the custom drag-and-drop editor browser UI is "⬜ Planned". Added a legend defining Engine (src/core, src/circuit, src/sim, src/gates — headless, bare Node) vs Browser UI (src/ui, src/canvas, index.html), "n/a" for headless-only components, and "scaffold-only" meaning the browser surface exists but is not functional end-to-end. No other files were modified by this change.
