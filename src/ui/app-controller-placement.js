import { Circuit } from '../circuit/Circuit.js';
import { Gate, GateColumn } from '../circuit/GateColumn.js';
import { gateControlCount, gateNeedsTarget2 } from '../editor/gatePalette.js';

export const placementMethods = {
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
  selectGate(column, row) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    if (!Number.isInteger(column) || column < 0 || column >= circuit.columns.length) {
      this._status(`Invalid selection coordinates column=${column} row=${row}.`);
      this._selectedEntry = null;
      this._selectedColumn = null;
      this._selectedRow = null;
      return { conflict: true, reason: 'coordinate out of range' };
    }
    if (!Number.isInteger(row) || row < 0 || row >= n) {
      this._status(`Invalid selection coordinates column=${column} row=${row}.`);
      this._selectedEntry = null;
      this._selectedColumn = null;
      this._selectedRow = null;
      return { conflict: true, reason: 'coordinate out of range' };
    }
    const result = this._interaction.getSelectedGate(circuit, column, row);
    if (result.conflict) {
      this._status(result.reason);
      this._selectedEntry = null;
      this._selectedColumn = null;
      this._selectedRow = null;
      return { conflict: true, reason: result.reason };
    }
    const entry = this._catalog.find((e) => e.name === result.gate.name);
    this._selectedEntry = entry ?? null;
    this._selectedColumn = column;
    this._selectedRow = row;
    this.notify();
    return { conflict: false, gate: result.gate, column, row };
  },
  moveGate(column, row, newColumn, newRow) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    for (const [c, r] of [[column, row], [newColumn, newRow]]) {
      if (!Number.isInteger(c) || c < 0 || c >= circuit.columns.length || !Number.isInteger(r) || r < 0 || r >= n) {
        this._status(`Invalid move coordinates column=${c} row=${r}.`);
        return { conflict: true, reason: 'coordinate out of range' };
      }
    }
    const result = this._interaction.moveGate(circuit, column, row, newColumn, newRow);
    if (result.conflict) {
      this._status(result.reason);
      return { conflict: true, reason: result.reason };
    }
    this._setCircuit(result.circuit);
    this.draw();
    this.notify();
    this._selectedColumn = newColumn;
    this._selectedRow = newRow;
    return { conflict: false };
  },
  deleteGate(column, row) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    if (!Number.isInteger(column) || column < 0 || column >= circuit.columns.length || !Number.isInteger(row) || row < 0 || row >= n) {
      this._status(`Invalid delete coordinates column=${column} row=${row}.`);
      return { conflict: true, reason: 'coordinate out of range' };
    }
    const result = this._interaction.deleteGate(circuit, column, row);
    if (result.conflict) {
      this._status(result.reason);
      return { conflict: true, reason: result.reason };
    }
    this._setCircuit(result.circuit);
    this.draw();
    this.notify();
    this.clearSelection();
    return { conflict: false };
  },
  replaceGate(column, row, gateName) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    if (!Number.isInteger(column) || column < 0 || column >= circuit.columns.length || !Number.isInteger(row) || row < 0 || row >= n) {
      this._status(`Invalid replace coordinates column=${column} row=${row}.`);
      return { conflict: true, reason: 'coordinate out of range' };
    }
    const entry = this._catalog.find((e) => e.name === gateName);
    if (!entry) {
      this._status(`Unknown gate: ${gateName}.`);
      return { conflict: true, reason: 'unknown gate' };
    }
    const result = this._interaction.replaceGate(circuit, column, row, entry);
    if (result.conflict) {
      this._status(result.reason);
      return { conflict: true, reason: result.reason };
    }
    this._setCircuit(result.circuit);
    this.draw();
    this.notify();
    this._selectedColumn = column;
    this._selectedRow = row;
    return { conflict: false };
  },
  clearSelection() {
    this._selectedEntry = null;
    this._selectedColumn = null;
    this._selectedRow = null;
  },
};
