// =============================================================================
// test/sim/limits.test.js
// -----------------------------------------------------------------------------
// Mirrors src/sim/limits.js 1:1 per CONVENTIONS.md #224
// =============================================================================

import { test } from 'node:test';
import { ok, strictEqual, throws } from 'assert';
import {
  MAX_DENSE_QUBITS,
  MAX_EPHEMERAL_QUBITS,
  HARD_CLI_CAP,
  evaluate,
} from '../../src/sim/limits.js';

// ---------------------------------------------------------------------------
// Constant thresholds
// ---------------------------------------------------------------------------

test('limits exports MAX_DENSE_QUBITS = 12', () => {
  strictEqual(MAX_DENSE_QUBITS, 12);
});

test('limits exports MAX_EPHEMERAL_QUBITS = 20', () => {
  strictEqual(MAX_EPHEMERAL_QUBITS, 20);
});

test('limits exports HARD_CLI_CAP = 24', () => {
  strictEqual(HARD_CLI_CAP, 24);
});

// ---------------------------------------------------------------------------
// evaluate() mode selection
// ---------------------------------------------------------------------------

test('evaluate(1) returns dense mode', () => {
  const p = evaluate(1);
  strictEqual(p.mode, 'dense');
  strictEqual(p.numQubits, 1);
  strictEqual(p.advisory, null);
});

test('evaluate(12) returns dense mode (boundary)', () => {
  const p = evaluate(12);
  strictEqual(p.mode, 'dense');
  strictEqual(p.advisory, null);
});

test('evaluate(13) returns ephemeral mode', () => {
  const p = evaluate(13);
  strictEqual(p.mode, 'ephemeral');
  strictEqual(p.advisory, null);
});

test('evaluate(20) returns ephemeral mode (boundary) with advisory', () => {
  const p = evaluate(20);
  strictEqual(p.mode, 'ephemeral');
  ok(p.advisory !== null, 'advisory should be set for n=20');
  ok(typeof p.advisory === 'string', 'advisory should be a string');
});

// ---------------------------------------------------------------------------
// Advisory warning for 15 <= n <= 20
// ---------------------------------------------------------------------------

test('evaluate(15) emits advisory warning', () => {
  const p = evaluate(15);
  strictEqual(p.mode, 'ephemeral');
  ok(p.advisory !== null, 'advisory should be set for n=15');
  ok(typeof p.advisory === 'string', 'advisory should be a string');
});

test('evaluate(20) emits advisory warning', () => {
  const p = evaluate(20);
  strictEqual(p.mode, 'ephemeral');
  ok(p.advisory !== null, 'advisory should be set for n=20');
});

test('evaluate(14) has no advisory warning', () => {
  const p = evaluate(14);
  strictEqual(p.advisory, null);
});

test('evaluate(21) has no advisory warning', () => {
  const p = evaluate(21);
  strictEqual(p.advisory, null);
});

// ---------------------------------------------------------------------------
// Hard cap enforcement
// ---------------------------------------------------------------------------

test('evaluate(25) throws (exceeds hard cap 24)', () => {
  throws(() => evaluate(25), /exceeds hard cap/);
});

test('evaluate(24) is allowed (at hard cap)', () => {
  const p = evaluate(24);
  strictEqual(p.mode, 'ephemeral');
  strictEqual(p.numQubits, 24);
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

test('evaluate(0) throws', () => {
  throws(() => evaluate(0), TypeError);
});

test('evaluate(-1) throws', () => {
  throws(() => evaluate(-1), TypeError);
});

test('evaluate(3.5) throws (non-integer)', () => {
  throws(() => evaluate(3.5), TypeError);
});

test('evaluate("abc") throws (non-number)', () => {
  throws(() => evaluate('abc'), TypeError);
});
