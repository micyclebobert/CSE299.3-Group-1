import { theme, themeCssVariables } from '../main.js';
import { AppController } from './AppController.js';
import { panelModel, history, interaction, catalog, Inspector, Debugger, DebuggerUI, AIBuilderUI, IOAnalyzerUI, AIExplainer, SparseSummary, cache } from '../main.js';
import { initCanvasRenderer } from './canvas-renderer.js';
import { initInspectorTabsView } from './inspector-tabs-view.js';
import { initInspectorStateView } from './inspector-state-view.js';
import { initInspectorBlochView } from './inspector-bloch-view.js';
import { initInspectorHistogramView } from './inspector-histogram-view.js';
import { initDebuggerView } from './debugger-view.js';
import { initCodeView } from './code-view.js';
import { initAIExplainerView } from './ai-explainer-view.js';
import { initAIBuilderView } from './ai-builder-view.js';
import { initIOAnalyzerView } from './io-analyzer-view.js';
import { initPlacementView } from './placement-view.js';
import { initPanelView } from './panel-view.js';

for (const [name, value] of Object.entries(themeCssVariables)) {
  document.documentElement.style.setProperty(name, value);
}

const canvas = document.getElementById('circuit');
const ctx = canvas && canvas.getContext('2d');

const app = new AppController({
  history, interaction, catalog, theme: theme, Inspector,
  Debugger, DebuggerUI,
  AIBuilderUI, IOAnalyzerUI,
  cache,
  canvasEl: canvas,
  paletteEl: document.getElementById('gate-palette'),
  inspectorEl: document.getElementById('inspector-content'),
  codeEl: document.getElementById('code-view'),
  statusEl: document.getElementById('status'),
});

const inspectorEl = document.getElementById('inspector-content');
const tabStripEl = document.getElementById('tab-strip');
const shotHistEl = document.getElementById('shot-hist');

let renderInspector = () => {};
let updateDebugStep = () => {};
let histogramView = null;

if (inspectorEl && tabStripEl) {
  const stateView = initInspectorStateView(app, inspectorEl);
  const blochView = initInspectorBlochView(app, inspectorEl);
  histogramView = initInspectorHistogramView(app, shotHistEl);
  const tabsView = initInspectorTabsView(app, tabStripEl, inspectorEl, {
    renderState: stateView.renderState,
    renderBloch: blochView.renderBloch,
  });
  renderInspector = tabsView.renderInspector;
}

const stepCurrentEl = document.getElementById('step-current');
const stepTotalEl = document.getElementById('step-total');
const breakpointListEl = document.getElementById('breakpoint-list');

if (Debugger && DebuggerUI && stepCurrentEl && stepTotalEl && breakpointListEl) {
  const { updateDebugStep: u } = initDebuggerView(app, stepCurrentEl, stepTotalEl, breakpointListEl);
  updateDebugStep = u;
}

app.onInspector(() => { renderInspector(); updateDebugStep(); });

if (canvas && ctx) {
  initCanvasRenderer(app, canvas, ctx);
}

const codeEl = document.getElementById('code-view');
if (codeEl) {
  initCodeView(app, codeEl);
}

const aiOutput = document.getElementById('ai-output');
if (AIExplainer && aiOutput) {
  initAIExplainerView(app, aiOutput, AIExplainer, SparseSummary, cache);
}

const aiPromptEl = document.getElementById('ai-prompt');
const builderOutputEl = document.getElementById('builder-output');
if (AIBuilderUI && aiPromptEl && builderOutputEl && codeEl) {
  initAIBuilderView(app, aiPromptEl, builderOutputEl, codeEl, renderInspector);
}

const ioInputRowEl = document.getElementById('io-input-row');
const ioOutputRowEl = document.getElementById('io-output-row');
const ioOutputEl = document.getElementById('io-output');
if (IOAnalyzerUI && ioInputRowEl && ioOutputRowEl && ioOutputEl) {
  initIOAnalyzerView(app, ioInputRowEl, ioOutputRowEl, ioOutputEl);
}

if (canvas) {
  initPlacementView(app, canvas, interaction, { onPlace: () => { renderInspector(); updateDebugStep(); } });
}
initPanelView(panelModel);

const btnSimulate = document.getElementById('btn-simulate');
const btnReset = document.getElementById('btn-reset');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

if (btnSimulate) {
  btnSimulate.addEventListener('click', () => { app.simulate(); app.draw(); renderInspector(); updateDebugStep(); });
}
if (btnReset) {
  btnReset.addEventListener('click', () => { app.reset(); app.draw(); renderInspector(); updateDebugStep(); });
}
if (btnUndo) {
  btnUndo.addEventListener('click', () => { app.undo(); app.draw(); renderInspector(); updateDebugStep(); });
}
if (btnRedo) {
  btnRedo.addEventListener('click', () => { app.redo(); app.draw(); renderInspector(); updateDebugStep(); });
}

const shotsInput = document.getElementById('shots-input');
if (shotsInput) {
  shotsInput.addEventListener('change', (ev) => { app.setShots(ev.target.value); });
}
const btnSample = document.getElementById('btn-sample');
if (btnSample) {
  btnSample.addEventListener('click', () => {
    app.simulate();
    if (histogramView) histogramView.renderShots();
  });
}

app.draw(); renderInspector();
if (codeEl) { codeEl.value = app.serialize(); }
updateDebugStep();

if (location.hash.startsWith('#circuit=')) {
  const encoded = location.hash.slice('#circuit='.length);
  const result = app.decodeURL(encoded);
  if (result.ok) {
    if (codeEl) { codeEl.value = app.serialize(); }
    app.draw(); renderInspector(); updateDebugStep();
  }
  else alert('Failed to load circuit from URL: ' + result.error);
}

window.addEventListener('resize', () => { app.draw(); });
