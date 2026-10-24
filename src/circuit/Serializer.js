// =============================================================================
// src/circuit/Serializer.js
// -----------------------------------------------------------------------------
// Member 4 — Sprint 2, Phase A.
//
// Converts a Circuit object <-> canonical v1 JSON, losslessly.
//
// Canonical v1 JSON shape (exact key order matters for byte-identical output,
// which is required for SHA-256 caching later in the project):
//
//   {
//     "format": "simqc-circuit",
//     "version": 1,
//     "bitOrder": "little-endian",
//     "numQubits": <positive integer>,
//     "columns": [
//       [ { "gate": "H", "target": 0 } ],
//       [ { "gate": "CNOT", "target": 1,
//           "controls": [ { "row": 0, "on": true } ] } ]
//     ]
//   }
//
// Two functions are exported:
//   toJson(circuit)  -> string     (pretty-printed, 2-space indent)
//   fromJson(text)   -> Circuit    (strict validation; throws on any deviation)
//
// The two are exact inverses: for any Circuit c,
//   fromJson(toJson(c)).isEqualTo(c) === true
//
// Anti-controls ({ on: false }) are preserved verbatim — never converted to a
// bitmask at this layer. Bitmask construction is Member 1's kernel concern.
// =============================================================================

import { Circuit } from './Circuit.js';
import { Gate, GateColumn } from './GateColumn.js';

// ---------------------------------------------------------------------------
// Format constants — single source of truth.
// ---------------------------------------------------------------------------
const FORMAT = 'simqc-circuit';
const VERSION = 1;
const BIT_ORDER = 'little-endian';

class SerializerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SerializerError';
  }
}

// ===========================================================================
// toJson(circuit) -> string
// ---------------------------------------------------------------------------
// Walks columns in order, walks each gate, emits the canonical JSON object
// with the exact key order shown in the file header.
//
// Implementation note: we deliberately build plain JS objects with controlled
// key insertion order, then call JSON.stringify once. JS object key order is
// preserved for string keys in insertion order (ES2015+), so this gives us
// byte-identical output for semantically-equal circuits.
// ===========================================================================
export function toJson(circuit) {
  if (!(circuit instanceof Circuit)) {
    throw new TypeError(`toJson expects a Circuit instance, got: ${circuit && circuit.constructor && circuit.constructor.name}`);
  }

  // Build the columns array as plain JS, preserving key order.
  const columnsJson = circuit.columns.map((column) => {
    if (!(column instanceof GateColumn)) {
      throw new TypeError('Every column must be a GateColumn instance');
    }
    return column.gates.map((gate) => gateToJson(gate));
  });

  const doc = {
    format: FORMAT,
    version: VERSION,
    bitOrder: BIT_ORDER,
    numQubits: circuit.numQubits,
    columns: columnsJson,
  };

  // Pretty-printed, 2-space indent, stable key order. No trailing whitespace.
  return JSON.stringify(doc, null, 2);
}

/**
 * Convert a single Gate to its canonical JSON descriptor.
 * Key order: gate, target, controls (only when controls is non-empty).
 *
 * NOTE: the JSON field for the gate name is "gate" (not "name"), to match
 * the canonical v1 example in the Field Guide section 3.1.
 */
function gateToJson(gate) {
  if (!(gate instanceof Gate)) {
    throw new TypeError('Every gate must be a Gate instance');
  }
  const obj = { gate: gate.name, target: gate.target };
  if (gate.controls.length > 0) {
    // Controls always emitted in array order, each as { row, on }.
    obj.controls = gate.controls.map((c) => ({ row: c.row, on: c.on }));
  }
  return obj;
}

// ===========================================================================
// fromJson(text) -> Circuit
// ---------------------------------------------------------------------------
// Strict parsing with full validation. Throws SerializerError on any
// deviation from the canonical v1 contract.
//
// Validation checklist (matches Field Guide section 6.1):
//   - input is a string
//   - JSON.parse succeeds (catches SyntaxError -> SerializerError)
//   - top-level value is an object
//   - format === 'simqc-circuit'
//   - version === 1
//   - bitOrder === 'little-endian'
//   - numQubits is a positive integer
//   - columns is an array of arrays of gate descriptors
//   - each gate descriptor: gate (non-empty string), target (non-neg int),
//     optional controls array of { row, on } objects
// ===========================================================================
export function fromJson(text) {
  if (typeof text !== 'string') {
    throw new SerializerError(`fromJson expects a string, got: ${typeof text}`);
  }
  if (text.length === 0) {
    throw new SerializerError('fromJson received an empty string');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SerializerError(`Invalid JSON: ${err.message}`);
  }

  return parseCircuitDocument(parsed);
}

