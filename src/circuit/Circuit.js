// =============================================================================
// src/circuit/Circuit.js
// -----------------------------------------------------------------------------
// MEMBER 3 STUB — this file is owned by Member 3 in Sprint 2.
//
// Minimal, correct implementation so Member 4 (Serializer) can develop in
// parallel. Member 3 will extend this with the full API (mutation helpers,
// subcircuit embedding, column insertion, validation against numQubits, etc.)
// but MUST preserve the public API exported here:
//
//   class Circuit {
//     constructor({ numQubits, columns })
//     get numQubits()
//     get columns()                       // GateColumn[]
//     isEqualTo(other)                    // deep structural equality
//   }
// =============================================================================

import { GateColumn } from './GateColumn.js';

/**
 * A quantum circuit: numQubits qubit rows plus an ordered list of GateColumns.
 *
 * @example
 *   new Circuit({
 *     numQubits: 2,
 *     columns: [
 *       new GateColumn({ gates: [new Gate({ name: 'H', target: 0 })] }),
 *       new GateColumn({ gates: [new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })] }),
 *     ],
 *   });
 */
export class Circuit {
  constructor({ numQubits, columns }) {
    if (!Number.isInteger(numQubits) || numQubits < 1) {
      throw new TypeError(`Circuit numQubits must be a positive integer, got: ${String(numQubits)}`);
    }
    if (!Array.isArray(columns)) {
      throw new TypeError(`Circuit columns must be an array, got: ${typeof columns}`);
    }
    this._numQubits = numQubits;
    this._columns = columns.map((c) => {
      if (!(c instanceof GateColumn)) {
        throw new TypeError('Every column in a Circuit must be a GateColumn instance');
      }
      return c; // GateColumn is frozen, no need to clone
    });
    Object.freeze(this._columns);
    Object.freeze(this);
  }

  get numQubits() { return this._numQubits; }
  get columns() { return this._columns; }

  isEqualTo(other) {
    if (!(other instanceof Circuit)) return false;
    if (this._numQubits !== other._numQubits) return false;
    if (this._columns.length !== other._columns.length) return false;
    for (let i = 0; i < this._columns.length; i++) {
      if (!this._columns[i].isEqualTo(other._columns[i])) return false;
    }
    return true;
  }

  /**
   * Return a new Circuit with `column` inserted at `index` (immutable).
   */
  withColumnAt(index, column) {
    if (!(column instanceof GateColumn)) {
      throw new TypeError(
        `withColumnAt expects a GateColumn instance, got: ${
          column && column.constructor && column.constructor.name
        }`
      );
    }
    if (!Number.isInteger(index) || index < 0 || index > this._columns.length) {
      throw new RangeError(
        `Column index ${index} is out of range [0, ${this._columns.length}]`
      );
    }
    const next = [...this._columns];
    next.splice(index, 0, column);
    return new Circuit({ numQubits: this._numQubits, columns: next });
  }

  /**
   * Return a new Circuit with a different qubit count (immutable).
   * Columns are carried over unchanged; callers must ensure gate targets remain valid.
   */
  withRows(numQubits) {
    if (!Number.isInteger(numQubits) || numQubits < 1) {
      throw new TypeError(`withRows expects a positive integer, got: ${String(numQubits)}`);
    }
    return new Circuit({ numQubits, columns: this._columns });
  }
}


