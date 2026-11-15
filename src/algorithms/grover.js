// src/algorithms/grover.js — Grover's search algorithm builder.
//
// Layering: imports core/ and circuit/ only. DOM-free.
// Builds H^⊗n, then `iterations` rounds of (oracle, diffusion).
// oracleGates and diffusionGates are arrays of Gate instances acting on rows
// 0..n-1. Gates are packed into columns so intra-column row-disjointness holds.

import { Gate } from '../circuit/GateColumn.js';
import { GateColumn } from '../circuit/GateColumn.js';
import { Circuit } from '../circuit/Circuit.js';

function gateRows(gate) {
  const rows = [gate.target];
  if (gate.target2 !== undefined) {
    rows.push(gate.target2);
  }
  for (let c = 0; c < gate.controls.length; c++) {
    rows.push(gate.controls[c].row);
  }
  return rows;
}

function packColumns(gates) {
  const columns = [];
  let current = [];
  const used = new Set();
  for (let g = 0; g < gates.length; g++) {
    const gate = gates[g];
    const rows = gateRows(gate);
    let conflict = false;
    for (let r = 0; r < rows.length; r++) {
      if (used.has(rows[r])) {
        conflict = true;
        break;
      }
    }
    if (conflict && current.length > 0) {
      columns.push(new GateColumn({ gates: current }));
      current = [];
      used.clear();
    }
    current.push(gate);
    for (let r = 0; r < rows.length; r++) {
      used.add(rows[r]);
    }
  }
  if (current.length > 0) {
    columns.push(new GateColumn({ gates: current }));
  }
  return columns;
}

export function grover(n, oracleGates, diffusionGates, iterations) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(`grover expects a positive integer n, got: ${String(n)}`);
  }
  if (!Array.isArray(oracleGates)) {
    throw new TypeError(`oracleGates must be an array of Gate instances, got: ${typeof oracleGates}`);
  }
  for (let g = 0; g < oracleGates.length; g++) {
    if (!(oracleGates[g] instanceof Gate)) {
      throw new TypeError(`oracleGates[${g}] must be a Gate instance, got: ${String(oracleGates[g])}`);
    }
  }
  if (!Array.isArray(diffusionGates)) {
    throw new TypeError(`diffusionGates must be an array of Gate instances, got: ${typeof diffusionGates}`);
  }
  for (let g = 0; g < diffusionGates.length; g++) {
    if (!(diffusionGates[g] instanceof Gate)) {
      throw new TypeError(`diffusionGates[${g}] must be a Gate instance, got: ${String(diffusionGates[g])}`);
    }
  }
  if (!Number.isInteger(iterations) || iterations < 0) {
    throw new TypeError(`grover expects iterations to be a non-negative integer, got: ${String(iterations)}`);
  }

  const columns = [];
  const initGates = [];
  for (let q = 0; q < n; q++) {
    initGates.push(new Gate({ name: 'H', target: q }));
  }
  columns.push(new GateColumn({ gates: initGates }));

  const oracleColumns = packColumns(oracleGates);
  const diffusionColumns = packColumns(diffusionGates);

  for (let it = 0; it < iterations; it++) {
    for (let c = 0; c < oracleColumns.length; c++) {
      columns.push(oracleColumns[c]);
    }
    for (let c = 0; c < diffusionColumns.length; c++) {
      columns.push(diffusionColumns[c]);
    }
  }

  return new Circuit({ numQubits: n, columns });
}
