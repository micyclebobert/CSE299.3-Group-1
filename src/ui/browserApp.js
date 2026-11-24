import { theme, themeCssVariables } from '../main.js';
import { AppController } from './AppController.js';
import { panelModel, history, interaction, catalog, Inspector, Debugger, DebuggerUI, AIBuilderUI, IOAnalyzerUI, AIExplainer, SparseSummary, cache } from '../main.js';
import { PANEL_LEFT, PANEL_MAIN, PANEL_RIGHT, PANEL_BOTTOM } from './panels.js';
import { initCanvasRenderer } from './canvasRenderer.js';
import { initInspectorTabsView } from './inspectorTabsView.js';
import { initInspectorStateView } from './inspectorStateView.js';
import { initInspectorBlochView } from './inspectorBlochView.js';
import { initInspectorHistogramView } from './inspectorHistogramView.js';
import { initDebuggerView } from './debuggerView.js';
import { initAIExplainerView } from './aiExplainerView.js';
import { initAIBuilderView } from './aiBuilderView.js';
import { initPlacementView } from './placementView.js';
import { initPanelView } from './panelView.js';
import { flattenCircuit } from '../circuit/Flatten.js';
import { Serializer } from '../circuit/Serializer.js';

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

const viewRefs = {
  renderInspector: () => {},
  updateDebugStep: () => {},
  histogramView: null,
};

if (inspectorEl && tabStripEl) {
  const stateView = initInspectorStateView(app, inspectorEl);
  const blochView = initInspectorBlochView(app, inspectorEl);
  viewRefs.histogramView = initInspectorHistogramView(app, inspectorEl);
  const tabsView = initInspectorTabsView(app, tabStripEl, inspectorEl, {
    renderState: stateView.renderState,
    renderBloch: blochView.renderBloch,
    renderHistogram: viewRefs.histogramView.renderShots,
  });
  viewRefs.renderInspector = tabsView.renderInspector;
}

const stepCurrentEl = document.getElementById('step-current');
const stepTotalEl = document.getElementById('step-total');
const breakpointListEl = document.getElementById('breakpoint-list');

if (Debugger && DebuggerUI && stepCurrentEl && stepTotalEl && breakpointListEl) {
  const { updateDebugStep: u } = initDebuggerView(app, stepCurrentEl, stepTotalEl, breakpointListEl);
  viewRefs.updateDebugStep = u;
}

app.onInspector(() => { viewRefs.renderInspector(); viewRefs.updateDebugStep(); });

if (canvas && ctx) {
  initCanvasRenderer(app, canvas, ctx);
}

const codeEl = document.getElementById('code-view');
if (codeEl) {
  app.onCode(() => { codeEl.value = app.serialize(); });

  codeEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      const result = app.deserialize(codeEl.value);
      if (result.ok) {
        app.draw();
        app.notify();
        setShareUrl(app);
        setExportCode(app);
      } else {
        app.setStatus('Invalid JSON: ' + result.error);
      }
    }
  });

  codeEl.addEventListener('input', () => {
    try {
      JSON.parse(codeEl.value);
      app.setStatus('Valid JSON.');
    } catch {
      app.setStatus('Invalid JSON — fix before applying.');
    }
  });
}

const aiOutput = document.getElementById('ai-output');
if (AIExplainer && SparseSummary && aiOutput) {
  initAIExplainerView(app, aiOutput, AIExplainer, SparseSummary, cache);
}

const aiPromptEl = document.getElementById('ai-prompt');
const builderOutputEl = document.getElementById('builder-output');
const builderConfirmEl = document.getElementById('builder-confirm');
if (AIBuilderUI && aiPromptEl && builderOutputEl && codeEl) {
  initAIBuilderView(app, aiPromptEl, builderOutputEl, codeEl, viewRefs.renderInspector);
}

const ioInputRowEl = document.getElementById('io-input-row');
const ioOutputRowEl = document.getElementById('io-output-row');
const ioOutputEl = document.getElementById('io-output');
if (IOAnalyzerUI && ioInputRowEl && ioOutputRowEl && ioOutputEl) {
  initIOAnalyzerViewMultiRow(app, ioInputRowEl, ioOutputRowEl, ioOutputEl);
}

if (canvas) {
  initPlacementView(app, canvas, interaction, { onPlace: () => { viewRefs.renderInspector(); viewRefs.updateDebugStep(); setShareUrl(app); setExportCode(app); updatePaletteSelection(); } });
}
initPanelView(panelModel);

