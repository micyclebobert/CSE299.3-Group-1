import { test } from 'node:test';
import { strictEqual, deepStrictEqual } from 'assert';
import {
  columnX,
  rowY,
  columnPitch,
  rowPitch,
  dockLeftRect,
  dockRightRect,
  dockBottomRect,
  dockMainRect,
  panelBounds,
} from '../../src/editor/Layout.js';

test('columnPitch returns width plus gap', () => {
  const colWidth = 120;
  const colGap = 16;
  strictEqual(columnPitch(colWidth, colGap), colWidth + colGap);
});

test('rowPitch returns height plus gap', () => {
  const rowHeight = 60;
  const rowGap = 8;
  strictEqual(rowPitch(rowHeight, rowGap), rowHeight + rowGap);
});

test('columnX equals index times pitch', () => {
  const colIndex = 3;
  const colWidth = 120;
  const colGap = 16;
  strictEqual(columnX(colIndex, colWidth, colGap), colIndex * columnPitch(colWidth, colGap));
});

test('rowY equals index times pitch', () => {
  const rowIndex = 2;
  const rowHeight = 60;
  const rowGap = 8;
  strictEqual(rowY(rowIndex, rowHeight, rowGap), rowIndex * rowPitch(rowHeight, rowGap));
});

test('dockLeftRect returns a plain rect object', () => {
  const rect = dockLeftRect({ x: 0, y: 0, width: 200, height: 600 });
  deepStrictEqual(rect, { x: 0, y: 0, w: 200, h: 600 });
});

test('dockRightRect returns a plain rect object', () => {
  const rect = dockRightRect({ x: 0, y: 0, width: 160, height: 600 });
  deepStrictEqual(rect, { x: 0, y: 0, w: 160, h: 600 });
});

test('dockBottomRect returns a plain rect object', () => {
  const rect = dockBottomRect({ x: 0, y: 0, width: 800, height: 120 });
  deepStrictEqual(rect, { x: 0, y: 0, w: 800, h: 120 });
});

test('dock rects for a sample viewport are non-overlapping', () => {
  const viewport = { x: 0, y: 0, width: 800, height: 600 };
  const leftWidth = 200;
  const rightWidth = 160;
  const bottomHeight = 120;

  const left = dockLeftRect({ x: viewport.x, y: viewport.y, width: leftWidth, height: viewport.height });
  const right = dockRightRect({ x: viewport.x + viewport.width - rightWidth, y: viewport.y, width: rightWidth, height: viewport.height });
  const bottom = dockBottomRect({ x: viewport.x, y: viewport.y + viewport.height - bottomHeight, width: viewport.width, height: bottomHeight });

  strictEqual(left.x + left.w <= right.x, true);
  strictEqual(right.x + right.w <= viewport.x + viewport.width, true);
  strictEqual(bottom.y >= viewport.y + viewport.height - bottomHeight, true);
});

test('dockMainRect shrinks viewport by dock dims', () => {
  const x = 0;
  const y = 0;
  const width = 800;
  const height = 600;
  const leftWidth = 200;
  const rightWidth = 160;
  const bottomHeight = 120;
  const rect = dockMainRect({ x, y, width, height, leftWidth, rightWidth, bottomHeight });
  deepStrictEqual(rect, { x: x + leftWidth, y, w: width - leftWidth - rightWidth, h: height - bottomHeight });
});

test('panelBounds returns the left region rect', () => {
  const viewport = { x: 0, y: 0, width: 800, height: 600 };
  const dims = { leftWidth: 200, rightWidth: 160, bottomHeight: 120 };
  const expected = dockLeftRect({ x: viewport.x, y: viewport.y, width: dims.leftWidth, height: viewport.height });
  deepStrictEqual(panelBounds('left', viewport, dims), expected);
});

test('panelBounds returns the right region rect', () => {
  const viewport = { x: 0, y: 0, width: 800, height: 600 };
  const dims = { leftWidth: 200, rightWidth: 160, bottomHeight: 120 };
  const expected = dockRightRect({ x: viewport.x + viewport.width - dims.rightWidth, y: viewport.y, width: dims.rightWidth, height: viewport.height });
  deepStrictEqual(panelBounds('right', viewport, dims), expected);
});

test('panelBounds returns the bottom region rect', () => {
  const viewport = { x: 0, y: 0, width: 800, height: 600 };
  const dims = { leftWidth: 200, rightWidth: 160, bottomHeight: 120 };
  const expected = dockBottomRect({ x: viewport.x, y: viewport.y + viewport.height - dims.bottomHeight, width: viewport.width, height: dims.bottomHeight });
  deepStrictEqual(panelBounds('bottom', viewport, dims), expected);
});

test('panelBounds returns the main region rect', () => {
  const viewport = { x: 0, y: 0, width: 800, height: 600 };
  const dims = { leftWidth: 200, rightWidth: 160, bottomHeight: 120 };
  const expected = dockMainRect({ ...viewport, leftWidth: dims.leftWidth, rightWidth: dims.rightWidth, bottomHeight: dims.bottomHeight });
  deepStrictEqual(panelBounds('main', viewport, dims), expected);
});

test('panelBounds regions are non-overlapping', () => {
  const viewport = { x: 10, y: 20, width: 800, height: 600 };
  const dims = { leftWidth: 200, rightWidth: 160, bottomHeight: 120 };
  const left = panelBounds('left', viewport, dims);
  const right = panelBounds('right', viewport, dims);
  const bottom = panelBounds('bottom', viewport, dims);
  const main = panelBounds('main', viewport, dims);

  strictEqual(left.x + left.w <= right.x, true);
  strictEqual(right.x + right.w <= viewport.x + viewport.width, true);
  strictEqual(bottom.y >= viewport.y + viewport.height - dims.bottomHeight, true);
  strictEqual(main.x >= left.x + left.w, true);
  strictEqual(main.x + main.w <= right.x, true);
  strictEqual(main.y + main.h <= bottom.y, true);
});

test('panelBounds throws on unknown region', () => {
  let threw = false;
  try {
    panelBounds('nowhere', { x: 0, y: 0, width: 10, height: 10 }, {});
  } catch (e) {
    threw = true;
  }
  strictEqual(threw, true);
});
