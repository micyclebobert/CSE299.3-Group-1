// =============================================================================
// src/canvas/geom.js
// -----------------------------------------------------------------------------
// Pure coordinate math for the circuit canvas: Point, Rect.
// Node-testable (no DOM).
// =============================================================================

export class Point {
  constructor(x, y) { this.x = x; this.y = y; }
}

export class Rect {
  constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
}

export function hitTest(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w &&
    point.y >= rect.y && point.y <= rect.y + rect.h;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function snapToGrid(value, grid) {
  if (grid <= 0) return value;
  const rounded = Math.round(value / grid);
  return rounded * grid;
}
