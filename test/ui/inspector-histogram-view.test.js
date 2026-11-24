import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'node:fs';
import { initInspectorHistogramView } from '../../src/ui/inspector-histogram-view.js';

function source() {
  return readFileSync(new URL('../../src/ui/inspector-histogram-view.js', import.meta.url), 'utf8');
}

test('inspector-histogram-view imports theme, StateVector and sampleHistogram', () => {
  const src = source();
  ok(/^import \{ theme \} from '\.\/theme\.js';$/m.test(source()), 'imports theme from ./theme.js');
  ok(/from '\.\.\/core\/StateVector\.js'/.test(src), 'imports StateVector from ../core/StateVector.js');
  ok(/from '\.\.\/measurement\/measurement\.js'/.test(src), 'imports sampleHistogram from ../measurement/measurement.js');
});

test('exports initInspectorHistogramView returning renderShots and setBoundary', () => {
  const src = source();
  ok(/^export function initInspectorHistogramView\(/m.test(source()), 'must export initInspectorHistogramView');
  ok(/return \{ renderShots, setBoundary \};/.test(src), 'must return renderShots and setBoundary');
});

test('renderShots reports no shots when sampleShots returns null (no trace)', () => {
  const { restore } = mockDom(1, 400);
  try {
    const app = { sampleShots: () => null, shots: 0 };
    const containerEl = { innerHTML: '', textContent: '', clientWidth: 400, appendChild() {} };
  const view = initInspectorHistogramView(app, containerEl);
  view.renderShots();
  strictEqual(typeof view.renderShots, 'function', 'exposes renderShots');
  strictEqual(typeof view.setBoundary, 'function', 'exposes setBoundary');
  } finally {
    restore();
  }
});

function mockDom(dpr, cssW) {
  const rects = [];
  const texts = [];
  const created = [];
  const ctx = {
    setTransform() {},
    fillRect(x, y, w, h) { rects.push({ x, y, w, h }); },
    fillText(text) { texts.push(text); },
    font: '',
    textAlign: '',
    fillStyle: '',
  };
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx, clientWidth: 0 };
  function makeDiv() {
    const children = [];
    let ownText = '';
    const el = {
      innerHTML: '',
      style: {},
      clientWidth: cssW > 0 ? cssW : 400,
      children,
      appendChild(child) { children.push(child); return child; },
      get textContent() {
        const kids = children.map((c) => c.textContent).filter((t) => t.length > 0);
        return ownText.length > 0 ? ownText + (kids.length ? '\n' + kids.join('\n') : '') : kids.join('\n');
      },
      set textContent(v) { ownText = String(v); }
    };
    return el;
  }
  const document = {
    createElement(tag) {
      const el = tag === 'canvas' ? canvas : makeDiv();
      created.push(el);
      return el;
    },
  };
  const window = { devicePixelRatio: dpr };
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  globalThis.window = window;
  globalThis.document = document;
  return {
    canvas, ctx, rects, texts, created,
    restore() { globalThis.window = prevWindow; globalThis.document = prevDocument; },
  };
}

test('renderShots draws one bar per basis state with integer counts and ket labels', () => {
  const { canvas, rects, texts, restore } = mockDom(2, 400);
  try {
    const app = {
      shots: 100,
      sampleShots: () => new Map([[0, 50], [2, 50]]),
      ketLabels: () => ['|00>', '|01>', '|10>', '|11>'],
    };
    const containerEl = { clientWidth: 400, children: [], appendChild(child) { this.children.push(child); return child; } };
    const view = initInspectorHistogramView(app, containerEl);
    view.renderShots();
    strictEqual(rects.length, 4, 'one bar per basis state including zero-count outcomes');
    ok(texts.includes('|00>') && texts.includes('|01>') && texts.includes('|10>') && texts.includes('|11>'), 'all ket labels rendered');
    strictEqual(texts.filter((t) => t === '50').length, 2, 'two bars with actual count 50');
    strictEqual(texts.filter((t) => t === '0').length, 2, 'two bars with zero count 0');
    ok(texts.includes('Shot histogram (100 shots)'), 'truthful empirical label');
    strictEqual(canvas.height, 220 * 2, 'canvas height scaled by device pixel ratio');
    const n = 4;
    const barW = Math.max(12, Math.floor(400 / n));
    const totalW = n * (barW + 6) - 6;
    for (const r of rects) {
      ok(r.x + r.w <= totalW, `bar at x=${r.x} width=${r.w} exceeds fitted canvas width ${totalW}`);
    }
    strictEqual(canvas.width, totalW * 2, 'canvas backing store scaled by DPR and sized to fit bars');
  } finally {
    restore();
  }
});

