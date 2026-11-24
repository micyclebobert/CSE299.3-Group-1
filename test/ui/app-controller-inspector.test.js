import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'assert';
import { AppController } from '../../src/ui/AppController.js';
import { History } from '../../src/state/History.js';
import { gateCatalog } from '../../src/editor/gatePalette.js';
import { Interaction } from '../../src/editor/Interaction.js';
import { Inspector } from '../../src/inspector/Inspector.js';

import '../../src/main.js';

function makeElement() {
  const el = {
    textContent: '', className: '', style: {}, dataset: {},
    appendChild(child) { return child; },
    addEventListener() {}, removeEventListener() {}, closest() { return null; }, getContext() { return {}; },
  };
  return el;
}

globalThis.window = { addEventListener() {} };
globalThis.document = { createElement: () => makeElement() };

function buildApp() {
  const canvasEl = makeElement();
  const paletteEl = makeElement();
  const inspectorEl = makeElement();
  const codeEl = makeElement();
  const statusEl = makeElement();
  const interaction = new Interaction();
  const app = new AppController({
    history: new History(), interaction, catalog: gateCatalog(), theme: null,
    Inspector,
    canvasEl, paletteEl, inspectorEl, codeEl, statusEl,
  });
  return { app, interaction, statusEl, canvasEl, paletteEl, inspectorEl, codeEl };
}

test('inspector: probabilities/amplitudes/ketLabels for |00>', () => {
  const { app } = buildApp();
  deepStrictEqual(Array.from(app.probabilities()), [1, 0, 0, 0]);
  deepStrictEqual(app.ketLabels(), ['|00>', '|01>', '|10>', '|11>']);
  const amps = app.amplitudes();
  strictEqual(amps.length, 4);
  strictEqual(amps[0].prob, 1);
});

test('inspector: H creates superposition probabilities', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  const probs = Array.from(app.probabilities());
  ok(Math.abs(probs[0] - 0.5) < 1e-9);
  ok(Math.abs(probs[1] - 0.5) < 1e-9);
  strictEqual(probs[2], 0);
  strictEqual(probs[3], 0);
});

test('inspector: linearEntropy/purityGammas for separable state', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  ok(Math.abs(app.linearEntropy(0)) < 1e-9);
  ok(Math.abs(app.linearEntropy(1)) < 1e-9);
  const gammas = Array.from(app.purityGammas());
  ok(Math.abs(gammas[0]) < 1e-9);
  ok(Math.abs(gammas[1]) < 1e-9);
});

test('inspector: bell state gives maximal linear entropy 0.5', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.placeGateAt(1, 1, 'CNOT');
  app.simulate();
  ok(Math.abs(app.linearEntropy(0) - 0.5) < 1e-9);
  ok(Math.abs(app.linearEntropy(1) - 0.5) < 1e-9);
  const gammas = Array.from(app.purityGammas());
  ok(Math.abs(gammas[0] - 0.5) < 1e-9);
  ok(Math.abs(gammas[1] - 0.5) < 1e-9);
});

test('inspector: bloch vector for |0> is {0,0,1}', () => {
  const { app } = buildApp();
  const v = app.bloch(0);
  ok(Math.abs(v.x) < 1e-9);
  ok(Math.abs(v.y) < 1e-9);
  ok(Math.abs(v.z - 1) < 1e-9);
});

test('inspector: draw calls renderCb with circuit and purity', () => {
  const { app } = buildApp();
  let received = null;
  app.onRender((payload) => { received = payload; });
  app.placeGateAt(0, 0, 'H');
  app.draw();
  ok(received);
  strictEqual(received.circuit, app.currentCircuit);
  deepStrictEqual(Array.from(received.purity), [0, 0]);
});

test('inspector: draw is a no-op without circuit or renderCb', () => {
  const { app } = buildApp();
  app._currentCircuit = null;
  app.draw();
  ok(true);
});

test('controller: getStepTrace returns a safe facade, not the raw mutable trace', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  const facade = app.getStepTrace();
  ok(facade, 'getStepTrace should return a facade');
  strictEqual(typeof facade.step, 'number', 'facade.step should be a number');
  strictEqual(typeof facade.scheduleLength, 'number', 'facade.scheduleLength should be a number');
  strictEqual(typeof facade.numQubits, 'number', 'facade.numQubits should be a number');
  ok(facade.currentState, 'facade.currentState should exist');
  strictEqual(typeof facade.currentState.getRe, 'function', 'currentState should expose getRe');
  strictEqual(typeof facade.currentState.getIm, 'function', 'currentState should expose getIm');
  strictEqual(typeof facade.currentState.probabilities, 'function', 'currentState should expose probabilities');
  strictEqual(typeof facade.seek, 'undefined', 'facade should not expose seek');
  strictEqual(typeof facade.next, 'undefined', 'facade should not expose next');
  strictEqual(typeof facade.reset, 'undefined', 'facade should not expose reset');
  ok(!('getChangedSteps' in facade), 'facade should not expose getChangedSteps');
});

test('controller: getStepTrace returns trace for fresh app', () => {
  const { app } = buildApp();
  const facade = app.getStepTrace();
  ok(facade, 'fresh app should have a step trace');
  strictEqual(facade.numQubits, 2, 'fresh app has 2 qubits');
  strictEqual(facade.step, 0, 'fresh app is at step 0');
});

test('controller: getStateBoundary returns safe state facade', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  const boundary = app.getStateBoundary();
  strictEqual(typeof boundary.step, 'number', 'boundary.step should be a number');
  strictEqual(typeof boundary.totalSteps, 'number', 'boundary.totalSteps should be a number');
  strictEqual(typeof boundary.numQubits, 'number', 'boundary.numQubits should be a number');
  strictEqual(typeof boundary.probabilities, 'object', 'boundary.probabilities should be a Float64Array');
  strictEqual(boundary.probabilities.length, 1 << boundary.numQubits, 'probabilities length matches 2^numQubits');
  let sum = 0;
  for (let i = 0; i < boundary.probabilities.length; i += 1) sum += boundary.probabilities[i];
  ok(Math.abs(sum - 1) < 1e-9, 'probabilities should sum to 1');
  ok(Math.abs(boundary.probabilities[0] - 0.5) < 1e-9, 'prob[0] should be 0.5');
  ok(Math.abs(boundary.probabilities[1] - 0.5) < 1e-9, 'prob[1] should be 0.5');
  strictEqual(boundary.probabilities[2], 0, 'prob[2] should be 0');
  strictEqual(boundary.probabilities[3], 0, 'prob[3] should be 0');
});

test('controller: getStateAtStep returns read-only state at a step', () => {
  const { app } = buildApp();
  app.placeGateAt(0, 0, 'H');
  app.simulate();
  const total = app.getStateBoundary().totalSteps;
  const state0 = app.getStateAtStep(0);
  const stateEnd = app.getStateAtStep(total);
  ok(state0, 'getStateAtStep(0) should return state');
  ok(stateEnd, 'getStateAtStep(total) should return state');
  strictEqual(state0.getRe(0), 1, 'step 0 should be |00>');
  strictEqual(state0.getIm(0), 0, 'step 0 imag should be 0');
  const after = app.getStateBoundary();
  strictEqual(after.step, after.totalSteps, 'trace should remain at end after getStateAtStep');
});

test('controller: setStatus updates status element', () => {
  const { app, statusEl } = buildApp();
  app.setStatus('Test status message');
  strictEqual(statusEl.textContent, 'Test status message');
});
