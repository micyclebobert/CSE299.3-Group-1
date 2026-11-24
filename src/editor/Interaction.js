// =============================================================================
// src/editor/Interaction.js
// -----------------------------------------------------------------------------
// Pure drag-and-drop state machine for the qubit-row circuit editor.
// No DOM: all coordinates are plain numbers; snapping and placement are pure.
// Placement returns a new Circuit (immutable) and enforces intra-column row
// disjointness, mirroring GateColumn.
// =============================================================================

import { Circuit } from '../circuit/Circuit.js';
import { Gate } from '../circuit/GateColumn.js';
import { GateColumn } from '../circuit/GateColumn.js';

export const PHASE_IDLE = 'idle';
export const PHASE_PICKED = 'picked';
export const PHASE_DRAGGING = 'dragging';

export function snapCell(x, y, { colPitch, rowPitch, colOffset = 0, rowOffset = 0 }) {
  if (!(colPitch > 0) || !(rowPitch > 0)) {
    throw new Error('snapCell requires positive colPitch and rowPitch');
  }
  const column = Math.round((x - colOffset) / colPitch);
  const row = Math.round((y - rowOffset) / rowPitch);
  return {
    column,
    row,
    x: colOffset + column * colPitch,
    y: rowOffset + row * rowPitch,
  };
}

export class Interaction {
  constructor() {
    this._phase = PHASE_IDLE;
    this._gateEntry = null;
    this._origin = { x: 0, y: 0 };
    this._pointer = { x: 0, y: 0 };
    this._cell = { column: 0, row: 0, x: 0, y: 0 };
    this._captured = false;
    this._ghostOffset = { x: 0, y: 0 };
    this._dropTarget = { column: 0, row: 0, conflict: false };
  }

  get phase() {
    return this._phase;
  }

  get gateEntry() {
    return this._gateEntry;
  }

  get pointer() {
    return { x: this._pointer.x, y: this._pointer.y };
  }

  get cell() {
    return { column: this._cell.column, row: this._cell.row, x: this._cell.x, y: this._cell.y };
  }

  get pointerCaptured() {
    return this._captured;
  }

  get ghostOffset() {
    return { x: this._ghostOffset.x, y: this._ghostOffset.y };
  }

  get dropTarget() {
    return { column: this._dropTarget.column, row: this._dropTarget.row, conflict: this._dropTarget.conflict };
  }

  capturePointer() {
    this._captured = true;
    return this;
  }

  releasePointerCapture() {
    this._captured = false;
    return this;
  }

  pick(gateEntry, x, y) {
    if (this._phase !== PHASE_IDLE) {
      throw new Error(`Interaction.pick: cannot pick while phase is ${this._phase}`);
    }
    this._phase = PHASE_PICKED;
    this._gateEntry = gateEntry;
    this._origin = { x, y };
    this._pointer = { x, y };
    this._cell = { column: 0, row: 0, x: 0, y: 0 };
    this._ghostOffset = { x: 0, y: 0 };
    this._dropTarget = { column: 0, row: 0, conflict: false };
    return this;
  }

  drag(x, y) {
    if (this._phase === PHASE_IDLE) {
      throw new Error('Interaction.drag: no gate picked');
    }
    this._phase = PHASE_DRAGGING;
    this._pointer = { x, y };
    return this;
  }

  snap(x, y, { colPitch, rowPitch, colOffset = 0, rowOffset = 0 } = {}) {
    if (this._phase === PHASE_IDLE) {
      throw new Error('Interaction.snap: no gate picked');
    }
    this._cell = snapCell(x, y, { colPitch, rowPitch, colOffset, rowOffset });
    this._ghostOffset = { x: this._pointer.x - this._cell.x, y: this._pointer.y - this._cell.y };
    this._dropTarget = { column: this._cell.column, row: this._cell.row, conflict: false };
    return { ...this._cell };
  }

  setDropTargetConflict(conflict) {
    this._dropTarget.conflict = Boolean(conflict);
    return this;
  }

  cancel() {
    this._phase = PHASE_IDLE;
    this._gateEntry = null;
    this._cell = { column: 0, row: 0, x: 0, y: 0 };
    this._ghostOffset = { x: 0, y: 0 };
    this._dropTarget = { column: 0, row: 0, conflict: false };
    return this;
  }

  drop(circuit, { colPitch, rowPitch, colOffset = 0, rowOffset = 0, column: overrideColumn, row: overrideRow } = {}) {
    const hadPicked = this._phase !== PHASE_IDLE;
    const gateEntry = this._gateEntry;
    const column = Number.isInteger(overrideColumn) ? overrideColumn : this._cell.column;
    const row = Number.isInteger(overrideRow) ? overrideRow : this._cell.row;

    this.cancel();

    if (!hadPicked || !gateEntry) {
      this._dropTarget = { column, row, conflict: true };
      return { circuit: null, column, row, gateEntry: null, conflict: true, reason: 'nothing picked' };
    }
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('Interaction.drop expects a Circuit instance');
    }
    if (!Number.isInteger(column) || column < 0) {
      this._dropTarget = { column, row, conflict: true };
      return { circuit: null, column, row, gateEntry, conflict: true, reason: 'invalid column' };
    }
    if (!Number.isInteger(row) || row < 0 || row >= circuit.numQubits) {
      this._dropTarget = { column, row, conflict: true };
      return { circuit: null, column, row, gateEntry, conflict: true, reason: 'invalid row' };
    }