const BREAKPOINT_MAX = 900;
const narrowMQ = typeof window.matchMedia === 'function' ? window.matchMedia(`(max-width: ${BREAKPOINT_MAX}px)`) : { matches: false, addEventListener() {}, removeEventListener() {} };

let scale = 1;
let panX = 0;
let panY = 0;
const ZOOM_STEP = 0.2;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

function viewportForApp() {
  const rect = (document.getElementById('app') || {}).getBoundingClientRect || {};
  const w = rect.width || 1200;
  const h = rect.height || 800;
  return { x: 0, y: 0, w, h };
}

function applyLayout() {
  const appEl = document.getElementById('app');
  if (!appEl) return;
  const vp = viewportForApp();
  const isNarrow = narrowMQ.matches;
  if (isNarrow) {
    appEl.style.gridTemplateColumns = '';
    appEl.style.gridTemplateRows = '';
  } else {
    const layout = panelModel.applyLayoutRects(vp);
    appEl.style.gridTemplateColumns = layout.gridTemplateColumns;
    appEl.style.gridTemplateRows = layout.gridTemplateRows;
  }
  for (const id of [PANEL_LEFT, PANEL_MAIN, PANEL_RIGHT, PANEL_BOTTOM]) {
    const panel = document.getElementById('panel-' + id);
    const region = panelModel.getRegion(id);
    if (panel && region) {
      panel.style.display = region.visible ? 'flex' : 'none';
    }
  }
  app.draw();
}

function updatePaletteSelection() {
  const paletteEl = document.getElementById('gate-palette');
  const selected = app.getSelectedEntry();
  const selectedName = selected ? selected.name : null;
  if (!paletteEl) return;
  for (const btn of paletteEl.querySelectorAll('button[data-name]')) {
    btn.classList.toggle('selected', btn.dataset.name === selectedName);
  }
}

