import { encode as urlEncode, decode as urlDecode } from '../circuit/URLCodec.js';
import { evaluate as evaluateLimits, MAX_EPHEMERAL_QUBITS } from '../sim/limits.js';
import { placementMethods } from './app-controller-placement.js';
import { gatesMethods } from './app-controller-gates.js';
import { structureMethods } from './app-controller-structure.js';
import { debuggerMethods } from './app-controller-debugger.js';
import { inspectorMethods } from './app-controller-inspector.js';
import { shotsMethods } from './app-controller-shots.js';
export class AppController {
  constructor({
    history, interaction, catalog, theme, Inspector,
    Debugger, DebuggerUI,
    AIBuilderUI, IOAnalyzerUI,
    canvasEl, paletteEl, inspectorEl, codeEl, statusEl, cache,
  }) {
    this._history = history;
    this._interaction = interaction;
    this._catalog = catalog;
    this._theme = theme;
    this._Inspector = Inspector;
    this._Debugger = Debugger || null;
    this._DebuggerUI = DebuggerUI || null;
    this._AIBuilderUI = AIBuilderUI || null;
    this._IOAnalyzerUI = IOAnalyzerUI || null;
    this._cache = cache || null;
    this._canvasEl = canvasEl;
    this._ctx = canvasEl.getContext('2d');
    this._paletteEl = paletteEl;
    this._inspectorEl = inspectorEl;
    this._codeEl = codeEl;
    this._statusEl = statusEl;
    this._currentCircuit = null;
    this._stepTrace = null;
    this._debugger = null;
    this._debuggerUI = null;
    this._inspector = null;
    this._aiBuilder = null;
    this._ioAnalyzer = null;
    this._shots = 1024;
    this._pointer = { x: 0, y: 0 };
    this._selectedEntry = null;
    this._selectedColumn = null;
    this._selectedRow = null;
    this._renderCb = null;
    this._inspectorCb = null;
    this._codeCb = null;
    this._renderPalette();
    this._bindPalette();
    this._bindCanvas();
    this._bindResize();
    this.resetCircuit(2);
  }
  onRender(cb) { this._renderCb = cb; }
  onInspector(cb) { this._inspectorCb = cb; }
  onCode(cb) { this._codeCb = cb; }
  notify() {
    if (this._renderCb) this._renderCb();
    if (this._inspectorCb) this._inspectorCb();
    if (this._codeCb) this._codeCb();
  }
  refreshDebuggerTimeline() {
    this.notify();
  }
  get currentCircuit() { return this._currentCircuit; }
  getStepTrace() {
    if (!this._stepTrace) return null;
    return {
      step: this._stepTrace.step,
      scheduleLength: this._stepTrace.scheduleLength,
      numQubits: this._stepTrace.numQubits,
      currentState: this._stepTrace.currentState,
    };
  }
  getStateBoundary() {
    if (!this._stepTrace) {
      return { step: 0, totalSteps: 0, numQubits: this.numQubits, probabilities: new Float64Array(0) };
    }
    const state = this._stepTrace.currentState;
    return {
      step: this._stepTrace.step,
      totalSteps: this._stepTrace.scheduleLength,
      numQubits: this._stepTrace.numQubits,
      probabilities: state.probabilities(),
    };
  }
  getStateAtStep(step) {
    if (!this._stepTrace) return null;
    if (!Number.isInteger(step) || step < 0) return null;
    const priorStep = this._stepTrace.step;
    try {
      this._stepTrace.seek(step);
      const state = this._stepTrace.currentState;
      const numQubits = state.numQubits();
      const size = state.size();
      const re = new Float64Array(size);
      const im = new Float64Array(size);
      for (let i = 0; i < size; i += 1) {
        re[i] = state.getRe(i);
        im[i] = state.getIm(i);
      }
      return {
        numQubits() { return numQubits; },
        size() { return size; },
        getRe(i) { return re[i]; },
        getIm(i) { return im[i]; },
        probability(i) { const r = re[i], ii = im[i]; return r * r + ii * ii; },
        probabilities() {
          const out = new Float64Array(size);
          for (let i = 0; i < size; i += 1) { const r = re[i], ii = im[i]; out[i] = r * r + ii * ii; }
          return out;
        },
        normSquared() {
          let sum = 0.0;
          for (let i = 0; i < size; i += 1) { const r = re[i], ii = im[i]; sum += r * r + ii * ii; }
          return sum;
        },
      };
    } finally {
      this._stepTrace.seek(priorStep);
    }
  }
  getQubitLimitStatus(numQubits) {
    const maxQubits = MAX_EPHEMERAL_QUBITS;
    const allowed = Number.isInteger(numQubits) && numQubits >= 1 && numQubits <= maxQubits;
    let advisory = null;
    if (allowed && numQubits >= 15 && numQubits <= maxQubits) {
      const policy = evaluateLimits(numQubits);
      advisory = policy.advisory;
    }
    return { allowed, advisory, maxQubits };
  }
  get numQubits() { return this._currentCircuit ? this._currentCircuit.numQubits : 0; }
  get shots() { return this._shots; }
  get catalog() { return this._catalog; }
  get canUndo() { return this._history.canUndo(); }
  get canRedo() { return this._history.canRedo(); }
  get aiBuilder() { return this._aiBuilder; }
  get ioAnalyzer() { return this._ioAnalyzer; }
  get cache() { return this._cache; }
  get builderNumQubits() { return this._aiBuilder ? this._aiBuilder.numQubits : 0; }
  get debuggerUI() { return this._debuggerUI; }
  get debugger() { return this._debugger; }
  setBuilderNumQubits(numQubits) {
    if (this._aiBuilder) this._aiBuilder.setNumQubits(numQubits);
  }
  undo() {
    const prev = this._history.undo();
    if (prev) {
      this._setCircuit(prev, { record: false });
      this._status('Undo.');
    }
    return prev;
  }
  redo() {
    const next = this._history.redo();
    if (next) {
      this._setCircuit(next, { record: false });
      this._status('Redo.');
    }
    return next;
  }
  getPointer() { return this._pointer; }
  setPointer(x, y) { this._pointer = { x, y }; }
  getSelectedEntry() { return this._selectedEntry; }
  setSelectedEntry(entry) { this._selectedEntry = entry; }
  clearSelection() { this._selectedEntry = null; this._selectedColumn = null; this._selectedRow = null; }
  getSelectedCell() { return this._selectedColumn === null || this._selectedRow === null ? null : { column: this._selectedColumn, row: this._selectedRow }; }
  _renderPalette() {
    this._paletteEl.textContent = '';
    const byCat = new Map();
    for (const entry of this._catalog) {
      if (!byCat.has(entry.category)) byCat.set(entry.category, []);
      byCat.get(entry.category).push(entry);
    }
    for (const [category, entries] of byCat) {
      const h = document.createElement('div');
      h.className = 'panel-title';
      h.textContent = category;
      this._paletteEl.appendChild(h);
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
      row.style.gap = '6px';
      for (const entry of entries) {
        const btn = document.createElement('button');
        btn.textContent = entry.label;
        btn.title = `${entry.category} \u2022 arity ${entry.arity}${
          entry.parameterized ? ` \u2022 \u03b8=${entry.defaultTheta.toFixed(2)}rad` : ''
        }`;
        btn.dataset.name = entry.name;
        row.appendChild(btn);
      }
      this._paletteEl.appendChild(row);
    }
  }
  _bindPalette() {
    this._paletteEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-name]');
      if (!btn) return;
      const name = btn.dataset.name;
      const entry = this._catalog.find((e) => e.name === name);
      if (!entry) return;
      this._selectedEntry = entry;
    });
  }
  _bindCanvas() {
    if (!this._canvasEl) return;
    const move = (ev) => this.setPointer(ev.offsetX ?? 0, ev.offsetY ?? 0);
    this._canvasEl.addEventListener('pointermove', move);
    this._canvasEl.addEventListener('mousemove', move);
  }
  _bindResize() {
    window.addEventListener('resize', () => this.draw());
    this.draw();
  }
  encodeURL() {
    return urlEncode(this.serialize());
  }
  decodeURL(urlSafeBase64) {
    try {
      const json = urlDecode(urlSafeBase64);
      const result = this.deserialize(json);
      return { ok: result.ok, error: result.error };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  _status(msg) { if (this._statusEl) this._statusEl.textContent = msg; }
  setStatus(msg) { this._status(msg); }
}
Object.assign(AppController.prototype, placementMethods, gatesMethods, structureMethods, debuggerMethods, inspectorMethods, shotsMethods);