function parseCircuitDocument(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new SerializerError('Top-level JSON value must be an object');
  }

  // --- Required header fields -------------------------------------------------
  if (doc.format !== FORMAT) {
    throw new SerializerError(
      `Missing or invalid 'format' field: expected "${FORMAT}", got: ${JSON.stringify(doc.format)}`,
    );
  }
  if (doc.version !== VERSION) {
    throw new SerializerError(
      `Unsupported 'version' field: expected ${VERSION}, got: ${JSON.stringify(doc.version)}`,
    );
  }
  if (doc.bitOrder !== BIT_ORDER) {
    throw new SerializerError(
      `Unsupported 'bitOrder' field: expected "${BIT_ORDER}", got: ${JSON.stringify(doc.bitOrder)}`,
    );
  }

  // --- numQubits --------------------------------------------------------------
  if (!Number.isInteger(doc.numQubits) || doc.numQubits < 1) {
    throw new SerializerError(
      `'numQubits' must be a positive integer, got: ${JSON.stringify(doc.numQubits)}`,
    );
  }

  // --- columns ----------------------------------------------------------------
  if (!Array.isArray(doc.columns)) {
    throw new SerializerError(
      `'columns' must be an array, got: ${doc.columns === null ? 'null' : typeof doc.columns}`,
    );
  }

  const columns = doc.columns.map((col, colIdx) => parseColumn(col, colIdx));

  return new Circuit({ numQubits: doc.numQubits, columns });
}

function parseColumn(col, colIdx) {
  if (!Array.isArray(col)) {
    throw new SerializerError(
      `Column ${colIdx} must be an array of gate descriptors, got: ${col === null ? 'null' : typeof col}`,
    );
  }
  const gates = col.map((g, gateIdx) => parseGateDescriptor(g, colIdx, gateIdx));
  return new GateColumn({ gates });
}

function parseGateDescriptor(g, colIdx, gateIdx) {
  const where = `column ${colIdx} gate ${gateIdx}`;
  if (!g || typeof g !== 'object' || Array.isArray(g)) {
    throw new SerializerError(`Gate descriptor at ${where} must be an object`);
  }

  // gate name
  if (typeof g.gate !== 'string' || g.gate.length === 0) {
    throw new SerializerError(
      `Gate at ${where} has missing or invalid 'gate' field: ${JSON.stringify(g.gate)}`,
    );
  }

  // target
  if (!Number.isInteger(g.target) || g.target < 0) {
    throw new SerializerError(
      `Gate at ${where} has invalid 'target' field (must be a non-negative integer): ${JSON.stringify(g.target)}`,
    );
  }

  // controls (optional; if present must be array of { row, on })
  let controls = [];
  if (g.controls !== undefined) {
    if (!Array.isArray(g.controls)) {
      throw new SerializerError(
        `Gate at ${where} has non-array 'controls' field: ${typeof g.controls}`,
      );
    }
    controls = g.controls.map((c, i) => parseControlDescriptor(c, where, i));
  }

  // Reject unexpected extra keys — canonical format is strict on purpose.
  const allowed = new Set(['gate', 'target', 'controls']);
  for (const k of Object.keys(g)) {
    if (!allowed.has(k)) {
      throw new SerializerError(
        `Gate at ${where} has unexpected field '${k}' (allowed: gate, target, controls)`,
      );
    }
  }

  return new Gate({ name: g.gate, target: g.target, controls });
}

function parseControlDescriptor(c, where, idx) {
  const sub = `${where} control ${idx}`;
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    throw new SerializerError(`Control at ${sub} must be an object`);
  }
  if (!Number.isInteger(c.row) || c.row < 0) {
    throw new SerializerError(
      `Control at ${sub} has invalid 'row' field (must be a non-negative integer): ${JSON.stringify(c.row)}`,
    );
  }
  if (typeof c.on !== 'boolean') {
    throw new SerializerError(
      `Control at ${sub} has invalid 'on' field (must be a boolean): ${JSON.stringify(c.on)}`,
    );
  }
  // Reject extra keys here too.
  const allowed = new Set(['row', 'on']);
  for (const k of Object.keys(c)) {
    if (!allowed.has(k)) {
      throw new SerializerError(
        `Control at ${sub} has unexpected field '${k}' (allowed: row, on)`,
      );
    }
  }
  return { row: c.row, on: c.on };
}

// ===========================================================================
// Re-export the error class so tests / CLI can instanceof-check it.
// ===========================================================================
export { SerializerError };
export default { toJson, fromJson, SerializerError };
