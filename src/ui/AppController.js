// =============================================================================
// src/ui/AppController.js
// -----------------------------------------------------------------------------
// Browser application state/controller layer.
//
// Owns the mutable application state (currentCircuit, current StepTrace,
// shot count) and coordinates: circuit edits (palette drop, undo/redo),
// simulation (StepTrace/Debugger), Inspector readouts, Code&AI JSON
// serialization, and canvas rendering notifications.
//
// Pure model objects come from main.js (the sole importer of gates/ and
// discardable leaves). This module is DOM-aware: it touches window/document
// only via the injected element refs and the render callback.
// =============================================================================

import { Circuit } from '../circuit/Circuit.js';
import { Gate, GateColumn } from '../circuit/GateColumn.js';
import { Serializer } from '../circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../circuit/Flatten.js';
import { StepTrace } from '../sim/StepTrace.js';
import { collapse, sampleHistogram } from '../measurement/measurement.js';

export class AppController {
  constructor({
    history,
    interaction,
    catalog,
    theme,
    Inspector,
    canvasEl,
    paletteEl,
    inspectorEl,
    codeEl,
    statusEl,
  }) {
    this._history = history;
    this._interaction = interaction;
    this._catalog = catalog;
    this._theme = theme;
    this._Inspector = Inspector;

    this._canvasEl = canvasEl;
    this._ctx = canvasEl.getContext('2d');
    this._paletteEl = paletteEl;
    this._inspectorEl = inspectorEl;
    this._codeEl = codeEl;
    this._statusEl = statusEl;

    this._currentCircuit = null;
    this._stepTrace = null;
    this._debugger = null;
    this._inspector = null;
    this._shots = 1024;

    this._renderCb = null;
    this._inspectorCb = null;
    this._codeCb = null;

    this._renderPalette();
    this._bindPalette();
    this._bindCanvas();
    this._bindResize();

    this.resetCircuit(2);
  }

  // -----------------------------------------------------------------------
  // Subscriptions
  // -----------------------------------------------------------------------

  onRender(cb) { this._renderCb = cb; }
  onInspector(cb) { this._inspectorCb = cb; }
  onCode(cb) { this._codeCb = cb; }

  notify() {
    if (this._renderCb) this._renderCb();
    if (this._inspectorCb) this._inspectorCb();
    if (this._codeCb) this._codeCb();
  }

  // -----------------------------------------------------------------------
  // Circuit state
  // -----------------------------------------------------------------------

  get currentCircuit() { return this._currentCircuit; }
  get numQubits() { return this._currentCircuit ? this._currentCircuit.numQubits : 0; }
  get shots() { return this._shots; }
  get catalog() { return this._catalog; }
  get canUndo() { return this._history.canUndo(); }
  get canRedo() { return this._history.canRedo(); }

  resetCircuit(numQubits = 2) {
    const circuit = new Circuit({ numQubits, columns: [] });
    this._setCircuit(circuit);
    this._status('Ready. Click a palette gate to place it on the canvas.');
  }

