// =============================================================================
// src/circuit/GateColumn.js
// -----------------------------------------------------------------------------
// MEMBER 3 STUB — this file is owned by Member 3 in Sprint 2.
//
// This is a minimal, correct implementation of the Gate and GateColumn data
// model so that Member 4 (Serializer, CLI, tests) can develop in parallel.
// Member 3 will extend or replace this with the full implementation
// (validation, mutation helpers, subcircuit support, etc.) but MUST preserve
// the public API exported here:
//
//   class Gate {
//     constructor({ name, target, controls })           // controls defaults to []
//     get name() / get target() / get controls()         // read-only views
//     isEqualTo(other)                                   // deep structural equality
//     toDescriptor()                                     // plain JS object for JSON
//   }
//
//   class GateColumn {
//     constructor({ gates })                             // gates: Gate[]
//     get gates()
//     isEqualTo(other)
//   }
//
// Control descriptor shape (canonical, used everywhere):
//   { row: <non-negative integer>, on: <boolean> }
//   - on === true  -> positive control (fires when qubit row === 1)
//   - on === false -> anti-control    (fires when qubit row === 0)
// =============================================================================

/**
 * A single quantum gate placed on one qubit row, with optional controls.
 *
 * @example
 *   new Gate({ name: 'H', target: 0 })
 *   new Gate({ name: 'CNOT', target: 1, controls: [{ row: 0, on: true }] })
 *   new Gate({ name: 'X',   target: 1, controls: [{ row: 0, on: false }] }) // anti-control
 */
export class Gate {
  constructor({ name, target, controls = [], target2 = undefined, thetaRad = undefined }) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError(`Gate name must be a non-empty string, got: ${String(name)}`);
    }
    if (!Number.isInteger(target) || target < 0) {
      throw new TypeError(`Gate target must be a non-negative integer, got: ${String(target)}`);
    }
    if (target2 !== undefined && (!Number.isInteger(target2) || target2 < 0)) {
      throw new TypeError(`Gate target2 must be a non-negative integer, got: ${String(target2)}`);
    }
    if (target2 !== undefined && target2 === target) {
      throw new Error(`Gate target and target2 must be distinct rows, got: ${target}`);
    }
    if (thetaRad !== undefined && typeof thetaRad !== 'number') {
      throw new TypeError(`Gate thetaRad must be a number, got: ${String(thetaRad)}`);
    }
    if (!Array.isArray(controls)) {
      throw new TypeError(`Gate controls must be an array, got: ${typeof controls}`);
    }
    // Defensive copy + validate each control descriptor.
    const controlsCopy = controls.map((c) => {
      if (!c || typeof c !== 'object') {
        throw new TypeError('Each control must be a { row, on } object');
      }
      if (!Number.isInteger(c.row) || c.row < 0) {
        throw new TypeError(`Control row must be a non-negative integer, got: ${String(c.row)}`);
      }
      if (typeof c.on !== 'boolean') {
        throw new TypeError(`Control 'on' must be a boolean, got: ${typeof c.on}`);
      }
      return { row: c.row, on: c.on }; // exact key set, no extras preserved
    });

    // Store as frozen internal state so equality is structural & stable.
    this._name = name;
    this._target = target;
    this._target2 = target2 === undefined ? undefined : target2;
    this._thetaRad = thetaRad;
    this._controls = Object.freeze(controlsCopy);

    Object.freeze(this);
  }

  get name() { return this._name; }
  get target() { return this._target; }
  get target2() { return this._target2; }
  get thetaRad() { return this._thetaRad; }
  get controls() { return this._controls; }

  /**
   * Plain JS descriptor suitable for JSON serialization.
   * Key order is significant: name, target, target2?, controls.
   */
  toDescriptor() {
    const desc = { name: this._name, target: this._target };
    if (this._target2 !== undefined) {
      desc.target2 = this._target2;
    }
    if (this._controls.length > 0) {
      desc.controls = this._controls.map((c) => ({ row: c.row, on: c.on }));
    }
    return desc;
  }

  isEqualTo(other) {
    if (!(other instanceof Gate)) return false;
    if (this._name !== other._name) return false;
    if (this._target !== other._target) return false;
    if (this._target2 !== other._target2) return false;
    if (this._thetaRad !== other._thetaRad) return false;
    if (this._controls.length !== other._controls.length) return false;
    for (let i = 0; i < this._controls.length; i++) {
      const a = this._controls[i];
      const b = other._controls[i];
      if (a.row !== b.row || a.on !== b.on) return false;
    }
    return true;
  }
}

/**
 * A vertical slice of a circuit. All gates in a column act on disjoint qubit
 * rows and are applied simultaneously (one kernel pass).
 */
export class GateColumn {
  constructor({ gates }) {
    if (!Array.isArray(gates)) {
      throw new TypeError(`GateColumn gates must be an array, got: ${typeof gates}`);
    }
    // Defensive copy + type check. Member 3 will add disjoint-row validation.
    this._gates = gates.map((g) => {
      if (!(g instanceof Gate)) {
        throw new TypeError('Every gate in a GateColumn must be a Gate instance');
      }
      return g; // Gate is frozen, no need to clone
    });
    Object.freeze(this._gates);

    // Assert intra-column disjointness: no two operations may share a qubit row
    // (target, target2, or control). Violating this would make simultaneous execution incorrect.
    const usedRows = new Set();
    for (const gate of this._gates) {
      const rows = new Set([gate.target]);
      if (gate.target2 !== undefined) {
        rows.add(gate.target2);
      }
      for (const c of gate.controls) rows.add(c.row);
      for (const row of rows) {
        if (usedRows.has(row)) {
          throw new Error(
            `GateColumn: qubit row ${row} is used by more than one gate in the same column`
          );
        }
        usedRows.add(row);
      }
    }

    Object.freeze(this);
  }

  get gates() { return this._gates; }

  isEqualTo(other) {
    if (!(other instanceof GateColumn)) return false;
    if (this._gates.length !== other._gates.length) return false;
    for (let i = 0; i < this._gates.length; i++) {
      if (!this._gates[i].isEqualTo(other._gates[i])) return false;
    }
    return true;
  }
}