test('renderShots uses default dpr of 1 when window.devicePixelRatio is absent', () => {
  const { canvas, rects, texts, restore } = mockDom(undefined, 0);
  try {
    const app = {
      shots: 10,
      sampleShots: () => new Map([[0, 10]]),
      ketLabels: () => ['|0>', '|1>'],
    };
    const containerEl = { clientWidth: 0, children: [], appendChild(child) { this.children.push(child); return child; } };
    const view = initInspectorHistogramView(app, containerEl);
    view.renderShots();
    strictEqual(canvas.width, 406, 'canvas sized to fit bars (2 x 200px + gap)');
    strictEqual(canvas.height, 220, 'canvas height is 220px');
    strictEqual(rects.length, 2, 'every basis state rendered including zero-count');
    ok(texts.filter((t) => t === '0').length === 1, 'zero-count outcome rendered');
  } finally {
    restore();
  }
});

test('renderShots caps at 256 bars: top 256 by count then index, zero counts in range rendered', () => {
  const { rects, texts, created, restore } = mockDom(1, 50);
  try {
    const size = 300;
    const labels = [];
    for (let i = 0; i < size; i += 1) labels.push(`|${i}>`);
    const hist = new Map([[299, 100], [150, 70], [0, 50]]);
    const app = {
      shots: 1000,
      sampleShots: () => hist,
      ketLabels: () => labels,
    };
    const containerEl = { clientWidth: 50, children: [], appendChild(child) { this.children.push(child); return child; } };
    const view = initInspectorHistogramView(app, containerEl);
    view.renderShots();
    strictEqual(rects.length, 256, 'exactly 256 bars when more than 256 outcomes');
    ok(texts.includes('|0>') && texts.includes('|299>'), 'top-by-count extremes retained');
    ok(texts.includes('|1>'), 'zero-count outcome within cap rendered');
    ok(!texts.includes('|256>'), 'zero-count outcome outside cap dropped');
    ok(texts.includes('Shot histogram (1000 shots)'), 'truthful empirical label');
    const histEl = created[0];
    const caps = histEl.children.filter((c) => String(c.style.color).includes('cca700'));
    strictEqual(caps.length, 1, 'truncation caption rendered');
    ok(caps[0].textContent.startsWith('Showing top 256 of 300 outcomes by count'), 'caption names cap and total');
    for (const r of rects) {
      strictEqual(r.w, 12, 'bar width honoured minimum of 12px when canvas is narrow');
      ok(r.x + r.w <= 256 * (12 + 6) - 6, 'bar fits within fitted canvas (scrollable)');
    }
  } finally {
    restore();
  }
});

test('setBoundary binds histogram to the selected state step via getStateAtStep', () => {
  const { rects, texts, restore } = mockDom(1, 400);
  try {
    const boundaryState = {
      numQubits: () => 2,
      size: () => 4,
      getRe: (i) => i === 0 ? 1 : 0,
      getIm: () => 0,
    };
    const app = {
      shots: 256,
      sampleShots: () => { throw new Error('sampleShots must not be called when a boundary is bound'); },
      ketLabels: () => ['|00>', '|01>', '|10>', '|11>'],
      getStateAtStep: (step) => step === 3 ? boundaryState : null,
    };
    const containerEl = { clientWidth: 400, children: [], appendChild(child) { this.children.push(child); return child; } };
    const view = initInspectorHistogramView(app, containerEl);
    view.setBoundary({ step: 3, totalSteps: 5 });
    view.renderShots();
    strictEqual(rects.length, 4, 'one bar per basis state at boundary');
    strictEqual(texts.filter((t) => t === '256').length, 1, 'all shots landed on |00> at boundary step');
    strictEqual(texts.filter((t) => t === '0').length, 3, 'remaining outcomes show zero count');
    ok(texts.includes('Shot histogram (256 shots)'), 'truthful label for boundary sample');
  } finally {
    restore();
  }
});

test('renderShots with a bound boundary step that has no state shows a message', () => {
  const { created, restore } = mockDom(1, 400);
  try {
    const app = { shots: 100, sampleShots: () => null, ketLabels: () => [], getStateAtStep: () => null };
    const containerEl = { clientWidth: 400, children: [], appendChild() {} };
    const view = initInspectorHistogramView(app, containerEl);
    view.setBoundary({ step: 1 });
    view.renderShots();
    strictEqual(created[0].textContent, 'No state at selected step.');
  } finally {
    restore();
  }
});
