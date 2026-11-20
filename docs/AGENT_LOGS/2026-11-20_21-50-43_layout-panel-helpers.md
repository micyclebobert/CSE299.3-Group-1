Title: SimQC Sprint 5 M1.2 — editor Layout panel/grid sizing helpers and tests

Summary:
Extended src/editor/Layout.js with pure panel/grid sizing helpers:
columnPitch, rowPitch, dockLeftRect, dockRightRect, dockBottomRect,
dockMainRect, and panelBounds. All helpers are pure, DOM-free, use named
exports only, const by default, no var, zero module-level mutable state,
and rects are plain {x, y, w, h} objects. panelBounds dispatches on
region ('left'|'main'|'right'|'bottom') and throws on unknown regions.
Created test/editor/Layout.test.js with 15 node:test cases covering pitch
math, dock rects, per-region panelBounds results (expected values derived
from the pure functions themselves), non-overlapping regions for a sample
viewport, and the unknown-region error. Verified with `node --test` from
the repo root: 563 passed, 0 failed, 9 TODO (python3/Qiskit unavailable).
Only src/editor/Layout.js and test/editor/Layout.test.js were changed for
this task.