function applyZoomPan() {
  if (!canvas) return;
  canvas.style.transformOrigin = '0 0';
  canvas.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`;
}

function zoomAt(delta, clientX, clientY) {
  const next = Math.min(Math.max(scale + delta, MIN_SCALE), MAX_SCALE);
  if (next === scale) return;
  const rect = canvas.getBoundingClientRect();
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  panX = panX - (cx * (next - scale) / scale);
  panY = panY - (cy * (next - scale) / scale);
  scale = next;
  applyZoomPan();
  app.draw();
}

const ghostEl = document.createElement('div');
ghostEl.id = 'drag-ghost';
ghostEl.style.position = 'absolute';
ghostEl.style.pointerEvents = 'none';
ghostEl.style.display = 'none';
ghostEl.style.border = '2px dashed var(--simqc-accent)';
ghostEl.style.background = 'rgba(77, 170, 252, 0.15)';
ghostEl.style.width = '76px';
ghostEl.style.height = '44px';
ghostEl.style.zIndex = '50';
document.getElementById('app').appendChild(ghostEl);

const dropEl = document.createElement('div');
dropEl.id = 'drop-target';
dropEl.style.position = 'absolute';
dropEl.style.pointerEvents = 'none';
dropEl.style.display = 'none';
dropEl.style.border = '2px solid var(--simqc-danger)';
dropEl.style.background = 'rgba(244, 135, 113, 0.15)';
dropEl.style.zIndex = '49';
document.getElementById('app').appendChild(dropEl);

const PHASE_IDLE = 'idle';

function updateDragFeedback() {
  const phase = interaction.phase;
  if (phase === PHASE_IDLE) {
    ghostEl.style.display = 'none';
    dropEl.style.display = 'none';
    interaction.releasePointerCapture();
    return;
  }
  const p = interaction.pointer;
  const go = interaction.ghostOffset;
  ghostEl.style.display = 'block';
  ghostEl.style.left = (p.x + go.x) + 'px';
  ghostEl.style.top = (p.y + go.y) + 'px';
  const dt = interaction.dropTarget;
  if (dt && dt.column >= 0 && dt.row >= 0) {
    const rect = canvas.getBoundingClientRect();
    const appRect = document.getElementById('app').getBoundingClientRect();
    const lx = 80 + dt.column * 80 - appRect.left;
    const ty = 20 + dt.row * 48 - appRect.top;
    dropEl.style.display = 'block';
    dropEl.style.left = lx + 'px';
    dropEl.style.top = ty + 'px';
    dropEl.style.width = '76px';
    dropEl.style.height = '44px';
    dropEl.style.borderColor = dt.conflict ? 'var(--simqc-danger)' : 'var(--simqc-success)';
    dropEl.style.background = dt.conflict ? 'rgba(244, 135, 113, 0.2)' : 'rgba(137, 209, 133, 0.2)';
  } else {
    dropEl.style.display = 'none';
  }
}

if (canvas) {
  canvas.addEventListener('pointerdown', (ev) => {
    interaction.capturePointer();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (interaction.phase !== PHASE_IDLE) {
      interaction.drag(ev.offsetX, ev.offsetY);
      const cell = interaction.snap(ev.offsetX, ev.offsetY, { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 });
      interaction.setDropTargetConflict(false);
    }
    updateDragFeedback();
  });
  canvas.addEventListener('pointerup', () => {
    interaction.releasePointerCapture();
    updateDragFeedback();
  });
  canvas.addEventListener('pointercancel', () => {
    interaction.releasePointerCapture();
    interaction.cancel();
    updateDragFeedback();
  });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const delta = ev.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomAt(delta, ev.clientX, ev.clientY);
  }, { passive: false });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === '=' || ev.key === '+') { ev.preventDefault(); zoomAt(ZOOM_STEP, 0, 0); }
    else if (ev.key === '-') { ev.preventDefault(); zoomAt(-ZOOM_STEP, 0, 0); }
    else if (ev.key === '0') { ev.preventDefault(); scale = 1; panX = 0; panY = 0; applyZoomPan(); app.draw(); }
  });
}

const btnSimulate = document.getElementById('btn-simulate');
const btnReset = document.getElementById('btn-reset');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');

if (btnSimulate) {
  btnSimulate.addEventListener('click', () => { app.simulate(); app.draw(); viewRefs.renderInspector(); viewRefs.updateDebugStep(); setShareUrl(app); setExportCode(app); });
}
if (btnReset) {
  btnReset.addEventListener('click', () => { app.reset(); app.draw(); viewRefs.renderInspector(); viewRefs.updateDebugStep(); setShareUrl(app); setExportCode(app); });
}
if (btnUndo) {
  btnUndo.addEventListener('click', () => { app.undo(); app.draw(); viewRefs.renderInspector(); viewRefs.updateDebugStep(); setShareUrl(app); setExportCode(app); });
}
if (btnRedo) {
  btnRedo.addEventListener('click', () => { app.redo(); app.draw(); viewRefs.renderInspector(); viewRefs.updateDebugStep(); setShareUrl(app); setExportCode(app); });
}

const shotsInput = document.getElementById('shots-input');
if (shotsInput) {
  shotsInput.addEventListener('change', (ev) => {
    const shots = Number(ev.target.value);
    if (!Number.isFinite(shots) || shots < 1) {
      app.setStatus(`Invalid shots value "${ev.target.value}". Keeping ${app.shots}.`);
      return;
    }
    app.setShots(Math.floor(shots));
  });
}
const btnSample = document.getElementById('btn-sample');
if (btnSample) {
  btnSample.addEventListener('click', () => {
    app.simulate();
  });
}

const btnCopy = document.getElementById('btn-copy');
const copyFeedback = document.getElementById('copy-feedback');
if (btnCopy && codeEl) {
  btnCopy.addEventListener('click', () => {
    codeEl.select();
    try {
      document.execCommand('copy');
      if (copyFeedback) copyFeedback.textContent = 'Copied to clipboard.';
      setTimeout(() => { if (copyFeedback) copyFeedback.textContent = ''; }, 2000);
    } catch (err) {
      app.setStatus('Copy failed: ' + err.message);
    }
  });
}

const btnImport = document.getElementById('btn-import');
if (btnImport && codeEl) {
  btnImport.addEventListener('click', () => {
    const importEl = document.getElementById('import-textarea');
    if (importEl) {
      const input = importEl.value.trim();
      if (!input) {
        app.setStatus('Import field is empty.');
        return;
      }
      const result = app.deserialize(input);
      if (result.ok) {
        codeEl.value = app.serialize();
        app.draw();
        app.notify();
        setShareUrl(app);
        setExportCode(app);
        app.setStatus('Circuit imported from text.');
      } else {
        app.setStatus('Import failed: ' + result.error);
      }
    }
  });
}

const btnExport = document.getElementById('btn-export');
if (btnExport && codeEl) {
  btnExport.addEventListener('click', () => {
    const blob = new Blob([app.serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circuit.simqc.json';
    a.click();
    URL.revokeObjectURL(url);
    app.setStatus('Circuit downloaded as circuit.simqc.json.');
  });
}

const btnShare = document.getElementById('btn-share');
const shareUrlEl = document.getElementById('share-url');
const btnCopyShare = document.getElementById('btn-copy-share-url');
function setShareUrl(appInstance) {
  if (!shareUrlEl) return;
  const encoded = appInstance.encodeURL();
  if (encoded) {
    shareUrlEl.value = location.origin + location.pathname + '#circuit=' + encoded;
  } else {
    shareUrlEl.value = '';
  }
}
if (btnShare && codeEl) {
  btnShare.addEventListener('click', () => {
    const encoded = app.encodeURL();
    if (encoded) {
      shareUrlEl.value = location.origin + location.pathname + '#circuit=' + encoded;
      app.setStatus('Share URL ready in the Compressed URL tab.');
    } else {
      app.setStatus('Unable to generate share URL.');
    }
  });
}
if (btnCopyShare && shareUrlEl) {
  btnCopyShare.addEventListener('click', () => {
    shareUrlEl.select();
    try {
      document.execCommand('copy');
      if (copyFeedback) copyFeedback.textContent = 'Share URL copied to clipboard.';
      setTimeout(() => { if (copyFeedback) copyFeedback.textContent = ''; }, 2000);
    } catch (err) {
      app.setStatus('Copy failed: ' + err.message);
    }
  });
}

const filePicker = document.getElementById('file-picker');
const btnImportFile = document.getElementById('btn-import-file');
const importFeedback = document.getElementById('import-feedback');
if (btnImportFile && filePicker) {
  btnImportFile.addEventListener('click', () => {
    const file = filePicker.files[0];
    if (!file) {
      app.setStatus('No file selected.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const result = app.deserialize(text);
      if (result.ok) {
        codeEl.value = app.serialize();
        app.draw();
        app.notify();
        setShareUrl(app);
        setExportCode(app);
        app.setStatus(`Imported ${file.name}.`);
        if (importFeedback) importFeedback.textContent = `Imported ${file.name}.`;
        setTimeout(() => { if (importFeedback) importFeedback.textContent = ''; }, 3000);
      } else {
        app.setStatus('Import failed: ' + result.error);
        if (importFeedback) importFeedback.textContent = 'Import failed: ' + result.error;
        setTimeout(() => { if (importFeedback) importFeedback.textContent = ''; }, 3000);
      }
    };
    reader.onerror = () => {
      app.setStatus('File read error.');
    };
    reader.readAsText(file);
  });
}

const exportedCodeEl = document.getElementById('exported-code-view');
function setExportCode(appInstance) {
  if (!exportedCodeEl) return;
  const instructions = flattenCircuit(appInstance.currentCircuit);
  const json = Serializer.toJson(appInstance.currentCircuit);
  const code = `// SimQC exported circuit\nconst circuit = ${json};\nconst instructions = ${JSON.stringify(instructions, null, 2)};\n`;
  exportedCodeEl.value = code;
}