    const result = this._placeGate(circuit, gateEntry, column, row);
    this._dropTarget = { column, row, conflict: result.conflict };
    return result;
  }

  _placeGate(circuit, gateEntry, column, row) {
    const controlCount = Number.isInteger(gateEntry.controls) ? gateEntry.controls : 0;
    const needsTarget2 = Boolean(gateEntry.target2);
    const parameterized = Boolean(gateEntry.parameterized);
    const defaultTheta = gateEntry.defaultTheta;

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
      return { circuit: null, column, row, gateEntry, conflict: true, reason: 'row occupied in column' };
    }
    usedRows.add(row);

    const freeRows = [];
    for (let r = 0; r < circuit.numQubits; r++) {
      if (!usedRows.has(r)) {
        freeRows.push(r);
      }
    }

    const totalExtra = controlCount + (needsTarget2 ? 1 : 0);
    if (freeRows.length < totalExtra) {
      return { circuit: null, column, row, gateEntry, conflict: true, reason: 'insufficient free rows' };
    }

    const controls = [];
    let freeIndex = 0;
    for (let i = 0; i < controlCount; i++) {
      controls.push({ row: freeRows[freeIndex++], on: true });
    }
    let target2 = undefined;
    if (needsTarget2) {
      target2 = freeRows[freeIndex++];
    }

    const gate = new Gate({
      name: gateEntry.name,
      target: row,
      controls,
      target2,
      ...(parameterized && defaultTheta !== undefined ? { thetaRad: defaultTheta } : {}),
    });

    const nextColumns = [...circuit.columns];
    while (nextColumns.length < column) {
      nextColumns.push(new GateColumn({ gates: [] }));
    }
    const nextColumn = new GateColumn({ gates: existing ? [...existing.gates, gate] : [gate] });
    if (column < nextColumns.length) {
      nextColumns[column] = nextColumn;
    } else {
      nextColumns.push(nextColumn);
    }
    const nextCircuit = new Circuit({ numQubits: circuit.numQubits, columns: nextColumns });

    return { circuit: nextCircuit, column, row, gateEntry, conflict: false };
  }

  getSelectedGate(circuit, column, row) {
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('Interaction.getSelectedGate expects a Circuit instance');
    }
    if (!Number.isInteger(column) || column < 0 || column >= circuit.columns.length) {
      return { conflict: true, reason: 'invalid column' };
    }
    if (!Number.isInteger(row) || row < 0 || row >= circuit.numQubits) {
      return { conflict: true, reason: 'invalid row' };
    }
    const columnGates = circuit.columns[column]?.gates ?? [];
    for (const gate of columnGates) {
      if (gate.target === row) {
        return { gate, column, row, conflict: false };
      }
    }
    return { conflict: true, reason: 'no gate at cell' };
  }

  selectCell(circuit, column, row) {
    return this.getSelectedGate(circuit, column, row);
  }

  deleteGate(circuit, column, row) {
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('Interaction.deleteGate expects a Circuit instance');
    }
    const selected = this.getSelectedGate(circuit, column, row);
    if (selected.conflict) {
      return { circuit: null, column, row, gateEntry: null, conflict: true, reason: selected.reason };
    }

    const gate = selected.gate;
    const existing = circuit.columns[column];
    const nextGates = existing.gates.filter((g) => g !== gate);
    const nextColumns = [...circuit.columns];
    nextColumns[column] = new GateColumn({ gates: nextGates });
    const nextCircuit = new Circuit({ numQubits: circuit.numQubits, columns: nextColumns });

    return { circuit: nextCircuit, column, row, gateEntry: { name: gate.name }, conflict: false };
  }

  moveGate(circuit, column, row, newColumn, newRow) {
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('Interaction.moveGate expects a Circuit instance');
    }
    const selected = this.getSelectedGate(circuit, column, row);
    if (selected.conflict) {
      return { circuit: null, column, row, newColumn, newRow, gateEntry: null, conflict: true, reason: selected.reason };
    }

    const gate = selected.gate;
    const gateEntry = {
      name: gate.name,
      controls: gate.controls.length,
      target2: gate.target2,
      parameterized: gate.thetaRad !== undefined,
      defaultTheta: gate.thetaRad,
    };

    const afterDelete = this.deleteGate(circuit, column, row);
    if (afterDelete.conflict) {
      return afterDelete;
    }

    const result = this._placeGate(afterDelete.circuit, gateEntry, newColumn, newRow);
    if (result.conflict) {
      return { circuit: null, column, row, newColumn, newRow, gateEntry, conflict: true, reason: result.reason };
    }

    return { circuit: result.circuit, column, row, newColumn, newRow, gateEntry, conflict: false };
  }

  replaceGate(circuit, column, row, gateEntry) {
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('Interaction.replaceGate expects a Circuit instance');
    }
    const selected = this.getSelectedGate(circuit, column, row);
    if (selected.conflict) {
      return { circuit: null, column, row, gateEntry: null, conflict: true, reason: selected.reason };
    }

    const afterDelete = this.deleteGate(circuit, column, row);
    if (afterDelete.conflict) {
      return afterDelete;
    }

    return this._placeGate(afterDelete.circuit, gateEntry, column, row);
  }
}
