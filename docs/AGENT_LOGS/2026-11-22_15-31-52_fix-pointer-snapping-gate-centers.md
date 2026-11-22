Title: Fix pointer snapping to gate centers (Wave 1.1)

Summary:
- src/ui/placement-view.js: changed snap() colOffset from 48 to 80 so pointer snapping maps to gate centers (labelGutter 48 + colWidth/2 32) instead of cell left edges.
- test/ui/AppController.test.js: updated the snapCell geometry regression test to colOffset: 80 and snapped x assertion from 48 to 80.
- test/ui/placement-view.test.js: new file with 8 boundary tests covering gate centers, inter-column and inter-row boundaries, cell left/right edges, and the no-pick guard using renderer geometry (colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20).

Verification: node --test (815 tests, 8 suites, all pass); node --input-type=module --check on all modified files.