  _setCircuit(circuit) {
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('AppController expects a Circuit instance');
    }
    this._currentCircuit = circuit;
    const instructions = flattenCircuit(circuit);
    const schedule = scheduleColumns(instructions);
    this._stepTrace = new StepTrace(schedule, circuit.numQubits);
    this._inspector = new this._Inspector(this._stepTrace);
    this._history.push(circuit);
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Palette / drag-and-drop placement
  // -----------------------------------------------------------------------

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
      this._placeGate(entry, 0);
    });
  }

  _placeGate(entry, column) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    // Find the first column-row cell that is free in `column`.
    let placed = false;
    for (let row = 0; row < n && !placed; row++) {
      const result = this._tryPlace(entry, column, row);
      if (!result.conflict) {
        placed = true;
      }
    }
    if (!placed) {
      this._status('No free row in target column.');
      return;
    }
    this._status(`Placed ${entry.name} at column ${column}.`);
  }

  _tryPlace(entry, column, row) {
    const circuit = this._currentCircuit;
    const existing = circuit.columns[column] ?? null;
    const usedRows = new Set();
    if (existing) {
      for (const g of existing.gates) {
        usedRows.add(g.target);
        if (g.target2 !== undefined) usedRows.add(g.target2);
        for (const c of g.controls) usedRows.add(c.row);
      }
    }
    if (usedRows.has(row)) {
      return { circuit: null, conflict: true, reason: 'row occupied in column' };
    }

    const controls = [];
    if (entry.controls > 0) {
      let ctrlRow = row + 1;
      while (ctrlRow < circuit.numQubits && usedRows.has(ctrlRow)) ctrlRow += 1;
      if (ctrlRow < circuit.numQubits) {
        controls.push({ row: ctrlRow, on: true });
        usedRows.add(ctrlRow);
      }
    }
    let target2 = undefined;
    if (entry.target2) {
      let t2 = row + 1;
      while (t2 < circuit.numQubits && usedRows.has(t2)) t2 += 1;
      if (t2 < circuit.numQubits) target2 = t2;
    }
    let thetaRad = undefined;
    if (entry.parameterized && entry.defaultTheta !== undefined) {
      thetaRad = entry.defaultTheta;
    }
    const gate = new Gate({ name: entry.name, target: row, target2, thetaRad, controls });

    const nextColumns = [...circuit.columns];
    const nextColumn = existing
      ? new GateColumn({ gates: [...existing.gates, gate] })
      : new GateColumn({ gates: [gate] });
    if (column < nextColumns.length) nextColumns[column] = nextColumn;
    else nextColumns.push(nextColumn);
    const nextCircuit = new Circuit({ numQubits: circuit.numQubits, columns: nextColumns });
    this._setCircuit(nextCircuit);
    return { circuit: nextCircuit, conflict: false };
  }

  // -----------------------------------------------------------------------
  // Undo / redo
  // -----------------------------------------------------------------------

  undo() {
    const prev = this._history.undo();
    if (prev) {
      this._setCircuit(prev);
      this._status('Undo.');
    }
    return prev;
  }

  redo() {
    const next = this._history.redo();
    if (next) {
      this._setCircuit(next);
      this._status('Redo.');
    }
    return next;
  }

  // -----------------------------------------------------------------------
  // Simulation / Debugger
  // -----------------------------------------------------------------------

  simulate() {
    if (!this._stepTrace) return;
    while (this._stepTrace.step < this._stepTrace.scheduleLength) {
      this._stepTrace.next();
    }
    this.notify();
    this._status(`Simulated ${this._stepTrace.scheduleLength} virtual column(s).`);
  }

  reset() {
    if (!this._stepTrace) return;
    this._stepTrace.reset();
    this.notify();
    this._status('Reset to |0...\u232a at step 0.');
  }

  step() {
    if (!this._stepTrace) return;
    this._stepTrace.next();
    this.notify();
  }

  seek(col) {
    if (!this._stepTrace) return;
    this._stepTrace.seek(col);
    this.notify();
  }

  getCurrentStep() { return this._stepTrace ? this._stepTrace.step : 0; }
  getTotalSteps() { return this._stepTrace ? this._stepTrace.scheduleLength : 0; }
  isAtStart() { return this._stepTrace ? this._stepTrace.step === 0 : true; }
  isAtEnd() {
    return this._stepTrace ? this._stepTrace.step >= this._stepTrace.scheduleLength : true;
  }

  // -----------------------------------------------------------------------
  // Inspector readouts
  // -----------------------------------------------------------------------

  probabilities() {
    return this._inspector ? this._inspector.probabilities() : new Float64Array(0);
  }

  amplitudes() {
    return this._inspector ? this._inspector.amplitudes() : [];
  }

  ketLabels() {
    return this._inspector ? this._inspector.ketLabels() : [];
  }

  linearEntropy(q) {
    return this._inspector ? this._inspector.purity.linearEntropy(q) : 0;
  }

  purityGammas() {
    const n = this.numQubits;
    const out = new Float64Array(n);
    for (let q = 0; q < n; q++) out[q] = this.linearEntropy(q);
    return out;
  }

  bloch(q) {
    return this._inspector ? this._inspector.bloch.vector(q) : { x: 0, y: 0, z: 0 };
  }

  // -----------------------------------------------------------------------
  // Measurement / shots
  // -----------------------------------------------------------------------

  setShots(shots) {
    this._shots = Math.max(1, Math.floor(shots));
  }

  sampleShots() {
    if (!this._stepTrace) return null;
    return sampleHistogram(this._stepTrace.currentState, this._shots);
  }

  // -----------------------------------------------------------------------
  // Code & AI (canonical v1 JSON)
  // -----------------------------------------------------------------------

  serialize() {
    return this._currentCircuit ? Serializer.toJson(this._currentCircuit) : '';
  }

  deserialize(json) {
    try {
      const circuit = Serializer.fromJson(json);
      this._setCircuit(circuit);
      this._status('Circuit loaded from JSON.');
      return { ok: true, circuit };
    } catch (err) {
      this._status(`Import failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  draw() {
    if (!this._currentCircuit || !this._renderCb) return;
    this._renderCb({ circuit: this._currentCircuit, purity: this.purityGammas() });
  }

  _status(msg) {
    if (this._statusEl) this._statusEl.textContent = msg;
  }
}
