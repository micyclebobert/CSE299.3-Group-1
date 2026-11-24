import { Circuit } from '../circuit/Circuit.js';
import { flattenCircuit, scheduleColumns } from '../circuit/Flatten.js';
import { StepTrace } from '../sim/StepTrace.js';
import { Gate, GateColumn } from '../circuit/GateColumn.js';

export const structureMethods = {
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

  // ------------------------------------------------------------------
  // Structure: rows, columns, reset/new-circuit
  // ------------------------------------------------------------------

  addQubitRow() {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    const limitStatus = this.getQubitLimitStatus(n + 1);
    if (!limitStatus.allowed) {
      this._status(`Qubit count ${n + 1} exceeds browser limit of ${limitStatus.maxQubits}. Row not added.`);
      return { conflict: true, reason: 'qubit limit exceeded' };
    }
    const nextCircuit = circuit.withRows(n + 1);
    this._setCircuit(nextCircuit);
    if (limitStatus.advisory) {
      this._status(limitStatus.advisory);
    } else {
      this._status(`Added qubit row ${n}.`);
    }
    return { conflict: false };
  },

  removeQubitRow(row) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    if (!Number.isInteger(row) || row < 0 || row >= n) {
      this._status(`Invalid row ${row}.`);
      return { conflict: true, reason: 'invalid-coordinate' };
    }
    for (let ci = 0; ci < circuit.columns.length; ci += 1) {
      for (const gate of circuit.columns[ci].gates) {
        if (gate.target === row) {
          this._status(`Cannot remove row ${row}: gate '${gate.name}' targets it at column ${ci}.`);
          return { conflict: true, reason: 'gate exists on row' };
        }
        if (gate.target2 !== undefined && gate.target2 === row) {
          this._status(`Cannot remove row ${row}: gate '${gate.name}' uses it as target2 at column ${ci}.`);
          return { conflict: true, reason: 'gate exists on row' };
        }
        for (const c of gate.controls) {
          if (c.row === row) {
            this._status(`Cannot remove row ${row}: gate '${gate.name}' controls it at column ${ci}.`);
            return { conflict: true, reason: 'gate exists on row' };
          }
        }
      }
    }
    const remap = (r) => (r > row ? r - 1 : r);
    const nextColumns = circuit.columns.map((column) => {
      const nextGates = column.gates.map((gate) => {
        const nextTarget = remap(gate.target);
        const nextTarget2 = gate.target2 !== undefined ? remap(gate.target2) : undefined;
        const nextControls = gate.controls.map((c) => ({ row: remap(c.row), on: c.on }));
        return new Gate({ name: gate.name, target: nextTarget, target2: nextTarget2, thetaRad: gate.thetaRad, controls: nextControls });
      });
      return new GateColumn({ gates: nextGates });
    });
    const nextCircuit = new Circuit({ numQubits: n - 1, columns: nextColumns });
    this._setCircuit(nextCircuit);
    this._status(`Removed qubit row ${row}.`);
    return { conflict: false };
  },

  addColumn() {
    const circuit = this._currentCircuit;
    const nextColumn = new GateColumn({ gates: [] });
    const nextCircuit = circuit.withColumnAt(circuit.columns.length, nextColumn);
    this._setCircuit(nextCircuit);
    this._status(`Added column ${circuit.columns.length}.`);
    return { conflict: false };
  },

  removeColumn(column) {
    const circuit = this._currentCircuit;
    if (!Number.isInteger(column) || column < 0 || column >= circuit.columns.length) {
      this._status(`Invalid column ${column}.`);
      return { conflict: true, reason: 'invalid-coordinate' };
    }
    const nextColumns = circuit.columns.filter((_, i) => i !== column);
    const nextCircuit = new Circuit({ numQubits: circuit.numQubits, columns: nextColumns });
    this._setCircuit(nextCircuit);
    this._status(`Removed column ${column}.`);
    return { conflict: false };
  },

  clearCircuit() {
    const circuit = this._currentCircuit;
    const nextCircuit = new Circuit({ numQubits: circuit.numQubits, columns: [] });
    this._setCircuit(nextCircuit);
    this._status('Circuit cleared.');
    return { conflict: false };
  },

  newCircuit(numQubits) {
    const limitStatus = this.getQubitLimitStatus(numQubits);
    if (!limitStatus.allowed) {
      this._status(`Qubit count ${numQubits} exceeds browser limit of ${limitStatus.maxQubits}. Circuit not created.`);
      return { conflict: true, reason: 'qubit limit exceeded' };
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
    return { conflict: false };
  },
};