const tabStrip = document.getElementById('code-ai-tab-strip');
function activateTab(stripId, target) {
  const strip = document.getElementById(stripId);
  if (!strip) return;
  for (const t of strip.querySelectorAll('.tab')) {
    const active = t.dataset.tab === target;
    t.classList.toggle('active', t.dataset.tab === target);
    t.setAttribute('aria-selected', t.dataset.tab === target ? 'true' : 'false');
    t.setAttribute('tabindex', t.dataset.tab === target ? '0' : '-1');
  }
  for (const content of document.querySelectorAll('.tab-content')) {
    const isActive = content.id === 'tab-' + target;
    content.classList.toggle('active', isActive);
    content.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive) {
      if (target === 'share-url') setShareUrl(app);
      if (target === 'exported-code') setExportCode(app);
    }
  }
}
if (tabStrip) {
  tabStrip.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (!tab) return;
    activateTab('code-ai-tab-strip', tab.dataset.tab);
  });
  tabStrip.addEventListener('keydown', (ev) => {
    const tabs = [...tabStrip.querySelectorAll('.tab')];
    const index = tabs.indexOf(ev.target);
    if (index === -1) return;
    let next = index;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = tabs.length - 1;
    else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      tabs[index].click();
      return;
    }
    if (next !== index) {
      ev.preventDefault();
      tabs[next].focus();
    }
  });
}

