// =============================================================================
// src/editor/Layout.js
// -----------------------------------------------------------------------------
// Pure grid coordinate math for the circuit editor. Node-testable (no DOM).
// =============================================================================

export function columnX(colIndex, colWidth, colGap) {
  return colIndex * (colWidth + colGap);
}

export function rowY(rowIndex, rowHeight, rowGap) {
  return rowIndex * (rowHeight + rowGap);
}
