import { Circuit } from '../circuit/Circuit.js';
import { Serializer } from '../circuit/Serializer.js';
import { Gate, GateColumn } from '../circuit/GateColumn.js';
import { findGate, isParameterized, gateParameterBounds } from '../editor/gatePalette.js';

export const gatesMethods = {
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

  // ------------------------------------------------------------------
  // Gate editing: parameter, controls, anti-controls, replacement
  // ------------------------------------------------------------------

  _gateCell(column, row) {
    const circuit = this._currentCircuit;
    const n = circuit.numQubits;
    if (!Number.isFinite(column) || !Number.isInteger(column) || column < 0 || column >= circuit.columns.length) {
      return { ok: false, reason: 'invalid-coordinate', message: `Invalid column ${column}.` };
    }
    if (!Number.isFinite(row) || !Number.isInteger(row) || row < 0 || row >= n) {
      return { ok: false, reason: 'invalid-coordinate', message: `Invalid row ${row}.` };
    }
    const columnObj = circuit.columns[column];
    if (!columnObj) {
      return { ok: false, reason: 'invalid-coordinate', message: `No column at column=${column}.` };
    }
    const gate = columnObj.gates.find((g) => g.target === row);
    if (!gate) {
      return { ok: false, reason: 'invalid-coordinate', message: `No gate at column=${column} row=${row}.` };
    }
    return { ok: true, gate, columnObj };
  },

  _rebuildColumn(columnObj, gate, replacement) {
    const nextGates = columnObj.gates.map((g) => g.target === gate.target ? replacement : g);
    return new GateColumn({ gates: nextGates });
  },

  setGateParameter(column, row, thetaRad, useDegrees = false) {
    const check = this._gateCell(column, row);
    if (!check.ok) {
      this._status(check.message);
      return { conflict: true, reason: check.reason };
    }
    const { gate } = check;
    if (!isParameterized(gate.name)) {
      const msg = `Gate '${gate.name}' is not parameterized.`;
      this._status(msg);
      return { conflict: true, reason: 'not parameterized' };
    }
    let angle = thetaRad;
    if (useDegrees) angle = (thetaRad * Math.PI) / 180;
    if (typeof angle !== 'number' || !Number.isFinite(angle)) {
      const msg = `Invalid thetaRad: ${String(thetaRad)}. Must be a finite number.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid parameter' };
    }
    const bounds = gateParameterBounds(gate.name);
    if (bounds && (angle < bounds.min || angle > bounds.max)) {
      const msg = `θ=${angle.toFixed(4)}rad is outside allowed range [${bounds.min.toFixed(2)}, ${bounds.max.toFixed(2)}] for '${gate.name}'.`;
      this._status(msg);
      return { conflict: true, reason: 'parameter out of range' };
    }
    const nextGate = new Gate({ name: gate.name, target: gate.target, target2: gate.target2, thetaRad: angle, controls: [...gate.controls] });
    const nextColumn = this._rebuildColumn(check.columnObj, gate, nextGate);
    const nextCircuit = this._currentCircuit.withColumnAt(column, nextColumn);
    this._setCircuit(nextCircuit);
    this._status(`Set ${gate.name} θ=${angle.toFixed(4)}rad at column=${column} row=${row}.`);
    return { conflict: false };
  },

  toggleControl(column, row, controlRow) {
    const check = this._gateCell(column, row);
    if (!check.ok) {
      this._status(check.message);
      return { conflict: true, reason: check.reason };
    }
    const { gate } = check;
    const n = this.numQubits;
    if (!Number.isInteger(controlRow) || controlRow < 0 || controlRow >= n) {
      const msg = `Invalid control row ${controlRow}.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid-coordinate' };
    }
    if (controlRow === gate.target) {
      const msg = `Cannot use target row ${controlRow} as a control.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid-coordinate' };
    }
    if (gate.target2 !== undefined && controlRow === gate.target2) {
      const msg = `Cannot use target2 row ${controlRow} as a control.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid-coordinate' };
    }

    const usedRows = new Set();
    for (const g of check.columnObj.gates) {
      if (g.target === gate.target) continue;
      usedRows.add(g.target);
      if (g.target2 !== undefined) usedRows.add(g.target2);
      for (const c of g.controls) usedRows.add(c.row);
    }
    usedRows.add(gate.target);
    if (gate.target2 !== undefined) usedRows.add(gate.target2);
    for (const c of gate.controls) usedRows.add(c.row);

    const existingIdx = gate.controls.findIndex((c) => c.row === controlRow && c.on === true);
    let nextControls;
    let action = '';
    if (existingIdx !== -1) {
      nextControls = gate.controls.filter((c) => !(c.row === controlRow && c.on === true));
      action = 'removed';
    } else {
      if (usedRows.has(controlRow)) {
        const msg = `Row ${controlRow} is occupied in column ${column}.`;
        this._status(msg);
        return { conflict: true, reason: 'occupied-row' };
      }
      nextControls = [...gate.controls, { row: controlRow, on: true }];
      action = 'added';
    }

    const nextGate = new Gate({ name: gate.name, target: gate.target, target2: gate.target2, thetaRad: gate.thetaRad, controls: nextControls });
    const nextColumn = this._rebuildColumn(check.columnObj, gate, nextGate);
    const nextCircuit = this._currentCircuit.withColumnAt(column, nextColumn);
    this._setCircuit(nextCircuit);
    this._status(`${action} control on row ${controlRow} to ${gate.name} at column=${column} row=${row}.`);
    return { conflict: false };
  },

  toggleAntiControl(column, row, antiControlRow) {
    const check = this._gateCell(column, row);
    if (!check.ok) {
      this._status(check.message);
      return { conflict: true, reason: check.reason };
    }
    const { gate } = check;
    const n = this.numQubits;
    if (!Number.isInteger(antiControlRow) || antiControlRow < 0 || antiControlRow >= n) {
      const msg = `Invalid anti-control row ${antiControlRow}.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid-coordinate' };
    }
    if (antiControlRow === gate.target) {
      const msg = `Cannot use target row ${antiControlRow} as an anti-control.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid-coordinate' };
    }
    if (gate.target2 !== undefined && antiControlRow === gate.target2) {
      const msg = `Cannot use target2 row ${antiControlRow} as an anti-control.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid-coordinate' };
    }

    const usedRows = new Set();
    for (const g of check.columnObj.gates) {
      if (g.target === gate.target) continue;
      usedRows.add(g.target);
      if (g.target2 !== undefined) usedRows.add(g.target2);
      for (const c of g.controls) usedRows.add(c.row);
    }
    usedRows.add(gate.target);
    if (gate.target2 !== undefined) usedRows.add(gate.target2);
    for (const c of gate.controls) usedRows.add(c.row);

    const existingIdx = gate.controls.findIndex((c) => c.row === antiControlRow && c.on === false);
    let nextControls;
    let action = '';
    if (existingIdx !== -1) {
      nextControls = gate.controls.filter((c) => !(c.row === antiControlRow && c.on === false));
      action = 'removed';
    } else {
      if (usedRows.has(antiControlRow)) {
        const msg = `Row ${antiControlRow} is occupied in column ${column}.`;
        this._status(msg);
        return { conflict: true, reason: 'occupied-row' };
      }
      nextControls = [...gate.controls, { row: antiControlRow, on: false }];
      action = 'added';
    }

    const nextGate = new Gate({ name: gate.name, target: gate.target, target2: gate.target2, thetaRad: gate.thetaRad, controls: nextControls });
    const nextColumn = this._rebuildColumn(check.columnObj, gate, nextGate);
    const nextCircuit = this._currentCircuit.withColumnAt(column, nextColumn);
    this._setCircuit(nextCircuit);
    this._status(`${action} anti-control on row ${antiControlRow} to ${gate.name} at column=${column} row=${row}.`);
    return { conflict: false };
  },

  setControlCount(column, row, count) {
    const check = this._gateCell(column, row);
    if (!check.ok) {
      this._status(check.message);
      return { conflict: true, reason: check.reason };
    }
    const { gate } = check;
    const n = this.numQubits;
    if (!Number.isInteger(count) || count < 0) {
      const msg = `Invalid control count ${String(count)}. Must be a non-negative integer.`;
      this._status(msg);
      return { conflict: true, reason: 'invalid parameter' };
    }

    const usedRows = new Set();
    for (const g of check.columnObj.gates) {
      if (g.target === gate.target) continue;
      usedRows.add(g.target);
      if (g.target2 !== undefined) usedRows.add(g.target2);
      for (const c of g.controls) usedRows.add(c.row);
    }
    usedRows.add(gate.target);
    if (gate.target2 !== undefined) usedRows.add(gate.target2);

    const keptControls = [];
    for (const c of gate.controls) {
      if (keptControls.length < count && c.on === true && !usedRows.has(c.row)) {
        keptControls.push(c);
        usedRows.add(c.row);
      }
    }
    for (let r = 0; r < n && keptControls.length < count; r += 1) {
      if (!usedRows.has(r)) {
        keptControls.push({ row: r, on: true });
        usedRows.add(r);
      }
    }
    if (keptControls.length < count) {
      const msg = `Insufficient free rows for ${count} controls on ${gate.name} at column=${column} row=${row}.`;
      this._status(msg);
      return { conflict: true, reason: 'insufficient-arity' };
    }

    const nextGate = new Gate({ name: gate.name, target: gate.target, target2: gate.target2, thetaRad: gate.thetaRad, controls: keptControls });
    const nextColumn = this._rebuildColumn(check.columnObj, gate, nextGate);
    const nextCircuit = this._currentCircuit.withColumnAt(column, nextColumn);
    this._setCircuit(nextCircuit);
    this._status(`Set ${keptControls.length} control(s) on ${gate.name} at column=${column} row=${row}.`);
    return { conflict: false };
  },

  replaceGate(column, row, gateName) {
    const check = this._gateCell(column, row);
    if (!check.ok) {
      this._status(check.message);
      return { conflict: true, reason: check.reason };
    }
    const { gate } = check;
    const entry = findGate(gateName);
    if (!entry) {
      const msg = `Unknown gate '${gateName}'.`;
      this._status(msg);
      return { conflict: true, reason: 'unknown-gate' };
    }
    const n = this.numQubits;
    const usedRows = new Set();
    for (const g of check.columnObj.gates) {
      if (g.target === gate.target) continue;
      usedRows.add(g.target);
      if (g.target2 !== undefined) usedRows.add(g.target2);
      for (const c of g.controls) usedRows.add(c.row);
    }
    usedRows.add(gate.target);

    const controlsNeeded = entry.controls ?? 0;
    const needsTarget2 = Boolean(entry.target2);
    const extraNeeded = controlsNeeded + (needsTarget2 ? 1 : 0);
    let freeCount = 0;
    for (let r = 0; r < n; r += 1) if (!usedRows.has(r)) freeCount += 1;
    if (freeCount < extraNeeded) {
      const msg = `Insufficient free rows for '${gateName}' arity at column=${column} row=${row}.`;
      this._status(msg);
      return { conflict: true, reason: 'insufficient-arity' };
    }

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

    const nextGate = new Gate({ name: gateName, target: gate.target, target2, thetaRad, controls });
    const nextColumn = this._rebuildColumn(check.columnObj, gate, nextGate);
    const nextCircuit = this._currentCircuit.withColumnAt(column, nextColumn);
    this._setCircuit(nextCircuit);
    this._status(`Replaced gate at column=${column} row=${row} with '${gateName}'.`);
    return { conflict: false };
  },
};

