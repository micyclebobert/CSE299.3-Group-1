// src/algorithms/shor.js — Shor's order-finding circuit builder.
// DOM-free. Imports core/ and circuit/ only.
// Builds: H on count; for j=0..t-1, controlled-U^{2^j} applied in place to a
// single work register W (starts |1>) via controlled value-permutation; then
// inverse QFT on count. W ends at |a^x mod N> where x is the count value.
// Controlled modular multiplication = controlled permutation y -> (m*y) mod N
// (bijective on [0,2^n): y<N permutes bijectively since gcd(m,N)=1; y>=N fixed).
// Detection flag = (reg==v) AND control; uncomputation re-detects the swapped
// value so flags return to 0 whether control is 0 or 1.

import { Gate } from '../circuit/GateColumn.js';
import { GateColumn } from '../circuit/GateColumn.js';
import { Circuit } from '../circuit/Circuit.js';

// ---- Classical number theory ----

export function gcd(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    throw new TypeError(`gcd expects non-negative integers`);
  }
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
}

export function modExp(base, exp, N) {
  if (!Number.isInteger(base) || !Number.isInteger(exp) || !Number.isInteger(N) ||
      base < 0 || exp < 0 || N < 1) throw new TypeError('modExp expects non-negative integers');
  let result = 1 % N;
  base = base % N;
  let e = exp;
  while (e > 0) { if (e & 1) result = (result * base) % N; base = (base * base) % N; e >>= 1; }
  return result;
}

export function findOrder(a, N) {
  if (!Number.isInteger(a) || !Number.isInteger(N) || a < 1 || N < 2) {
    throw new TypeError('findOrder expects a >= 1, N >= 2');
  }
  if (gcd(a, N) !== 1) return null;
  let value = 1 % N;
  for (let r = 1; r <= N; r++) { value = (value * a) % N; if (value === 1) return r; }
  return null;
}

// ---- Gate factories ----

function xGate(t) { return new Gate({ name: 'X', target: t }); }
function hGate(t) { return new Gate({ name: 'H', target: t }); }
function toffoliGate(c0, c1, t) {
  return new Gate({ name: 'Toffoli', target: t, controls: [{ row: c0, on: true }, { row: c1, on: true }] });
}

// ---- Pack gates into columns with disjoint rows ----

function packColumns(items) {
  const columns = [];
  let current = [];
  let used = new Set();
  for (const item of items) {
    if (item.rows.some((r) => used.has(r)) && current.length > 0) {
      columns.push(new GateColumn({ gates: current }));
      current = [];
      used = new Set();
    }
    current.push(item.gate);
    for (const r of item.rows) used.add(r);
  }
  if (current.length > 0) columns.push(new GateColumn({ gates: current }));
  return columns;
}

// ---- Multi-controlled X decomposition (Toffoli + CNOT), clean ancillae ----

function mcxGates(controls, target, anc) {
  const gates = [];
  const k = controls.length;
  if (k === 0) { gates.push(xGate(target)); return gates; }
  if (k === 1) { gates.push(new Gate({ name: 'CNOT', target, controls: [{ row: controls[0].row, on: true }] })); return gates; }
  if (k === 2) { gates.push(toffoliGate(controls[0].row, controls[1].row, target)); return gates; }
  gates.push(toffoliGate(controls[0].row, controls[1].row, anc[0]));
  for (let i = 2; i <= k - 2; i++) gates.push(toffoliGate(anc[i - 2], controls[i].row, anc[i - 1]));
  gates.push(toffoliGate(anc[k - 3], controls[k - 1].row, target));
  for (let i = k - 2; i >= 2; i--) gates.push(toffoliGate(anc[i - 2], controls[i].row, anc[i - 1]));
  gates.push(toffoliGate(controls[0].row, controls[1].row, anc[0]));
  return gates;
}


// ---- Value detection: reg == v AND control into flag (anti-controls via X) ----

function detectValueGates(reg, v, flag, mcxAnc, control) {
  const gates = [];
  const n = reg.length;
  const anti = [];
  for (let k = 0; k < n; k++) if (((v >>> k) & 1) === 0) anti.push(reg[k]);
  for (const r of anti) gates.push(xGate(r));
  const controls = reg.map((r) => ({ row: r, on: true }));
  if (control !== undefined) controls.push({ row: control, on: true });
  gates.push(...mcxGates(controls, flag, mcxAnc));
  for (const r of anti) gates.push(xGate(r));
  return gates;
}

// ---- Controlled permutation via cycle->transposition decomposition ----
// Transpositions applied in REVERSE order so the composed permutation matches
// `perm` (forward order yields the inverse cycle). Detection includes `control`;
// flag=(reg==v)&control. Uncompute re-detects the swapped value so flags return
// to 0 for both control=0 and control=1.

