import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'node:fs';
import { initInspectorStateView, entropyColor, fmt } from '../../src/ui/inspector-state-view.js';

function source() {
  return readFileSync(new URL('../../src/ui/inspector-state-view.js', import.meta.url), 'utf8');
}

test('inspector-state-view imports theme from ./theme.js', () => {
  ok(/^import \{ theme \} from '\.\/theme\.js';$/m.test(source()), 'inspector-state-view.js must import theme from ./theme.js');
});

test('inspector-state-view exports renderState, renderAmplitudes, renderProbabilities', () => {
  const src = source();
  ok(/^export function initInspectorStateView\(/m.test(source()), 'must export initInspectorStateView');
  ok(/return \{ renderState, renderAmplitudes, renderProbabilities \};/.test(src), 'must return renderState, renderAmplitudes, renderProbabilities');
});

test('entropyColor maps linear entropy to rgb', () => {
  strictEqual(entropyColor(0), 'rgb(0,230,164)', 'pure state is green');
  strictEqual(entropyColor(0.5), 'rgb(215,186,125)', 'maximally entangled is amber');
  strictEqual(entropyColor(0.25), 'rgb(108,208,145)', 'mid entropy interpolates');
});

test('fmt formats to three decimals', () => {
  strictEqual(fmt(1.2346), '1.235');
  strictEqual(fmt(0), '0.000');
  strictEqual(fmt(2.5), '2.500');
});

test('renderState composites amplitudes and probabilities tables', () => {
  const app = {
    amplitudes: () => [{ re: 1, im: 0, prob: 1 }],
    ketLabels: () => ['|0>'],
    probabilities: () => [1],
  };
  const inspectorEl = { innerHTML: '' };
  const view = initInspectorStateView(app, inspectorEl);
  view.renderState();
  ok(inspectorEl.innerHTML.includes('<table'), 'renders tables into inspectorEl');
  ok(inspectorEl.innerHTML.includes('★|0>'), 'includes formatted state label');
  const amps = view.renderAmplitudes();
  const probs = view.renderProbabilities();
  ok(typeof amps === 'string' && amps.includes('<table'), 'renderAmplitudes returns table html');
  ok(typeof probs === 'string' && probs.includes('<table'), 'renderProbabilities returns table html');
});

test('renderAmplitudes includes Phase column', () => {
  const app = {
    amplitudes: () => [{ re: 1, im: 0, prob: 1 }, { re: 0, im: 1, prob: 1 }],
    ketLabels: () => ['|0>', '|1>'],
  };
  const container = { innerHTML: '' };
  const view = initInspectorStateView(app, container);
  const html = view.renderAmplitudes();
  ok(html.includes('<th style="text-align:right;padding:2px;">Phase</th>'), 'Phase column header present');
  ok(html.includes('rad'), 'phase values include rad unit');
  ok(html.includes('0.000rad'), 'zero phase formatted');
  ok(html.includes('1.571rad'), 'pi/2 phase formatted');
});

test('renderState creates chart canvas in container', () => {
  const app = {
    amplitudes: () => [{ re: 1, im: 0, prob: 1 }],
    ketLabels: () => ['|0>'],
    probabilities: () => [1],
  };
  const container = { innerHTML: '' };
  const view = initInspectorStateView(app, container);
  view.renderState();
  ok(container.innerHTML.includes('<canvas'), 'chart canvas markup present in container');
  ok(container.innerHTML.includes('id="simqc-state-vector-chart"'), 'chart canvas id present');
});

test('renderState renders amplitudes table, probabilities table and chart', () => {
  const app = {
    amplitudes: () => [{ re: 1, im: 0, prob: 1 }],
    ketLabels: () => ['|0>'],
    probabilities: () => [1],
  };
  const container = { innerHTML: '' };
  const view = initInspectorStateView(app, container);
  view.renderState();
  ok(container.innerHTML.includes('<table'), 'renders tables');
  ok(container.innerHTML.includes('Probability'), 'probability column present');
  ok(container.innerHTML.includes('<canvas'), 'chart canvas present');
  ok(container.innerHTML.includes('Phase'), 'phase column present');
});
