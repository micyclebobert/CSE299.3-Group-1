import { theme, themeCssVariables } from '../main.js';
import { AppController } from './AppController.js';
import { panelModel, history, interaction, catalog, Inspector, Debugger, DebuggerUI, AIBuilderUI, IOAnalyzerUI, AIExplainer, cache } from '../main.js';
import { initCanvasRenderer } from './canvas-renderer.js';
import { initInspectorView } from './inspector-view.js';
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
const ctx = canvas.getContext('2d');

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
const { renderInspector } = initInspectorView(app, inspectorEl);
const { updateDebugStep } = initDebuggerView(app, document.getElementById('step-current'), document.getElementById('step-total'));

initCanvasRenderer(app, canvas, ctx);
initCodeView(app, document.getElementById('code-view'));
initAIExplainerView(app, document.getElementById('ai-output'), AIExplainer, cache);
const codeEl = document.getElementById('code-view');
initAIBuilderView(app, document.getElementById('ai-prompt'), document.getElementById('builder-output'), codeEl, renderInspector);
initIOAnalyzerView(app, document.getElementById('io-input-row'), document.getElementById('io-output-row'), document.getElementById('io-output'));
initPlacementView(app, canvas, interaction, { onPlace: () => { renderInspector(); updateDebugStep(); } });
initPanelView(panelModel);

document.getElementById('btn-simulate').addEventListener('click', () => { app.simulate(); app.draw(); renderInspector(); updateDebugStep(); });
document.getElementById('btn-reset').addEventListener('click', () => { app.reset(); app.draw(); renderInspector(); updateDebugStep(); });
document.getElementById('btn-undo').addEventListener('click', () => { app.undo(); app.draw(); renderInspector(); updateDebugStep(); });
document.getElementById('btn-redo').addEventListener('click', () => { app.redo(); app.draw(); renderInspector(); updateDebugStep(); });

app.draw(); renderInspector(); codeEl.value = app.serialize(); updateDebugStep();

if (location.hash.startsWith('#circuit=')) {
  const encoded = location.hash.slice('#circuit='.length);
  const result = app.decodeURL(encoded);
  if (result.ok) { codeEl.value = app.serialize(); app.draw(); renderInspector(); updateDebugStep(); }
  else alert('Failed to load circuit from URL: ' + result.error);
}

window.addEventListener('resize', () => { app.draw(); });
