import { columnX, rowY } from '../editor/Layout.js';
import { theme } from '../ui/theme.js';

const DEFAULT_COL_WIDTH = 64;
const DEFAULT_COL_GAP = 16;
const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_ROW_GAP = 8;

export function renderCircuit(circuit, theme, { colWidth, colGap, rowHeight, rowGap } = {}) {
  const cw = colWidth !== undefined ? colWidth : DEFAULT_COL_WIDTH;
  const cg = colGap !== undefined ? colGap : DEFAULT_COL_GAP;
  const rh = rowHeight !== undefined ? rowHeight : DEFAULT_ROW_HEIGHT;
  const rg = rowGap !== undefined ? rowGap : DEFAULT_ROW_GAP;

  const rows = circuit.numQubits;
  const columns = circuit.columns.length;
  const totalHeight = rows * (rh + rg) - rg;
  const totalWidth = columns > 0 ? columns * (cw + cg) - cg : 0;

  const gates = [];

  for (let q = 0; q < rows; q++) {
    gates.push({
      kind: 'label',
      x: 0,
      y: rowY(q, rh, rg),
      w: 0,
      h: 0,
      target: q,
      text: `q${q}`,
      color: theme.foreground,
    });
  }

  for (let c = 0; c < columns - 1; c++) {
    const sepX = columnX(c, cw, cg) + cw;
    gates.push({
      kind: 'line',
      x1: sepX,
      y1: 0,
      x2: sepX,
      y2: totalHeight,
      color: theme.border,
    });
  }

  for (let c = 0; c < columns; c++) {
    const x = columnX(c, cw, cg);
    const columnGates = circuit.columns[c].gates;
    for (let g = 0; g < columnGates.length; g++) {
      const gate = columnGates[g];
      const y = rowY(gate.target, rh, rg);

      gates.push({
        kind: 'gate',
        x,
        y,
        w: cw,
        h: rh,
        gateId: gate.name,
        target: gate.target,
        color: theme.gateFill,
        stroke: theme.gateStroke,
      });

      if (gate.controls.length > 0) {
        const cx = x + cw / 2;
        for (let k = 0; k < gate.controls.length; k++) {
          const control = gate.controls[k];
          gates.push({
            kind: 'line',
            x1: cx,
            y1: rowY(control.row, rh, rg),
            x2: cx,
            y2: y,
            color: theme.entanglementGlow,
          });
        }
        gates.push({
          kind: 'glow',
          x,
          y,
          w: cw,
          h: rh,
          color: theme.entanglementGlow,
        });
      }
    }
  }

  return {
    gates,
    rows,
    columns,
    rects: {
      colWidth: cw,
      colGap: cg,
      rowHeight: rh,
      rowGap: rg,
      totalWidth,
      totalHeight,
    },
  };
}
