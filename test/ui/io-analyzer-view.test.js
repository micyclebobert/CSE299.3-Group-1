import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { initIOAnalyzerView } from '../../src/ui/io-analyzer-view.js';
import { Circuit } from '../../src/circuit/Circuit.js';

function makeElement() {
  const listeners = new Map();
  const el = {
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    value: '',
    disabled: false,
    innerHTML: '',
    appendChild(child) {
      return child;
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener() {},
    closest() {
      return null;
    },
  };
  el.listeners = listeners;
  return el;
}

const elements = new Map();
globalThis.window = { addEventListener() {} };
globalThis.document = {
  createElement: () => makeElement(),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  },
};

function buildApp({ ioAnalyzer } = {}) {
  const app = {
    ioAnalyzer,
    currentCircuit: new Circuit({ numQubits: 2, columns: [] }),
    _stepTrace: {},
    numQubits: 2,
    getStepTrace() { return this._stepTrace; },
    setStatus() {},
  };
  return app;
}

test('initIOAnalyzerView wires analyzer when ioAnalyzer is present', () => {
  elements.clear();
  let onChangeCb = null;
  const ioAnalyzer = {
    onChange(cb) {
      onChangeCb = cb;
    },
    setInputRows() {},
    setOutputRows() {},
    analyze() {
      return { summary: 'ok' };
    },
  };
  const app = buildApp({ ioAnalyzer });
  const ioOutput = makeElement();
  const ioInputRow = makeElement();
  const ioOutputRow = makeElement();
  ioInputRow.value = '0';
  ioOutputRow.value = '0';
  initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput);
  strictEqual(ioOutput.style.whiteSpace, 'pre-wrap', 'whiteSpace set to pre-wrap');
  ok(onChangeCb, 'onChange callback registered');
  const btnAnalyze = globalThis.document.getElementById('btn-analyze');
  ok(btnAnalyze.listeners.get('click'), 'click listener registered on btn-analyze');
});

test('initIOAnalyzerView disables analyzer when ioAnalyzer is absent', () => {
  elements.clear();
  const app = buildApp({ ioAnalyzer: undefined });
  const ioOutput = makeElement();
  const ioInputRow = makeElement();
  const ioOutputRow = makeElement();
  initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput);
  const btnAnalyze = globalThis.document.getElementById('btn-analyze');
  strictEqual(btnAnalyze.disabled, true, 'btn-analyze disabled when no ioAnalyzer');
  strictEqual(ioOutput.textContent, 'I/O Analyzer unavailable.', 'unavailable message shown');
});

test('analyze click passes boundary and step options to ioAnalyzer', () => {
  elements.clear();
  let capturedOptions = null;
  const ioAnalyzer = {
    onChange() {},
    setInputRows() {},
    setOutputRows() {},
    analyze(_instrs, _trace, options) { capturedOptions = options; return { status: 'ok' }; },
  };
  const app = buildApp({ ioAnalyzer });
  const ioOutput = makeElement();
  const ioInputRow = makeElement();
  const ioOutputRow = makeElement();
  ioInputRow.value = '0';
  ioOutputRow.value = '0';
  initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput);
  const btn = globalThis.document.getElementById('btn-analyze');
  btn.listeners.get('click')[0]();
  strictEqual(capturedOptions.numQubits, 2, 'numQubits forwarded');
  strictEqual(capturedOptions.selectedStep, null, 'selectedStep null for final boundary');
  ok('stateBoundary' in capturedOptions, 'stateBoundary forwarded');
  ok('state' in capturedOptions, 'state forwarded');
});
