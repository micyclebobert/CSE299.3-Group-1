// src/ui/AppController.js
// Browser application state/controller layer.
// Owns mutable app state and coordinates circuit edits, simulation,
// Inspector readouts, Code&AI JSON serialization, and canvas rendering.
import { Circuit } from '../circuit/Circuit.js';
import { Gate, GateColumn } from '../circuit/GateColumn.js';
import { Serializer } from '../circuit/Serializer.js';
import { encode as _urlEncode, decode as _urlDecode } from '../circuit/URLCodec.js';
const URLCodec = { encode: _urlEncode, decode: _urlDecode };
import { flattenCircuit, scheduleColumns } from '../circuit/Flatten.js';
import { StepTrace } from '../sim/StepTrace.js';
import { evaluate as evaluateLimits, MAX_EPHEMERAL_QUBITS } from '../sim/limits.js';
import { StateVector } from '../core/StateVector.js';
import { collapse, sampleHistogram } from '../measurement/measurement.js';
import { gateControlCount, gateNeedsTarget2 } from '../editor/gatePalette.js';
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
    // Refresh debugger timeline/breakpoint presentation after any circuit
    // replacement; triggers the DOM layer to re-read controller state.
    this.notify();
  }
  get currentCircuit() { return this._currentCircuit; }
  getStepTrace() { return this._stepTrace; }
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
  resetCircuit(numQubits = 2) {
    const limitStatus = this.getQubitLimitStatus(numQubits);
    if (!limitStatus.allowed) {
      this._status(`Qubit count ${numQubits} exceeds browser limit of ${limitStatus.maxQubits}. Circuit not created.`);
      return;
    }
    const circuit = new Circuit({ numQubits, columns: [] });
    this._setCircuit(circuit);
    if (this._AIBuilderUI) this._aiBuilder = new this._AIBuilderUI({ numQubits, cache: this._cache });
    if (this._IOAnalyzerUI) this._ioAnalyzer = new this._IOAnalyzerUI({ numQubits, cache: this._cache });
    this._syncAuxQubitCounts(circuit);
    if (limitStatus.advisory) {
      this._status(limitStatus.advisory);
    } else {
      this._status('Ready. Click a palette gate to place it on the canvas.');
    }
  }
  _setCircuit(circuit, { record = true } = {}) {
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('AppController expects a Circuit instance');
    }
    const previousBreakpoints = this.getBreakpoints();
    this._currentCircuit = circuit;
    const instructions = flattenCircuit(circuit);
    const schedule = scheduleColumns(instructions);
    this._stepTrace = new StepTrace(schedule, circuit.numQubits);
    if (this._Inspector) {
      this._inspector = new this._Inspector(this._stepTrace);
    }
    if (this._Debugger) {
      this._debugger = new this._Debugger(this._stepTrace);
      this._debuggerUI = new this._DebuggerUI(this._debugger);
      this._debuggerUI.onStepChange(() => this.notify());
      previousBreakpoints.forEach((col) => this.addBreakpoint(col));
    }
    if (record) this._history.push(circuit);
    this.refreshDebuggerTimeline();
  }
  encodeURL() {
    return URLCodec.encode(this.serialize());
  }
  decodeURL(urlSafeBase64) {
    try {
      const json = URLCodec.decode(urlSafeBase64);
      const result = this.deserialize(json);
      return { ok: result.ok, error: result.error };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  placeGateAt(column, row, gateName) {
    const limitStatus = this.getQubitLimitStatus(this.numQubits);
    if (!limitStatus.allowed) {
      this._status(`Qubit count ${this.numQubits} exceeds browser limit of ${limitStatus.maxQubits}.`);
      return { conflict: true, reason: 'qubit limit exceeded' };
    }
    const entry = this._catalog.find((e) => e.name === gateName);
    if (!entry) return { conflict: true, reason: 'unknown gate' };
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    if (!Number.isFinite(column) || !Number.isInteger(column) || !Number.isFinite(row) || !Number.isInteger(row) || column < 0 || row < 0 || row >= n) {
      this._status(`Invalid placement coordinates column=${column} row=${row}.`);
      return { conflict: true, reason: 'coordinate out of range' };
    }
    const result = this._tryPlace(entry, column, row);
    if (result.conflict) return { conflict: true, reason: result.reason };
    return { conflict: false };
  }
  placeGateFromCell(cell, entry, { onPlace = () => {} } = {}) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    const { column, row } = cell;
    if (!Number.isInteger(column) || column < 0 || !Number.isInteger(row) || row < 0 || row >= n) {
      this._status(`Invalid placement coordinates column=${column} row=${row}.`);
      return { conflict: true, reason: 'coordinate out of range' };
    }
    this._interaction.snap(cell.x, cell.y, { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 });
    const result = this._interaction.drop(circuit, { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20, column, row });
    if (result.conflict) {
      this._status(result.reason);
      return { conflict: true, reason: result.reason };
    }
    this._setCircuit(result.circuit);
    this.draw();
    onPlace();
    return { conflict: false };
  }
  getPointer() { return this._pointer; }
  setPointer(x, y) { this._pointer = { x, y }; }
  getSelectedEntry() { return this._selectedEntry; }
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
  _tryPlace(entry, column, row) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    const existing = circuit.columns[column] ?? null;
    const usedRows = new Set();
    if (existing) {
      for (const g of existing.gates) {
        usedRows.add(g.target);
        if (g.target2 !== undefined) usedRows.add(g.target2);
        for (const c of g.controls) usedRows.add(c.row);
      }
    }
    if (usedRows.has(row)) return { circuit: null, conflict: true, reason: 'row occupied in column' };
    usedRows.add(row);
    const controlsNeeded = gateControlCount(entry.name);
    const needsTarget2 = gateNeedsTarget2(entry.name);
    const extraNeeded = controlsNeeded + (needsTarget2 ? 1 : 0);
    let freeCount = 0;
    for (let r = 0; r < n; r += 1) if (!usedRows.has(r)) freeCount += 1;
    if (freeCount < extraNeeded) return { circuit: null, conflict: true, reason: 'insufficient free rows for gate arity' };
    const controls = [];
    for (let r = 0; r < n && controls.length < controlsNeeded; r += 1) {
      if (usedRows.has(r)) continue;
      controls.push({ row: r, on: true });
      usedRows.add(r);
    }
    let target2 = undefined;
    if (needsTarget2) {
      for (let r = 0; r < n; r += 1) {
        if (usedRows.has(r)) continue;
        target2 = r;
        usedRows.add(r);
        break;
      }
    }
    let thetaRad = undefined;
    if (entry.parameterized && entry.defaultTheta !== undefined) thetaRad = entry.defaultTheta;
    const gate = new Gate({ name: entry.name, target: row, target2, thetaRad, controls });
    const nextColumns = [...circuit.columns];
    const nextColumn = existing
      ? new GateColumn({ gates: [...existing.gates, gate] })
      : new GateColumn({ gates: [gate] });
    while (nextColumns.length < column) nextColumns.push(new GateColumn({ gates: [] }));
    nextColumns[column] = nextColumn;
    const nextCircuit = new Circuit({ numQubits: circuit.numQubits, columns: nextColumns });
    this._setCircuit(nextCircuit);
    return { circuit: nextCircuit, conflict: false };
  }
  applyCircuit(circuit) {
    this._setCircuit(circuit);
    this._syncAuxQubitCounts(circuit);
    this._status('AI Builder circuit applied to editor.');
  }
  setBuilderNumQubits(numQubits) {
    if (this._aiBuilder) this._aiBuilder.setNumQubits(numQubits);
  }
  _syncAuxQubitCounts(circuit) {
    if (this._aiBuilder) this._aiBuilder.setNumQubits(circuit.numQubits);
    if (this._ioAnalyzer) this._ioAnalyzer.setNumQubits(circuit.numQubits);
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
  simulate() {
    if (!this._stepTrace) return;
    if (this._debugger) {
      this._debugger.reset();
      while (this._debugger.getCurrentStep() < this._debugger.getTotalSteps()) {
        this._debugger.next();
      }
    } else {
      while (this._stepTrace.step < this._stepTrace.scheduleLength) this._stepTrace.next();
    }
    this.notify();
    this._status(`Simulated ${this._stepTrace.scheduleLength} virtual column(s).`);
  }
  reset() {
    if (!this._debugger) return;
    this._debugger.reset();
    this.notify();
    this._status('Reset to |0...\u232a at step 0.');
  }
  step() {
    this.stepDebugger();
  }
  stepDebugger() {
    if (!this._debugger) return;
    this._debugger.next();
    this.notify();
  }
  runToBreakpoint() {
    if (!this._debugger) return;
    this._debugger.runToBreakpoint();
    this.notify();
  }
  seekDebugger(col) {
    if (!this._debugger) return;
    this._debugger.seek(col);
    this.notify();
  }
  _validBreakpointCol(col) {
    return Number.isInteger(col) && col >= 0 && col <= this.getTimelineMax();
  }
  addBreakpoint(col) {
    if (!this._debugger || !this._validBreakpointCol(col)) { this._status(`Invalid breakpoint column ${col}.`); return false; }
    try { return this._debugger.addColumnBreakpoint(col); } catch (err) { this._status(`Invalid breakpoint column ${col}: ${err.message}`); return false; }
  }
  removeBreakpoint(col) {
    if (!this._debugger || !this._validBreakpointCol(col)) { this._status(`Invalid breakpoint column ${col}.`); return false; }
    return this._debugger.removeColumnBreakpoint(col);
  }
  toggleBreakpoint(col) {
    if (!this._debugger || !this._validBreakpointCol(col)) { this._status(`Invalid breakpoint column ${col}.`); return false; }
    try { return this._debugger.toggleColumnBreakpoint(col); } catch (err) { this._status(`Invalid breakpoint column ${col}: ${err.message}`); return false; }
  }
  clearAllBreakpoints() { if (this._debugger) this._debugger.clearAllBreakpoints(); }
  getBreakpoints() { return this._debugger?.getColumnBreakpoints() ?? []; }
  getBreakpointsWithStatus() {
    const step = this.getDebuggerStep();
    return this.getBreakpoints().map((col) => ({ column: col, active: col === step }));
  }
  hasBreakpoint(col) { return this._debugger?.hasColumnBreakpoint(col) ?? false; }
  getDebuggerStep() { return this._debuggerUI?.getCurrentStep() ?? 0; }
  getDebuggerTotal() { return this._debuggerUI?.getTotalSteps() ?? 0; }
  isDebuggerAtStart() { return this._debuggerUI?.isAtStart() ?? true; }
  isDebuggerAtEnd() { return this._debuggerUI?.isAtEnd() ?? true; }
  seek(col) {
    if (!this._stepTrace) return;
    this._stepTrace.seek(col);
    this.notify();
  }
  getCurrentStep() { return this._stepTrace ? this._stepTrace.step : 0; }
  getTotalSteps() { return this._stepTrace ? this._stepTrace.scheduleLength : 0; }
  getTimelineMax() { return this.getTotalSteps(); }
  isAtStart() { return this._stepTrace ? this._stepTrace.step === 0 : true; }
  isAtEnd() { return this._stepTrace ? this._stepTrace.step >= this._stepTrace.scheduleLength : true; }
  probabilities() { return this._inspector ? this._inspector.probabilities() : new Float64Array(0); }
  amplitudes() { return this._inspector ? this._inspector.amplitudes() : []; }
  ketLabels() { return this._inspector ? this._inspector.ketLabels() : []; }
  linearEntropy(q) { return this._inspector ? this._inspector.purity.linearEntropy(q) : 0; }
  purityGammas() {
    const n = this.numQubits;
    const out = new Float64Array(n);
    for (let q = 0; q < n; q += 1) out[q] = this.linearEntropy(q);
    return out;
  }
  bloch(q) { return this._inspector ? this._inspector.bloch.vector(q) : { x: 0, y: 0, z: 0 }; }
  setShots(shots) {
    if (!Number.isFinite(shots) || shots < 1) { this._status(`Invalid shots value ${shots}. Keeping ${this._shots}.`); return; }
    this._shots = Math.max(1, Math.floor(shots));
  }
  sampleShots() {
    if (!this._stepTrace) return null;
    const trace = this._stepTrace;
    const state = new StateVector(trace.numQubits);
    const size = trace.size;
    const re = state.getRawRe();
    const im = state.getRawIm();
    for (let i = 0; i < size; i += 1) {
      re[i] = trace.currentState.getRe(i);
      im[i] = trace.currentState.getIm(i);
    }
    return sampleHistogram(state, this._shots);
  }
  serialize() { return this._currentCircuit ? Serializer.toJson(this._currentCircuit) : ''; }
  deserialize(json) {
    try {
      const circuit = Serializer.fromJson(json);
      this._setCircuit(circuit);
      this._syncAuxQubitCounts(circuit);
      this._status('Circuit loaded from JSON.');
      return { ok: true, circuit };
    } catch (err) {
      this._status(`Import failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }
  draw() {
    if (!this._currentCircuit || !this._renderCb) return;
    this._renderCb({ circuit: this._currentCircuit, purity: this.purityGammas() });
  }
  _status(msg) { if (this._statusEl) this._statusEl.textContent = msg; }

}
