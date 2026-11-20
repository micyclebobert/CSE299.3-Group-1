import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { theme } from '../../src/ui/theme.js';

const REQUIRED_KEYS = [
  'background',
  'foreground',
  'accent',
  'panel',
  'border',
  'entanglementGlow',
  'rowSeparator',
  'gateFill',
  'gateStroke',
  'textMuted',
];

const HEX_RE = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

function parseHex(color) {
  const m = HEX_RE.exec(color);
  ok(m !== null, `expected valid hex color, got ${color}`);
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function linearize(c) {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  const { r, g, b } = parseHex(color);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

test('theme exports an object with all required keys', () => {
  ok(theme !== null && typeof theme === 'object', 'theme must be an object');
  for (const key of REQUIRED_KEYS) {
    ok(Object.prototype.hasOwnProperty.call(theme, key), `theme missing key: ${key}`);
  }
  strictEqual(Object.keys(theme).length, REQUIRED_KEYS.length);
});

test('every color value is a non-empty hex string', () => {
  for (const key of REQUIRED_KEYS) {
    const value = theme[key];
    ok(typeof value === 'string' && value.length > 0, `theme.${key} must be a non-empty string`);
    ok(HEX_RE.test(value), `theme.${key} must be a hex color, got ${value}`);
  }
});

test('background and panel are dark-mode colors', () => {
  ok(relativeLuminance(theme.background) < 0.5, `background must be dark, got ${theme.background}`);
  ok(relativeLuminance(theme.panel) < 0.5, `panel must be dark, got ${theme.panel}`);
});

test('accent is blue-dominant and entanglementGlow is green-dominant', () => {
  const accent = parseHex(theme.accent);
  ok(accent.b > accent.r && accent.b > accent.g, `accent must be blue-dominant, got ${theme.accent}`);
  const glow = parseHex(theme.entanglementGlow);
  ok(glow.g > glow.r && glow.g > glow.b, `entanglementGlow must be green-dominant, got ${theme.entanglementGlow}`);
});

test('gate keys are distinct dark colors', () => {
  const fill = parseHex(theme.gateFill);
  const stroke = parseHex(theme.gateStroke);
  const separator = parseHex(theme.rowSeparator);
  const muted = parseHex(theme.textMuted);
  ok(relativeLuminance(theme.gateFill) < 0.5, `gateFill must be dark, got ${theme.gateFill}`);
  ok(relativeLuminance(theme.gateStroke) < 0.5, `gateStroke must be dark, got ${theme.gateStroke}`);
  ok(relativeLuminance(theme.rowSeparator) < 0.5, `rowSeparator must be dark, got ${theme.rowSeparator}`);
  ok(relativeLuminance(theme.textMuted) < 0.5, `textMuted must be dark, got ${theme.textMuted}`);
  ok(fill.r !== stroke.r || fill.g !== stroke.g || fill.b !== stroke.b, 'gateFill and gateStroke must differ');
  ok(separator.r !== fill.r || separator.g !== fill.g || separator.b !== fill.b, 'rowSeparator and gateFill must differ');
});
