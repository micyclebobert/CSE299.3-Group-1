import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'node:fs';
import { initInspectorHistogramView } from '../../src/ui/inspector-histogram-view.js';

function source() {
  return readFileSync(new URL('../../src/ui/inspector-histogram-view.js', import.meta.url), 'utf8');
}

test('inspector-histogram-view imports theme from ./theme.js', () => {
  ok(/^import \{ theme \} from '\.\/theme\.js';$/m.test(source()), 'inspector-histogram-view.js must import theme from ./theme.js');
});

test('inspector-histogram-view exports initInspectorHistogramView and renderShots', () => {
  const src = source();
  ok(/^export function initInspectorHistogramView\(/m.test(source()), 'must export initInspectorHistogramView');
  ok(/return \{ renderShots \};/.test(src), 'must return renderShots');
});

test('renderShots reports no shots when sampleShots returns null (no trace)', () => {
  const app = { sampleShots: () => null, shots: 0 };
  const shotHistEl = { innerHTML: '', textContent: '' };
  const view = initInspectorHistogramView(app, shotHistEl);
  view.renderShots();
  strictEqual(shotHistEl.textContent, 'No shots sampled.');
  ok(typeof view.renderShots === 'function', 'exposes renderShots');
});

function mockDom(dpr) {
  const rects = [];
  const texts = [];
  const ctx = {
    setTransform() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h }); },
    fillText(text) { texts.push(text); },
    font: '',
    textAlign: '',
    fillStyle: '',
  };
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  const document = { createElement: () => canvas };
  const window = { devicePixelRatio: dpr };
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  globalThis.window = window;
  globalThis.document = document;
  return { canvas, ctx, rects, texts, restore() { globalThis.window = prevWindow; globalThis.document = prevDocument; } };
}

test('renderShots calls app.sampleShots and renders actual integer counts including zero counts', () => {
  const { canvas, rects, texts, restore } = mockDom(2);
  try {
    const app = {
      shots: 100,
      sampleShots: () => new Map([[0, 50], [2, 50]]),
      ketLabels: () => ['|00>', '|01>', '|10>', '|11>'],
    };
    const histEl = { clientWidth: 400, innerHTML: '', appendChild() {}, textContent: '' };
    const view = initInspectorHistogramView(app, histEl);
    view.renderShots();
    strictEqual(rects.length, 4, 'one bar per basis state including zero-count outcomes');
    ok(texts.includes('|00>') && texts.includes('|01>') && texts.includes('|10>') && texts.includes('|11>'), 'all basis labels rendered');
    strictEqual(texts.filter((t) => t === '50').length, 2, 'two bars with actual count 50');
    strictEqual(texts.filter((t) => t === '0').length, 2, 'two bars with zero count 0');
    ok(texts.includes('Shot histogram (100 shots)'), 'truthful empirical label');
    strictEqual(canvas.width, 400 * 2, 'canvas width scaled by device pixel ratio');
    strictEqual(canvas.height, 220 * 2, 'canvas height scaled by device pixel ratio');
  } finally {
    restore();
  }
});

test('renderShots uses default dpr of 1 when window.devicePixelRatio is absent', () => {
  const { canvas, rects, texts, restore } = mockDom(undefined);
  try {
    const app = {
      shots: 10,
      sampleShots: () => new Map([[0, 10]]),
      ketLabels: () => ['|0>', '|1>'],
    };
    const histEl = { clientWidth: 0, innerHTML: '', appendChild() {}, textContent: '' };
    const view = initInspectorHistogramView(app, histEl);
    view.renderShots();
    strictEqual(canvas.width, 400, 'default css width fallback of 400px');
    strictEqual(canvas.height, 220, 'canvas height is 220px');
    strictEqual(rects.length, 2, 'every basis state rendered including zero-count');
    ok(texts.filter((t) => t === '0').length === 1, 'zero-count outcome rendered');
  } finally {
    restore();
  }
});

test('renderShots caps at 256 bars: top 256 by count then sorted by index, zero counts in range rendered', () => {
  const { rects, texts, restore } = mockDom(1);
  try {
    const size = 300;
    const labels = [];
    for (let i = 0; i < size; i += 1) labels.push(`|${i}>`);
    const hist = new Map([[299, 10], [150, 7], [0, 5]]);
    const app = {
      shots: 100,
      sampleShots: () => hist,
      ketLabels: () => labels,
    };
    const histEl = { clientWidth: 400, innerHTML: '', appendChild() {}, textContent: '' };
    const view = initInspectorHistogramView(app, histEl);
    view.renderShots();
    strictEqual(rects.length, 256, 'exactly 256 bars when more than 256 outcomes');
    ok(texts.includes('|0>') && texts.includes('|299>'), 'top-by-count extremes retained');
    ok(texts.includes('|1>'), 'zero-count outcome within cap rendered');
    ok(!texts.includes('|256>'), 'zero-count outcome outside cap dropped');
    ok(texts.includes('Shot histogram (100 shots)'), 'truthful empirical label');
  } finally {
    restore();
  }
});
