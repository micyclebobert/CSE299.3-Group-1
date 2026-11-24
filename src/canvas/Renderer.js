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
  entropy = null,
  currentVirtualColumn = -1,
  breakpoints = [],
  selectedCell = null,
  hoverCell = null,
  conflictCells = [],
  scale = 1,
  panX = 0,
  panY = 0,
} = {}) {
  const cw = colWidth !== undefined ? colWidth : DEFAULT_COL_WIDTH;
  const cg = colGap !== undefined ? colGap : DEFAULT_COL_GAP;
  const rh = rowHeight !== undefined ? rowHeight : DEFAULT_ROW_HEIGHT;
  const rg = rowGap !== undefined ? rowGap : DEFAULT_ROW_GAP;
  const lg = labelGutter > 0 ? labelGutter : 0;

  const sx = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const tx = Number.isFinite(panX) ? panX : 0;
  const ty = Number.isFinite(panY) ? panY : 0;

  const txfX = (x) => x * sx + tx;
  const txfY = (y) => y * sx + ty;
  const txfW = (w) => w * sx;
  const txfH = (h) => h * sx;

  const rows = circuit.numQubits;
  const columns = circuit.columns.length;
  const totalHeight = rows * (rh + rg) - rg;
  const gridWidth = columns > 0 ? columns * (cw + cg) - cg : 0;
  const totalWidth = lg + gridWidth;

  const gates = [];

  const glowValues = entropy !== null ? entropy : purity;

  const selectedCol = selectedCell && Number.isInteger(selectedCell.column) ? selectedCell.column : null;
  const selectedRow = selectedCell && Number.isInteger(selectedCell.row) ? selectedCell.row : null;
  const hoverCol = hoverCell && Number.isInteger(hoverCell.column) ? hoverCell.column : null;
  const hoverRow = hoverCell && Number.isInteger(hoverCell.row) ? hoverCell.row : null;
  const conflictSet = new Set();
  for (const cell of conflictCells ?? []) {
    if (Number.isInteger(cell.column) && Number.isInteger(cell.row)) {
      conflictSet.add(`${cell.column},${cell.row}`);
    }
  }

  for (let q = 0; q < rows; q++) {
    gates.push({
      kind: 'label',
      x: txfX(lg),
      y: txfY(rowY(q, rh, rg) + rh / 2),
      w: 0,
      h: 0,
      target: q,
      text: `q${q}`,
      color: theme.foreground,
    });
  }

  for (let q = 0; q < rows - 1; q++) {
    const sepY = rowY(q, rh, rg) + rh;
    gates.push({
      kind: 'rowSeparator',
      x1: txfX(lg),
      y1: txfY(sepY),
      x2: txfX(lg + gridWidth),
      y2: txfY(sepY),
      color: theme.rowSeparator,
    });
  }

  for (let c = 0; c < columns - 1; c++) {
    const sepX = lg + columnX(c, cw, cg) + cw;
    gates.push({
      kind: 'line',
      x1: txfX(sepX),
      y1: txfY(0),
      x2: txfX(sepX),
      y2: txfY(totalHeight),
      color: theme.border,
    });
  }

  if (glowValues) {
    for (let q = 0; q < rows; q++) {
      const sl = glowValues[q] !== undefined ? glowValues[q] : 0;
      const alpha = Math.min(Math.max(sl / MAX_LINEAR_ENTROPY, 0), 1);
      if (alpha > 0) {
        gates.push({
          kind: 'rowGlow',
          x: txfX(lg),
          y: txfY(rowY(q, rh, rg)),
          w: txfW(gridWidth),
          h: txfH(rh),
          color: theme.entropyAccent,
          alpha,
        });
      }
    }
  }

  const bpSet = new Set(breakpoints);
  for (let c = 0; c < columns; c++) {
    if (bpSet.has(c)) {
      const bx = lg + columnX(c, cw, cg) + cw / 2;
      gates.push({
        kind: 'breakpointMarker',
        x: txfX(bx),
        y: txfY(0),
        w: txfW(10),
        h: txfH(10),
        color: theme.warning,
      });
    }
  }

  if (Number.isInteger(currentVirtualColumn) && currentVirtualColumn >= 0 && currentVirtualColumn < columns) {
    const mx = lg + columnX(currentVirtualColumn, cw, cg);
    gates.push({
      kind: 'currentColumnMarker',
      x1: txfX(mx),
      y1: txfY(0),
      x2: txfX(mx),
      y2: txfY(totalHeight),
      color: theme.focus,
    });
  }

  for (let c = 0; c < columns; c++) {
    const x = lg + columnX(c, cw, cg);
    const columnGates = circuit.columns[c].gates;
    for (let g = 0; g < columnGates.length; g++) {
      const gate = columnGates[g];
      const cy = rowY(gate.target, rh, rg) + rh / 2;

      const selected = selectedCol === c && selectedRow === gate.target;
      const hovered = hoverCol === c && hoverRow === gate.target;
      const conflict = conflictSet.has(`${c},${gate.target}`);

      let fill = theme.gateFill;
      let stroke = theme.gateStroke;
      let lineWidth = 1.5;
      if (conflict) {
        fill = theme.danger;
        stroke = theme.danger;
        lineWidth = 2;
      } else if (selected) {
        fill = theme.gateFill;
        stroke = theme.focus;
        lineWidth = 2.5;
      } else if (hovered) {
        fill = theme.controlHover;
        stroke = theme.accent;
        lineWidth = 2;
      }

      gates.push({
        kind: 'gate',
        x: txfX(x),
        y: txfY(rowY(gate.target, rh, rg)),
        w: txfW(cw),
        h: txfH(rh),
        gateId: gate.name,
        target: gate.target,
        target2: gate.target2,
        controls: gate.controls,
        color: fill,
        stroke,
        cx: txfX(x + cw / 2),
        cy: txfY(cy),
        thetaRad: gate.thetaRad,
        isControlled: gate.controls.length > 0,
        isSwap: gate.name === 'SWAP',
        selected,
        hovered,
        conflict,
        lineWidth,
      });

      if (gate.controls.length > 0) {
        const cx = x + cw / 2;
        for (let k = 0; k < gate.controls.length; k++) {
          const control = gate.controls[k];
          gates.push({
            kind: 'controlLine',
            x1: txfX(cx),
            y1: txfY(rowY(control.row, rh, rg) + rh / 2),
            x2: txfX(cx),
            y2: txfY(cy),
            color: conflict ? theme.danger : theme.entanglementGlow,
          });
          gates.push({
            kind: 'controlDot',
            x: txfX(cx),
            y: txfY(rowY(control.row, rh, rg) + rh / 2),
            color: conflict ? theme.danger : theme.entanglementGlow,
            control: control,
            on: control.on !== false,
          });
        }
        if (gate.name === 'CNOT') {
          gates.push({
            kind: 'targetCircle',
            x: txfX(x + cw / 2),
            y: txfY(cy),
            color: conflict ? theme.danger : theme.foreground,
          });
        }
        if (gate.name === 'CZ') {
          gates.push({
            kind: 'czPhase',
            x: txfX(x + cw / 2),
            y: txfY(cy),
            color: conflict ? theme.danger : theme.foreground,
          });
        }
        if (gate.name === 'Toffoli') {
          gates.push({
            kind: 'targetCircle',
            x: txfX(x + cw / 2),
            y: txfY(cy),
            color: conflict ? theme.danger : theme.foreground,
          });
        }
      }

      if (gate.name === 'SWAP' && Number.isInteger(gate.target2)) {
        const cy2 = rowY(gate.target2, rh, rg) + rh / 2;
        const swapColor = conflict ? theme.danger : theme.foreground;
        gates.push({
          kind: 'swapCross',
          x1: txfX(x + cw / 2 - 6),
          y1: txfY(cy - 6),
          x2: txfX(x + cw / 2 + 6),
          y2: txfY(cy + 6),
          color: swapColor,
        });
        gates.push({
          kind: 'swapCross',
          x1: txfX(x + cw / 2 - 6),
          y1: txfY(cy + 6),
          x2: txfX(x + cw / 2 + 6),
          y2: txfY(cy - 6),
          color: swapColor,
        });
        gates.push({
          kind: 'swapCross',
          x1: txfX(x + cw / 2 - 6),
          y1: txfY(cy2 - 6),
          x2: txfX(x + cw / 2 + 6),
          y2: txfY(cy2 + 6),
          color: swapColor,
        });
        gates.push({
          kind: 'swapCross',
          x1: txfX(x + cw / 2 - 6),
          y1: txfY(cy2 + 6),
          x2: txfX(x + cw / 2 + 6),
          y2: txfY(cy2 - 6),
          color: swapColor,
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
      totalWidth: txfW(totalWidth),
      totalHeight: txfH(totalHeight),
      scale: sx,
      panX: tx,
      panY: ty,
    },
  };
}
