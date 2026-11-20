// History.test.js - Tests for undo/redo history
// Mirrors src/state/History.js 1:1 per CONVENTIONS.md #224
import { test } from 'node:test';
import { strictEqual, ok, deepStrictEqual, throws } from 'assert';
import { History } from '../../src/state/History.js';
import { Circuit } from '../../src/circuit/Circuit.js';
import { Gate, GateColumn } from '../../src/circuit/GateColumn.js';

const GATE_NAMES = ['I', 'X', 'Y', 'Z', 'H', 'S', 'T'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomGate(numQubits) {
  const target = randInt(0, numQubits - 1);
  return new Gate({ name: GATE_NAMES[randInt(0, GATE_NAMES.length - 1)], target });
}

function randomColumn(numQubits) {
  const gateCount = randInt(0, 2);
  const usedRows = new Set();
  const gates = [];
  for (let i = 0; i < gateCount; i++) {
    let target;
    let tries = 0;
    do {
      target = randInt(0, numQubits - 1);
      tries += 1;
      if (tries > 50) break;
    } while (usedRows.has(target));
    if (usedRows.has(target)) break;
    usedRows.add(target);
    gates.push(new Gate({ name: GATE_NAMES[randInt(0, GATE_NAMES.length - 1)], target }));
  }
  return new GateColumn({ gates });
}

function randomCircuit() {
  const numQubits = randInt(1, 4);
  const columnCount = randInt(0, 4);
  const columns = [];
  for (let i = 0; i < columnCount; i++) {
    columns.push(randomColumn(numQubits));
  }
  return new Circuit({ numQubits, columns });
}

test('new History is empty: no undo/redo, size 0, current null', () => {
  const h = new History();
  strictEqual(h.size(), 0);
  strictEqual(h.current(), null);
  strictEqual(h.canUndo(), false);
  strictEqual(h.canRedo(), false);
  strictEqual(h.undo(), null);
  strictEqual(h.redo(), null);
});

test('push sets current and enables undo once a prior state exists', () => {
  const h = new History();
  const a = randomCircuit();
  const b = randomCircuit();
  h.push(a);
  strictEqual(h.size(), 1);
  strictEqual(h.current(), a);
  strictEqual(h.canUndo(), false); // first state: nothing to undo to
  strictEqual(h.canRedo(), false);
  h.push(b);
  strictEqual(h.size(), 2);
  strictEqual(h.current(), b);
  strictEqual(h.canUndo(), true); // can undo back to a
  strictEqual(h.canRedo(), false);
});

test('undo moves back one step and returns previous circuit', () => {
  const h = new History();
  const a = randomCircuit();
  const b = randomCircuit();
  h.push(a);
  h.push(b);
  strictEqual(h.current(), b);
  const prev = h.undo();
  strictEqual(prev, a);
  strictEqual(h.current(), a);
  strictEqual(h.canUndo(), false);
  strictEqual(h.canRedo(), true);
});

test('redo moves forward one step and returns next circuit', () => {
  const h = new History();
  const a = randomCircuit();
  const b = randomCircuit();
  h.push(a);
  h.push(b);
  h.undo();
  const next = h.redo();
  strictEqual(next, b);
  strictEqual(h.current(), b);
  strictEqual(h.canRedo(), false);
  strictEqual(h.canUndo(), true);
});

test('undo at base returns null; redo at top returns null', () => {
  const h = new History();
  h.push(randomCircuit());
  strictEqual(h.undo(), null); // index 0 -> base
  strictEqual(h.canUndo(), false);
  h.push(randomCircuit());
  h.push(randomCircuit());
  h.undo();
  h.undo();
  strictEqual(h.undo(), null);
});

test('clear empties the history', () => {
  const h = new History();
  h.push(randomCircuit());
  h.push(randomCircuit());
  h.clear();
  strictEqual(h.size(), 0);
  strictEqual(h.current(), null);
  strictEqual(h.canUndo(), false);
  strictEqual(h.canRedo(), false);
});

test('push after undo truncates the redo stack (linear stack)', () => {
  const h = new History();
  const a = randomCircuit();
  const b = randomCircuit();
  const c = randomCircuit();
  h.push(a);
  h.push(b);
  h.push(c);
  strictEqual(h.size(), 3);
  strictEqual(h.current(), c);
  h.undo(); // back to b
  h.undo(); // back to a (base)
  h.push(c); // truncates b from the future
  strictEqual(h.size(), 2);
  strictEqual(h.current(), c);
  strictEqual(h.undo(), a);
  strictEqual(h.undo(), null);
});

test('undo/redo round-trip over 100 random circuits preserves isEqualTo', () => {
  const h = new History();
  const snapshots = [];
  for (let i = 0; i < 100; i++) {
    const circuit = randomCircuit();
    h.push(circuit);
    snapshots.push(circuit);
    strictEqual(h.size(), i + 1);
    strictEqual(h.current(), circuit);
  }

  // After 100 pushes, index = 99 (current is snapshots[99]).
  // Undo returns the previous state, so 99 undos yield snapshots[98]..snapshots[0],
  // then the 100th undo returns null (at the base).
  for (let k = 1; k <= 99; k++) {
    const restored = h.undo();
    ok(restored !== null, `undo #${k} returned null`);
    strictEqual(restored.isEqualTo(snapshots[99 - k]), true, `undo #${k} mismatch`);
  }
  strictEqual(h.undo(), null, 'expected null undo at the base');
  strictEqual(h.current().isEqualTo(snapshots[0]), true, 'current should be the base after full undo');

  // Redo walks forward: snapshots[1]..snapshots[99], then null at the top.
  for (let k = 1; k <= 99; k++) {
    const restored = h.redo();
    ok(restored !== null, `redo #${k} returned null`);
    strictEqual(restored.isEqualTo(snapshots[k]), true, `redo #${k} mismatch`);
  }
  strictEqual(h.redo(), null, 'expected null redo at the top');
  strictEqual(h.current().isEqualTo(snapshots[99]), true, 'current should be the last state after full redo');
});

test('current stays on the last pushed circuit when no undo performed', () => {
  const h = new History();
  const circuits = [];
  for (let i = 0; i < 50; i++) {
    const c = randomCircuit();
    circuits.push(c);
    h.push(c);
  }
  strictEqual(h.current().isEqualTo(circuits[49]), true);
  strictEqual(h.size(), 50);
});

test('History.push throws on non-Circuit argument', () => {
  const h = new History();
  throws(() => h.push({}));
  throws(() => h.push('not a circuit'));
  throws(() => h.push(null));
  throws(() => h.push(undefined));
});
