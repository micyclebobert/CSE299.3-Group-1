import { columnX, rowY } from '../editor/Layout.js';
import { theme } from '../ui/theme.js';

const DEFAULT_COL_WIDTH = 64;
const DEFAULT_COL_GAP = 16;
const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_ROW_GAP = 8;
const DEFAULT_LABEL_GUTTER = 40;
const MAX_LINEAR_ENTROPY = 0.5;

export function renderCircuit(circuit, theme, {
  colWidth,
  colGap,
  rowHeight,
  rowGap,
  labelGutter = DEFAULT_LABEL_GUTTER,
  purity = null,
} = {}) {
  const cw = colWidth !== undefined ? colWidth : DEFAULT_COL_WIDTH;
  const cg = colGap !== undefined ? colGap : DEFAULT_COL_GAP;
  const rh = rowHeight !== undefined ? rowHeight : DEFAULT_ROW_HEIGHT;
  const rg = rowGap !== undefined ? rowGap : DEFAULT_ROW_GAP;
  const lg = labelGutter > 0 ? labelGutter : 0;

  const rows = circuit.numQubits;
  const columns = circuit.columns.length;
  const totalHeight = rows * (rh + rg) - rg;
  const gridWidth = columns > 0 ? columns * (cw + cg) - cg : 0;
  const totalWidth = lg + gridWidth;

  const gates = [];

  // Qubit labels (right-aligned at the left edge of the label gutter).
  for (let q = 0; q < rows; q++) {
    gates.push({
      kind: 'label',
      x: lg,
      y: rowY(q, rh, rg) + rh / 2,
      w: 0,
      h: 0,
      target: q,
      text: `q${q}`,
      color: theme.foreground,
    });
  }

  // Horizontal row separators.
  for (let q = 0; q < rows - 1; q++) {
    const sepY = rowY(q, rh, rg) + rh;
    gates.push({
      kind: 'rowSeparator',
      x1: lg,
      y1: sepY,
      x2: lg + gridWidth,
      y2: sepY,
      color: theme.rowSeparator,
    });
  }

  // Vertical column separators.
  for (let c = 0; c < columns - 1; c++) {
    const sepX = lg + columnX(c, cw, cg) + cw;
    gates.push({
      kind: 'line',
      x1: sepX,
      y1: 0,
      x2: sepX,
      y2: totalHeight,
      color: theme.border,
    });
  }

  // Row-level purity glow bands (state-driven entanglement highlighting).
  if (purity) {
    for (let q = 0; q < rows; q++) {
      const sl = purity[q] !== undefined ? purity[q] : 0;
      const alpha = Math.min(Math.max(sl / MAX_LINEAR_ENTROPY, 0), 1);
      if (alpha > 0) {
        gates.push({
          kind: 'rowGlow',
          x: lg,
          y: rowY(q, rh, rg),
          w: gridWidth,
          h: rh,
          color: theme.entropyAccent,
          alpha,
        });
      }
    }
  }

  for (let c = 0; c < columns; c++) {
    const x = lg + columnX(c, cw, cg);
    const columnGates = circuit.columns[c].gates;
    for (let g = 0; g < columnGates.length; g++) {
      const gate = columnGates[g];
      const cy = rowY(gate.target, rh, rg) + rh / 2;

      gates.push({
        kind: 'gate',
        x,
        y: rowY(gate.target, rh, rg),
        w: cw,
        h: rh,
        gateId: gate.name,
        target: gate.target,
        target2: gate.target2,
        controls: gate.controls,
        color: theme.gateFill,
        stroke: theme.gateStroke,
        cx: x + cw / 2,
        cy,
        thetaRad: gate.thetaRad,
        isControlled: gate.controls.length > 0,
        isSwap: gate.name === 'SWAP',
      });

      if (gate.controls.length > 0) {
        const cx = x + cw / 2;
        for (let k = 0; k < gate.controls.length; k++) {
          const control = gate.controls[k];
          gates.push({
            kind: 'controlLine',
            x1: cx,
            y1: rowY(control.row, rh, rg) + rh / 2,
            x2: cx,
            y2: cy,
            color: theme.entanglementGlow,
          });
          gates.push({
            kind: 'controlDot',
            x: cx,
            y: rowY(control.row, rh, rg) + rh / 2,
            color: theme.entanglementGlow,
            control: control,
          });
        }
        if (gate.name === 'CNOT') {
          gates.push({
            kind: 'targetCircle',
            x: x + cw / 2,
            y: cy,
            color: theme.foreground,
          });
        }
      }

      if (gate.name === 'SWAP' && Number.isInteger(gate.target2)) {
        const cy2 = rowY(gate.target2, rh, rg) + rh / 2;
        gates.push({
          kind: 'swapLine',
          x1: x + cw / 2,
          y1: cy,
          x2: x + cw / 2,
          y2: cy2,
          color: theme.foreground,
        });
      }
    }
  }

  return {
    gates,
    rows,
    columns,
    labelGutter: lg,
    rects: {
      colWidth: cw,
      colGap: cg,
      rowHeight: rh,
      rowGap: rg,
      labelGutter: lg,
      totalWidth,
      totalHeight,
    },
  };
}