const inspectorTabStrip = document.getElementById('tab-strip');
if (inspectorTabStrip) {
  inspectorTabStrip.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab');
    if (!tab) return;
    activateTab('tab-strip', tab.dataset.tab);
  });
  inspectorTabStrip.addEventListener('keydown', (ev) => {
    const tabs = [...inspectorTabStrip.querySelectorAll('.tab')];
    const index = tabs.indexOf(ev.target);
    if (index === -1) return;
    let next = index;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = tabs.length - 1;
    else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      tabs[index].click();
      return;
    }
    if (next !== index) {
      ev.preventDefault();
      tabs[next].focus();
    }
  });
}

const LS_KEY = 'simqc-circuit-v1';

function saveToLocalStorage() {
  try {
    const payload = { circuit: app.serialize(), numQubits: app.numQubits };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    app.setStatus('Circuit saved to localStorage.');
  } catch (err) {
    app.setStatus('localStorage save failed: ' + err.message);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      app.setStatus('No saved circuit in localStorage.');
      return;
    }
    const payload = JSON.parse(raw);
    const result = app.deserialize(payload.circuit);
    if (result.ok) {
      codeEl.value = app.serialize();
      app.draw();
      app.notify();
      setShareUrl(app);
      setExportCode(app);
      app.setStatus('Circuit loaded from localStorage.');
    } else {
      app.setStatus('localStorage load failed: ' + result.error);
    }
  } catch (err) {
    app.setStatus('localStorage load failed: ' + err.message);
  }
}

function resetLocalStorage() {
  try {
    localStorage.removeItem(LS_KEY);
    app.setStatus('localStorage cleared.');
  } catch (err) {
    app.setStatus('localStorage clear failed: ' + err.message);
  }
}

const btnLsSave = document.getElementById('btn-localstorage-save');
const btnLsLoad = document.getElementById('btn-localstorage-load');
const btnLsReset = document.getElementById('btn-localstorage-reset');
if (btnLsSave) btnLsSave.addEventListener('click', saveToLocalStorage);
if (btnLsLoad) btnLsLoad.addEventListener('click', loadFromLocalStorage);
if (btnLsReset) btnLsReset.addEventListener('click', () => {
  resetLocalStorage();
  app.reset();
  app.draw();
  viewRefs.renderInspector();
  viewRefs.updateDebugStep();
  if (codeEl) codeEl.value = app.serialize();
  setShareUrl(app);
  setExportCode(app);
  app.setStatus('Circuit reset.');
});

function initFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const payload = JSON.parse(raw);
      const result = app.deserialize(payload.circuit);
      if (result.ok) {
        if (codeEl) { codeEl.value = app.serialize(); }
        app.setStatus('Circuit restored from localStorage.');
      }
    }
  } catch {
  }
}
initFromLocalStorage();

function loadHashCircuit() {
  if (location.hash.startsWith('#circuit=')) {
    const encoded = location.hash.slice('#circuit='.length);
    const result = app.decodeURL(encoded);
    if (result.ok) {
      if (codeEl) { codeEl.value = app.serialize(); }
      app.draw();
      viewRefs.renderInspector();
      viewRefs.updateDebugStep();
      setShareUrl(app);
      setExportCode(app);
    } else {
      app.setStatus('Failed to load circuit from URL: ' + result.error);
    }
  }
}

loadHashCircuit();

window.addEventListener('hashchange', () => {
  loadHashCircuit();
});

window.addEventListener('resize', () => { applyLayout(); });

narrowMQ.addEventListener('change', () => { applyLayout(); });

const paletteEl = document.getElementById('gate-palette');
if (paletteEl) {
  paletteEl.addEventListener('click', () => {
    updatePaletteSelection();
  });
}

for (const btn of document.querySelectorAll('.panel-toggle')) {
  btn.addEventListener('click', () => {
    setTimeout(() => { applyLayout(); updatePaletteSelection(); }, 0);
  });
}

