// =============================================================================
// src/circuit/Ascii.js
// -----------------------------------------------------------------------------
// MEMBER 3 — ASCII Diagram Parser (Quirk-style port, ~40 lines)
//
// Parses text circuit diagrams into Circuit instances.
//
// Example:
//   const diagram = `
//     H-X
//     --.-
//   `;
//   const circuit = parseAscii(diagram);
//
// Character grammar (per column position):
//   [A-Za-z]  -> gate on that qubit row (H, X, Y, Z, S, T, Rx, ...)
//   '-'       -> empty / connection spacer (skipped)
//   ' '       -> empty (skipped)
//   '.'       -> control dot; attaches as a positive control to the gate
//                in the same column on another row
//   '|'       -> vertical control line (skipped)
//
// Returns a Circuit with numQubits = number of rows.
// =============================================================================

import { Gate } from './GateColumn.js';
import { GateColumn } from './GateColumn.js';
import { Circuit } from './Circuit.js';

// Single-qubit gate names recognized as valid gate letters.
const GATE_LETTERS = new Set([
  'H', 'X', 'Y', 'Z', 'S', 'T', 'R', 'P', 'C', // C handled as CNOT/CZ context
]);

/**
 * Parse an ASCII circuit diagram into a Circuit.
 *
 * @param {string} diagram
 * @returns {Circuit}
 */
export function parseAscii(diagram) {
  if (typeof diagram !== 'string') {
    throw new TypeError(
      `parseAscii expects a string, got: ${typeof diagram}`
    );
  }

  const rawRows = diagram.split('\n');
  if (rawRows.length === 0) {
    throw new TypeError('parseAscii received an empty diagram');
  }

  const rows = rawRows.map((r) => r.trimEnd());
  const numQubits = rows.length;

  // Determine the diagram width (longest row).
  let width = 0;
  for (const row of rows) {
    width = Math.max(width, row.length);
  }

  // Control dots collected per column: col -> [{ row, on }]
  const dotsByCol = new Map();

  // First pass: collect control dots.
  for (let r = 0; r < numQubits; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') {
        if (!dotsByCol.has(c)) dotsByCol.set(c, []);
        dotsByCol.get(c).push({ row: r, on: true });
      }
    }
  }

  // Second pass: build columns of gates.
  const gateColumns = [];

  for (let c = 0; c < width; c++) {
    const columnGates = [];

    for (let r = 0; r < numQubits; r++) {
      const ch = rows[r]?.[c];
      if (!ch || ch === ' ' || ch === '-' || ch === '|' || ch === '.') {
        continue;
      }

      const upper = ch.toUpperCase();
      if (!GATE_LETTERS.has(upper) && !/[A-Z]/.test(upper)) {
        // Unrecognized character — skip rather than crash on spacing noise.
        continue;
      }

      // Attach control dots from this column (excluding the gate's own row).
      const gateControls = [];
      const dots = dotsByCol.get(c);
      if (dots) {
        for (const d of dots) {
          if (d.row !== r) {
            gateControls.push({ row: d.row, on: d.on });
          }
        }
      }

      columnGates.push({
        name: upper,
        target: r,
        controls: gateControls,
      });
    }

    if (columnGates.length > 0) {
      gateColumns.push({ index: c, gates: columnGates });
    }
  }

  // Build immutable Circuit.
  const columns = gateColumns.map(({ gates }) =>
    new GateColumn({
      gates: gates.map(
        (g) => new Gate({ name: g.name, target: g.target, controls: g.controls })
      ),
    })
  );

  return new Circuit({ numQubits, columns });
}

/**
 * Primary export matching the base filename (Ascii.js -> Ascii).
 * Static facade over parseAscii.
 */
export class Ascii {
  /**
   * Parse an ASCII circuit diagram into a Circuit.
   * @param {string} diagram
   * @returns {Circuit}
   */
  static parseAscii(diagram) {
    return parseAscii(diagram);
  }
}
