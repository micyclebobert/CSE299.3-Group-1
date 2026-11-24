import { Circuit } from '../circuit/Circuit.js';
import { Gate, GateColumn } from '../circuit/GateColumn.js';
import { Serializer } from '../circuit/Serializer.js';
import { flattenCircuit, scheduleColumns } from '../circuit/Flatten.js';
import { StepTrace } from '../sim/StepTrace.js';
import { gateControlCount, gateNeedsTarget2 } from '../editor/gatePalette.js';

export const circuitMethods = {
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
  },
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
  },
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
  },
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
  },
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
  },
  applyCircuit(circuit) {
    const limitStatus = this.getQubitLimitStatus(circuit.numQubits);
    if (!limitStatus.allowed) {
      this._status(`Qubit count ${circuit.numQubits} exceeds browser limit of ${limitStatus.maxQubits}. qubit limit exceeded. Circuit not applied.`);
      return { conflict: true, reason: 'qubit limit exceeded' };
    }
    this._setCircuit(circuit);
    this._syncAuxQubitCounts(circuit);
    if (limitStatus.advisory) {
      this._status(limitStatus.advisory);
    } else {
      this._status('AI Builder circuit applied to editor.');
    }
    return { conflict: false };
  },
  _syncAuxQubitCounts(circuit) {
    if (this._aiBuilder) this._aiBuilder.setNumQubits(circuit.numQubits);
    if (this._ioAnalyzer) this._ioAnalyzer.setNumQubits(circuit.numQubits);
  },
  serialize() { return this._currentCircuit ? Serializer.toJson(this._currentCircuit) : ''; },
  deserialize(json) {
    try {
      const circuit = Serializer.fromJson(json);
      const limitStatus = this.getQubitLimitStatus(circuit.numQubits);
      if (!limitStatus.allowed) {
        const error = 'qubit limit exceeded';
        this._status(`Import failed: ${error}.`);
        return { ok: false, error };
      }
      this._setCircuit(circuit);
      this._syncAuxQubitCounts(circuit);
      if (limitStatus.advisory) {
        this._status(limitStatus.advisory);
      } else {
        this._status('Circuit loaded from JSON.');
      }
      return { ok: true, circuit };
    } catch (err) {
      this._status(`Import failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  },
};