const panelTabs = [PANEL_LEFT, PANEL_MAIN, PANEL_RIGHT, PANEL_BOTTOM];
for (const id of panelTabs) {
  const tab = document.getElementById('tab-' + id);
  if (tab) {
    tab.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        const toggle = document.querySelector('button[data-toggle="' + id + '"]');
        if (toggle) toggle.click();
      }
    });
  }
}

app.draw();
if (codeEl) { codeEl.value = app.serialize(); }
setShareUrl(app);
setExportCode(app);
applyLayout();
updatePaletteSelection();

function initIOAnalyzerViewMultiRow(appInstance, ioInputRowEl, ioOutputRowEl, ioOutputEl) {
  const ioAnalyzer = appInstance.ioAnalyzer;
  const section = ioOutputEl.parentElement;
  if (ioAnalyzer) {
    ioAnalyzer.onChange((s) => {
      if (s.status === 'error') ioOutputEl.textContent = 'Error: ' + (s.error || '');
      else if (s.status === 'ok' && s.analysis) {
        const a = s.analysis;
        let html = `<div>Input rows: [${a.inputRows.join(', ')}]</div>`;
        html += `<div>Output rows: [${a.outputRows.join(', ')}]</div>`;
        html += `<div>Input affected in ${a.inputAffectedColumns.length} column(s): [${a.inputAffectedColumns.join(', ')}]</div>`;
        html += `<div>Output affected in ${a.outputAffectedColumns.length} column(s): [${a.outputAffectedColumns.join(', ')}]</div>`;
        html += `<div>Touched columns: ${a.touchedColumns.length}</div>`;
        html += `<div>Causal chain: ${a.causalChain.join(' \u2192 ')}</div>`;
        html += `<div>Summary: ${a.summary}</div>`;
        if (s.sparse) html += `<div>Sparse top-k: ${s.sparse.topK.map((t) => t.label).join(', ')}</div>`;
        ioOutputEl.innerHTML = html;
      } else ioOutputEl.textContent = '';
    });

    const boundarySelect = document.createElement('select');
    boundarySelect.id = 'io-state-boundary';
    const finalOpt = document.createElement('option');
    finalOpt.value = 'final';
    finalOpt.textContent = 'Final state';
    const stepOpt = document.createElement('option');
    stepOpt.value = 'step';
    stepOpt.textContent = 'Virtual step';
    boundarySelect.appendChild(finalOpt);
    boundarySelect.appendChild(stepOpt);
    const stepLabel = document.createElement('span');
    stepLabel.textContent = ' step:';
    stepLabel.style.marginLeft = '6px';
    const stepInput = document.createElement('input');
    stepInput.id = 'io-selected-step';
    stepInput.type = 'number';
    stepInput.min = '0';
    stepInput.value = '0';
    stepInput.style.width = '60px';
    stepInput.style.marginLeft = '6px';
    if (section) {
      section.appendChild(boundarySelect);
      section.appendChild(stepLabel);
      section.appendChild(stepInput);
    }

    document.getElementById('btn-analyze').addEventListener('click', () => {
      const inputText = ioInputRowEl.value.trim();
      const outputText = ioOutputRowEl.value.trim();
      let inputRows;
      let outputRows;
      try {
        inputRows = inputText === '' ? [] : inputText.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n));
        outputRows = outputText === '' ? [] : outputText.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n));
      } catch {
        appInstance.setStatus('Invalid row indices.');
        return;
      }
      try {
        ioAnalyzer.setInputRows(inputRows);
        ioAnalyzer.setOutputRows(outputRows);
      } catch (err) {
        appInstance.setStatus(err.message);
        return;
      }
      const stateBoundary = boundarySelect.value;
      const selectedStep = stateBoundary === 'step' ? (parseInt(stepInput.value, 10) || 0) : null;
      const stepTrace = appInstance.getStepTrace();
      const result = ioAnalyzer.analyze(
        flattenCircuit(appInstance.currentCircuit),
        stepTrace,
        {
          state: stepTrace && typeof stepTrace.currentState === 'function' ? stepTrace.currentState() : undefined,
          numQubits: appInstance.numQubits,
          stateBoundary,
          selectedStep,
        }
      ) || {};
      if (result.status === 'error') {
        appInstance.setStatus(`Analysis error: ${result.error || ''}`);
      } else {
        appInstance.setStatus('Analysis complete.');
      }
    });
  } else {
    document.getElementById('btn-analyze').disabled = true;
    ioOutputEl.textContent = 'I/O Analyzer unavailable.';
  }
}
