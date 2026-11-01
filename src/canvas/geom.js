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
