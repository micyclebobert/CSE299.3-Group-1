import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { Circuit } from '../../src/circuit/Circuit.js';
import { GateColumn, Gate } from '../../src/circuit/GateColumn.js';
import { renderCircuit } from '../../src/canvas/Renderer.js';
import { columnX, rowY } from '../../src/editor/Layout.js';
import { theme } from '../../src/ui/theme.js';

test('renderCircuit returns rows, columns, and gate descriptor array', () => {
  const colWidth = 64;
  const colGap = 16;
  const rowHeight = 40;
  const rowGap = 8;
  const labelGutter = 48;

  const circuit = new Circuit({
    numQubits: 2,
    columns: [
      new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] }),
      new GateColumn({ gates: [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })] }),
    ],
  });

  const result = renderCircuit(circuit, theme, { colWidth, colGap, rowHeight, rowGap, labelGutter });

  strictEqual(result.rows, 2);
  strictEqual(result.columns, 2);
  ok(Array.isArray(result.gates));
  strictEqual(result.labelGutter, labelGutter);

  const hGate = result.gates.find((d) => d.kind === 'gate' && d.gateId === 'H');
  ok(hGate);
  strictEqual(hGate.x, labelGutter + columnX(0, colWidth, colGap));
  strictEqual(hGate.y, rowY(0, rowHeight, rowGap));
  strictEqual(hGate.w, colWidth);
  strictEqual(hGate.h, rowHeight);
  strictEqual(hGate.target, 0);
  strictEqual(hGate.cx, labelGutter + columnX(0, colWidth, colGap) + colWidth / 2);
  strictEqual(hGate.cy, rowY(0, rowHeight, rowGap) + rowHeight / 2);

  const cnotGate = result.gates.find((d) => d.kind === 'gate' && d.gateId === 'CNOT');
  ok(cnotGate);
  strictEqual(cnotGate.x, labelGutter + columnX(1, colWidth, colGap));
  strictEqual(cnotGate.y, rowY(1, rowHeight, rowGap));
  ok(cnotGate.isControlled);
  strictEqual(cnotGate.controls.length, 1);

  // Control line now connects gate centres, not row top edges.
  const cx = labelGutter + columnX(1, colWidth, colGap) + colWidth / 2;
  const controlLine = result.gates.find((d) => d.kind === 'controlLine');
  ok(controlLine);
  strictEqual(controlLine.x1, cx);
  strictEqual(controlLine.y1, rowY(0, rowHeight, rowGap) + rowHeight / 2);
  strictEqual(controlLine.y2, rowY(1, rowHeight, rowGap) + rowHeight / 2);

  // Control dot at the control row centre.
  const controlDot = result.gates.find((d) => d.kind === 'controlDot');
  ok(controlDot);
  strictEqual(controlDot.x, cx);
  strictEqual(controlDot.y, rowY(0, rowHeight, rowGap) + rowHeight / 2);

  // Target circle on the CNOT target gate centre.
  const targetCircle = result.gates.find((d) => d.kind === 'targetCircle');
  ok(targetCircle);
  strictEqual(targetCircle.x, cx);
  strictEqual(targetCircle.y, rowY(1, rowHeight, rowGap) + rowHeight / 2);

  // No per-gate glow; row-level glow is purity-driven (purity null => none).
  const glow = result.gates.find((d) => d.kind === 'rowGlow');
  ok(!glow);

  const labels = result.gates.filter((d) => d.kind === 'label');
  strictEqual(labels.length, 2);
  // Labels are offset into the label gutter (right-aligned), not at x=0 off-canvas.
  strictEqual(labels[0].text, 'q0');
  strictEqual(labels[0].x, labelGutter);
  strictEqual(labels[0].y, rowY(0, rowHeight, rowGap) + rowHeight / 2);
  strictEqual(labels[1].text, 'q1');
  strictEqual(labels[1].x, labelGutter);
  strictEqual(labels[1].y, rowY(1, rowHeight, rowGap) + rowHeight / 2);

  const separators = result.gates.filter((d) => d.kind === 'line' && d.x1 === d.x2 && d.y1 === 0 && d.y2 === result.rects.totalHeight);
  strictEqual(separators.length, 1);
  strictEqual(separators[0].x1, labelGutter + columnX(0, colWidth, colGap) + colWidth);
  strictEqual(separators[0].color, theme.border);

  // Horizontal row separators between rows.
  const rowSeps = result.gates.filter((d) => d.kind === 'rowSeparator');
  strictEqual(rowSeps.length, 1);
  strictEqual(rowSeps[0].y1, rowY(0, rowHeight, rowGap) + rowHeight);
  strictEqual(rowSeps[0].x1, labelGutter);
  strictEqual(rowSeps[0].x2, labelGutter + result.rects.totalWidth - labelGutter);

  strictEqual(result.rects.colWidth, colWidth);
  strictEqual(result.rects.colGap, colGap);
  strictEqual(result.rects.rowHeight, rowHeight);
  strictEqual(result.rects.rowGap, rowGap);
  strictEqual(result.rects.labelGutter, labelGutter);
  strictEqual(result.rects.totalWidth, labelGutter + (2 * (colWidth + colGap) - colGap));
  strictEqual(result.rects.totalHeight, 2 * (rowHeight + rowGap) - rowGap);

  strictEqual(circuit.columns.length, 2);
});

test('renderCircuit uses default layout dims when omitted', () => {
  const circuit = new Circuit({ numQubits: 1, columns: [new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] })] });
  const result = renderCircuit(circuit, theme);
  const gate = result.gates.find((d) => d.kind === 'gate');
  ok(gate);
  strictEqual(gate.x, result.labelGutter);
  strictEqual(gate.y, 0);
  strictEqual(gate.w, 64);
  strictEqual(gate.h, 40);
  strictEqual(result.rows, 1);
  strictEqual(result.columns, 1);
});

test('renderCircuit emits rowGlow when purity linear entropy is present', () => {
  const circuit = new Circuit({ numQubits: 2, columns: [] });
  const purity = new Float64Array([0, 0.5]); // row 1 maximally entangled
  const result = renderCircuit(circuit, theme, { purity });
  const glow = result.gates.find((d) => d.kind === 'rowGlow' && d.alpha > 0);
  ok(glow);
  strictEqual(glow.y, rowY(1, 40, 8));
  strictEqual(glow.h, 40);
});
