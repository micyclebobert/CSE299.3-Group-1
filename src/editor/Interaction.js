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
import { snapToGrid } from '../canvas/geom.js';

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

  pick(gateEntry, x, y) {
    if (this._phase !== PHASE_IDLE) {
      throw new Error(`Interaction.pick: cannot pick while phase is ${this._phase}`);
    }
    this._phase = PHASE_PICKED;
    this._gateEntry = gateEntry;
    this._origin = { x, y };
    this._pointer = { x, y };
    this._cell = { column: 0, row: 0, x: 0, y: 0 };
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
    return { ...this._cell };
  }

  cancel() {
    this._phase = PHASE_IDLE;
    this._gateEntry = null;
    this._cell = { column: 0, row: 0, x: 0, y: 0 };
    return this;
  }

  /**
   * Place the picked gate onto `circuit` at the snapped cell.
   *
   * Returns { circuit: Circuit | null, column, row, gateEntry, conflict, reason }.
   * On conflict (row already used in that column, or out-of-range indices)
   * circuit is null and conflict is true. The interaction resets to idle.
   */
  drop(circuit, { colPitch, rowPitch, colOffset = 0, rowOffset = 0 } = {}) {
    const hadPicked = this._phase !== PHASE_IDLE;
    const gateEntry = this._gateEntry;
    const { column, row } = this._cell;

    this.cancel();

    if (!hadPicked || !gateEntry) {
      return { circuit: null, column, row, gateEntry: null, conflict: true, reason: 'nothing picked' };
    }
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('Interaction.drop expects a Circuit instance');
    }
    if (!Number.isInteger(column) || column < 0 || column > circuit.columns.length) {
      return { circuit: null, column, row, gateEntry, conflict: true, reason: 'invalid column' };
    }
    if (!Number.isInteger(row) || row < 0 || row >= circuit.numQubits) {
      return { circuit: null, column, row, gateEntry, conflict: true, reason: 'invalid row' };
    }

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

    const gate = new Gate({
      name: gateEntry.name,
      target: row,
      controls: [],
      ...(gateEntry.parameterized && gateEntry.defaultTheta !== undefined
        ? { thetaRad: gateEntry.defaultTheta }
        : {}),
    });

    const nextColumns = [...circuit.columns];
    const nextColumn = new GateColumn({ gates: existing ? [...existing.gates, gate] : [gate] });
    if (column < nextColumns.length) {
      nextColumns[column] = nextColumn;
    } else {
      nextColumns.push(nextColumn);
    }
    const nextCircuit = new Circuit({ numQubits: circuit.numQubits, columns: nextColumns });

    return { circuit: nextCircuit, column, row, gateEntry, conflict: false };
  }
}
