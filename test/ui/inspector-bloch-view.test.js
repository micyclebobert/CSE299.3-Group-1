import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'node:fs';
import { initInspectorBlochView, projectBloch } from '../../src/ui/inspector-bloch-view.js';

function source() {
  return readFileSync(new URL('../../src/ui/inspector-bloch-view.js', import.meta.url), 'utf8');
}

test('inspector-bloch-view imports theme from ./theme.js', () => {
  ok(/^import \{ theme \} from '\.\/theme\.js';$/m.test(source()), 'inspector-bloch-view.js must import theme from ./theme.js');
});

test('inspector-bloch-view imports entropyColor and fmt from ./inspector-state-view.js', () => {
  ok(/^import \{ entropyColor, fmt \} from '\.\/inspector-state-view\.js';$/m.test(source()), 'must import entropyColor and fmt from ./inspector-state-view.js');
});

test('inspector-bloch-view exports initInspectorBlochView and projectBloch', () => {
  const src = source();
  ok(/^export function initInspectorBlochView\(/m.test(source()), 'must export initInspectorBlochView');
  ok(/^export function projectBloch\(/m.test(source()), 'must export projectBloch');
  ok(/return \{ renderBloch \};/.test(src), 'must return renderBloch');
});

const CX = 130;
const CY = 130;
const R = 100;
const DEPTH_OFFSET = R * 0.35;

test('bloch projection includes y depth offset for |i> state', () => {
  const { tx, ty } = projectBloch({ x: 0, y: 1, z: 0 }, CX, CY, R);
  strictEqual(tx - CX, DEPTH_OFFSET, '|i> tx includes positive y depth offset');
  strictEqual(ty, CY, '|i> ty unaffected by y (z == 0)');
});

test('bloch projection uses opposite y depth offset for |-i> state', () => {
  const { tx, ty } = projectBloch({ x: 0, y: -1, z: 0 }, CX, CY, R);
  strictEqual(tx - CX, -DEPTH_OFFSET, '|-i> tx includes negative y depth offset');
  strictEqual(ty, CY, '|-i> ty unaffected by y (z == 0)');
});

test('bloch projection depth offsets are symmetric for |i> vs |-i>', () => {
  const i = projectBloch({ x: 0, y: 1, z: 0 }, CX, CY, R);
  const negI = projectBloch({ x: 0, y: -1, z: 0 }, CX, CY, R);
  strictEqual(i.tx - CX, -(negI.tx - CX), 'depth offsets are equal and opposite');
});

test('bloch projection still maps x and z for cardinal states', () => {
  const plusX = projectBloch({ x: 1, y: 0, z: 0 }, CX, CY, R);
  strictEqual(plusX.tx - CX, R, '+x maps to full radius horizontally');
  const plusZ = projectBloch({ x: 0, y: 0, z: 1 }, CX, CY, R);
  strictEqual(plusZ.ty, CY - R, '+z maps up by full radius');
  const minusZ = projectBloch({ x: 0, y: 0, z: -1 }, CX, CY, R);
  strictEqual(minusZ.ty, CY + R, '-z maps down by full radius');
});

test('initInspectorBlochView returns renderBloch', () => {
  const app = { numQubits: 1, bloch: () => ({ x: 0, y: 0, z: 1 }), linearEntropy: () => 0 };
  const inspectorEl = { innerHTML: '', appendChild() {} };
  const view = initInspectorBlochView(app, inspectorEl);
  ok(typeof view.renderBloch === 'function', 'exposes renderBloch');
});
