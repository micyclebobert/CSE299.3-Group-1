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

export function columnPitch(colWidth, colGap) {
  return colWidth + colGap;
}

export function rowPitch(rowHeight, rowGap) {
  return rowHeight + rowGap;
}

export function dockLeftRect({ x, y, width, height }) {
  return { x, y, w: width, h: height };
}

export function dockRightRect({ x, y, width, height }) {
  return { x, y, w: width, h: height };
}

export function dockBottomRect({ x, y, width, height }) {
  return { x, y, w: width, h: height };
}

export function dockMainRect({ x, y, width, height, leftWidth, rightWidth, bottomHeight }) {
  return {
    x: x + leftWidth,
    y,
    w: width - leftWidth - rightWidth,
    h: height - bottomHeight,
  };
}

export function panelBounds(region, viewport, dims) {
  switch (region) {
    case 'left':
      return dockLeftRect({ x: viewport.x, y: viewport.y, width: dims.leftWidth, height: viewport.height });
    case 'right':
      return dockRightRect({ x: viewport.x + viewport.width - dims.rightWidth, y: viewport.y, width: dims.rightWidth, height: viewport.height });
    case 'bottom':
      return dockBottomRect({ x: viewport.x, y: viewport.y + viewport.height - dims.bottomHeight, width: viewport.width, height: dims.bottomHeight });
    case 'main':
      return dockMainRect({ ...viewport, leftWidth: dims.leftWidth, rightWidth: dims.rightWidth, bottomHeight: dims.bottomHeight });
    default:
      throw new Error(`Unknown panel region: ${region}`);
  }
}