function cPermuteGates(control, reg, perm, flag1, flag2, mcxAnc) {
  const gates = [];
  const n = reg.length;
  const size = 1 << n;
  const visited = new Array(size).fill(false);
  const cycles = [];
  for (let i = 0; i < size; i++) {
    if (visited[i] || perm[i] === i) { visited[i] = true; continue; }
    const cyc = [];
    let j = i;
    while (!visited[j]) { visited[j] = true; cyc.push(j); j = perm[j]; }
    if (cyc.length > 1) cycles.push(cyc);
  }
  for (const cyc of cycles) {
    // Reverse order: (a{k-1},ak)...(a1,a2) composes to cycle (a1->a2->...->ak).
    for (let t = cyc.length - 2; t >= 0; t--) {
      const i = cyc[t]; const j = cyc[t + 1];
      gates.push(...detectValueGates(reg, i, flag1, mcxAnc, control));
      gates.push(...detectValueGates(reg, j, flag2, mcxAnc, control));
      const diffBits = [];
      for (let k = 0; k < n; k++) if (((i >>> k) & 1) !== ((j >>> k) & 1)) diffBits.push(reg[k]);
      // flag already includes `control`, so a single control suffices.
      for (const row of diffBits) {
        gates.push(new Gate({ name: 'CNOT', target: row, controls: [{ row: flag1, on: true }] }));
      }
      for (const row of diffBits) {
        gates.push(new Gate({ name: 'CNOT', target: row, controls: [{ row: flag2, on: true }] }));
      }
      // Uncompute: old i->new j, old j->new i (swap detection values).
      gates.push(...detectValueGates(reg, j, flag1, mcxAnc, control));
      gates.push(...detectValueGates(reg, i, flag2, mcxAnc, control));
    }
  }
  return gates;
}

// ---- Value permutation for modular multiplication by m mod N on n bits ----

function buildModMultPerm(m, N, n) {
  const size = 1 << n;
  const perm = new Array(size);
  const used = new Array(size).fill(false);
  for (let y = 0; y < size; y++) {
    if (y < N) { perm[y] = (m * y) % N; used[perm[y]] = true; } else { perm[y] = -1; }
  }
  let free = 0;
  for (let y = 0; y < size; y++) {
    if (perm[y] === -1) { while (free < size && used[free]) free++; perm[y] = free < size ? free : y; if (free < size) used[free] = true; }
  }
  return perm;
}

// ---- Inverse QFT (little-endian) ----

function iqftGates(reg) {
  const gates = [];
  const n = reg.length;
  const TAU = 2 * Math.PI;
  // Swaps first (inverse of forward QFT's trailing swaps).
  for (let j = 0; j < Math.floor(n / 2); j++) {
    gates.push(new Gate({ name: 'SWAP', target: reg[j], target2: reg[n - 1 - j] }));
  }
  // Inverse rotations then H, ascending i.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const angle = -TAU / (1 << (i - j + 1));
      gates.push(new Gate({ name: 'Cu1', target: reg[i], controls: [{ row: reg[j], on: true }], thetaRad: angle }));
    }
    gates.push(hGate(reg[i]));
  }
  return gates;
}


// ---- Main Shor order-finding circuit builder ----

export function shor(N, a, options = {}) {
  if (!Number.isInteger(N) || N < 3 || N % 2 === 0) {
    throw new TypeError(`shor expects an odd composite N >= 3, got: ${String(N)}`);
  }
  if (!Number.isInteger(a) || a <= 1 || a >= N) {
    throw new TypeError(`shor expects 1 < a < N, got a=${String(a)}, N=${String(N)}`);
  }
  if (gcd(a, N) !== 1) {
    throw new Error(`shor expects gcd(a,N)=1, got gcd(${a},${N})=${gcd(a, N)}`);
  }
  const t = options.t !== undefined ? options.t : 2 * Math.ceil(Math.log2(N));
  if (!Number.isInteger(t) || t < 1) {
    throw new TypeError(`options.t must be a positive integer, got: ${String(t)}`);
  }
  const n = Math.ceil(Math.log2(N)); // 2^n >= N

  const count = [];
  for (let i = 0; i < t; i++) count.push(i);
  let offset = t;
  const work = [];
  for (let i = 0; i < n; i++) work.push(offset++);
  const flag1 = offset++;
  const flag2 = offset++;
  const mcxAnc = [];
  const mcxAncCount = Math.max(0, n - 1); // detection uses n+1 controls -> n-1 ancillae
  for (let i = 0; i < mcxAncCount; i++) mcxAnc.push(offset++);
  const numQubits = offset;

  const items = [];

  // Initialize work register to |1>.
  items.push({ gate: xGate(work[0]), rows: [work[0]] });

  // H on all count qubits.
  for (const q of count) items.push({ gate: hGate(q), rows: [q] });

  // Controlled-U^{2^j} for j = 0..t-1, applied in place to work.
  for (let j = 0; j < t; j++) {
    const multiplier = modExp(a, 1 << j, N);
    const perm = buildModMultPerm(multiplier, N, n);
    const permGates = cPermuteGates(count[j], work, perm, flag1, flag2, mcxAnc);
    for (const gate of permGates) {
      const rows = [gate.target];
      for (const c of gate.controls) rows.push(c.row);
      if (gate.target2 !== undefined) rows.push(gate.target2);
      items.push({ gate, rows });
    }
  }

  // Inverse QFT on count register.
  for (const gate of iqftGates(count)) {
    const rows = [gate.target];
    for (const c of gate.controls) rows.push(c.row);
    if (gate.target2 !== undefined) rows.push(gate.target2);
    items.push({ gate, rows });
  }

  const columns = packColumns(items);
  return new Circuit({ numQubits, columns });
}
