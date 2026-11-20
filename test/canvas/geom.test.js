// geom.test.js - Tests for canvas coordinate helpers
// Mirrors src/canvas/geom.js 1:1 per CONVENTIONS.md
import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { Point, Rect, hitTest, clamp, snapToGrid } from '../../src/canvas/geom.js';

test('hitTest returns true for point inside rect', () => {
  const rect = new Rect(10, 20, 100, 50);
  ok(hitTest(new Point(50, 40), rect));
  ok(hitTest(new Point(10, 20), rect));
  ok(hitTest(new Point(110, 70), rect));
});

test('hitTest returns false for point outside rect', () => {
  const rect = new Rect(10, 20, 100, 50);
  ok(!hitTest(new Point(9, 20), rect));
  ok(!hitTest(new Point(111, 20), rect));
  ok(!hitTest(new Point(10, 19), rect));
  ok(!hitTest(new Point(10, 71), rect));
  ok(!hitTest(new Point(0, 0), rect));
});

test('clamp returns min when below min', () => {
  strictEqual(clamp(-5, 0, 10), 0);
});

test('clamp returns max when above max', () => {
  strictEqual(clamp(15, 0, 10), 10);
});

test('clamp returns value when inside range', () => {
  strictEqual(clamp(5, 0, 10), 5);
});

test('snapToGrid snaps up and down to nearest multiple', () => {
  strictEqual(snapToGrid(37, 10), 40);
  strictEqual(snapToGrid(34, 10), 30);
});

test('snapToGrid returns exact multiple unchanged', () => {
  strictEqual(snapToGrid(40, 10), 40);
  strictEqual(snapToGrid(0, 10), 0);
});

test('snapToGrid passthrough when grid <= 0', () => {
  strictEqual(snapToGrid(37, 0), 37);
  strictEqual(snapToGrid(37, -5), 37);
});
