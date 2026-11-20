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

  const circuit = new Circuit({
    numQubits: 2,
    columns: [
      new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] }),
      new GateColumn({ gates: [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })] }),
    ],
  });

  const result = renderCircuit(circuit, theme, { colWidth, colGap, rowHeight, rowGap });

  strictEqual(result.rows, 2);
  strictEqual(result.columns, 2);
  ok(Array.isArray(result.gates));

  const hGate = result.gates.find((d) => d.kind === 'gate' && d.gateId === 'H');
  ok(hGate);
  ok('kind' in hGate);
  ok('x' in hGate);
  ok('y' in hGate);
  ok('w' in hGate);
  ok('h' in hGate);
  ok('color' in hGate);
  strictEqual(hGate.x, columnX(0, colWidth, colGap));
  strictEqual(hGate.y, rowY(0, rowHeight, rowGap));
  strictEqual(hGate.w, colWidth);
  strictEqual(hGate.h, rowHeight);
  strictEqual(hGate.target, 0);
  strictEqual(hGate.color, theme.gateFill);
  strictEqual(hGate.stroke, theme.gateStroke);

  const cnotGate = result.gates.find((d) => d.kind === 'gate' && d.gateId === 'CNOT');
  ok(cnotGate);
  strictEqual(cnotGate.x, columnX(1, colWidth, colGap));
  strictEqual(cnotGate.y, rowY(1, rowHeight, rowGap));
  strictEqual(cnotGate.color, theme.gateFill);

  const cx = columnX(1, colWidth, colGap) + colWidth / 2;
  const controlLine = result.gates.find((d) => d.kind === 'line' && d.x1 === cx);
  ok(controlLine);
  strictEqual(controlLine.y1, rowY(0, rowHeight, rowGap));
  strictEqual(controlLine.y2, rowY(1, rowHeight, rowGap));
  strictEqual(controlLine.color, theme.entanglementGlow);

  const glow = result.gates.find((d) => d.kind === 'glow' && d.color === theme.entanglementGlow);
  ok(glow);
  strictEqual(glow.x, cnotGate.x);
  strictEqual(glow.y, cnotGate.y);
  strictEqual(glow.w, colWidth);
  strictEqual(glow.h, rowHeight);

  const labels = result.gates.filter((d) => d.kind === 'label');
  strictEqual(labels.length, 2);
  strictEqual(labels[0].text, 'q0');
  strictEqual(labels[0].x, 0);
  strictEqual(labels[0].y, rowY(0, rowHeight, rowGap));
  strictEqual(labels[1].text, 'q1');
  strictEqual(labels[1].x, 0);
  strictEqual(labels[1].y, rowY(1, rowHeight, rowGap));

  const separators = result.gates.filter((d) => d.kind === 'line' && d.x1 === d.x2 && d.y1 === 0 && d.y2 === result.rects.totalHeight);
  strictEqual(separators.length, 1);
  strictEqual(separators[0].x1, columnX(0, colWidth, colGap) + colWidth);
  strictEqual(separators[0].color, theme.border);

  strictEqual(result.rects.colWidth, colWidth);
  strictEqual(result.rects.colGap, colGap);
  strictEqual(result.rects.rowHeight, rowHeight);
  strictEqual(result.rects.rowGap, rowGap);
  strictEqual(result.rects.totalWidth, 2 * (colWidth + colGap) - colGap);
  strictEqual(result.rects.totalHeight, 2 * (rowHeight + rowGap) - rowGap);

  strictEqual(circuit.columns.length, 2);
});

test('renderCircuit uses default layout dims when omitted', () => {
  const circuit = new Circuit({ numQubits: 1, columns: [new GateColumn({ gates: [new Gate({ name: 'X', target: 0 })] })] });
  const result = renderCircuit(circuit, theme);
  const gate = result.gates.find((d) => d.kind === 'gate');
  ok(gate);
  strictEqual(gate.x, 0);
  strictEqual(gate.y, 0);
  strictEqual(gate.w, 64);
  strictEqual(gate.h, 40);
  strictEqual(result.rows, 1);
  strictEqual(result.columns, 1);
});
