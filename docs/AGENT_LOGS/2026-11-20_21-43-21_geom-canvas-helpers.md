Title: Add canvas coordinate helpers (hitTest, clamp, snapToGrid) and tests

Summary:
Extended src/canvas/geom.js with three pure, DOM-free coordinate helpers:
hitTest(point, rect) (inclusive bounds), clamp(value, min, max), and
snapToGrid(value, grid) (passthrough for grid <= 0). Created the 1:1 mirrored
test/canvas/geom.test.js covering inside/outside/edges, below/above/inside
clamp cases, and snap up/down/exact/grid<=0 passthrough. Verified with
node --test (8/8 passing). No lint/typecheck scripts exist in package.json.
