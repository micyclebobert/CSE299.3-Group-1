import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { readFileSync } from 'node:fs';
import { theme, themeCssVariables } from '../../src/ui/theme.js';

const REQUIRED_KEYS = [
  'background',
  'panel',
  'panelRaised',
  'foreground',
  'textMuted',
  'border',
  'borderStrong',
  'accent',
  'accentHover',
  'accentContrast',
  'focus',
  'selection',
  'control',
  'controlHover',
  'gateFill',
  'gateStroke',
  'rowSeparator',
  'entanglementGlow',
  'phaseAccent',
  'entropyAccent',
  'success',
  'warning',
  'danger',
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

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
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
  ok(relativeLuminance(theme.panelRaised) < 0.5, `panelRaised must be dark, got ${theme.panelRaised}`);
  ok(relativeLuminance(theme.control) < 0.5, `control must be dark, got ${theme.control}`);
});

test('semantic accents retain their intended hue families', () => {
  const accent = parseHex(theme.accent);
  ok(accent.b > accent.r && accent.b > accent.g, `accent must be blue-dominant, got ${theme.accent}`);
  const glow = parseHex(theme.entanglementGlow);
  ok(glow.g > glow.r && glow.g > glow.b, `entanglementGlow must be green-dominant, got ${theme.entanglementGlow}`);
  const phase = parseHex(theme.phaseAccent);
  ok(phase.r > phase.b && phase.b > phase.g, `phaseAccent must be magenta-dominant, got ${theme.phaseAccent}`);
  const entropy = parseHex(theme.entropyAccent);
  ok(entropy.r > entropy.g && entropy.g > entropy.b, `entropyAccent must be amber-dominant, got ${theme.entropyAccent}`);
});

test('foreground and semantic accents meet WCAG AA on dark surfaces', () => {
  ok(contrastRatio(theme.foreground, theme.background) >= 4.5);
  ok(contrastRatio(theme.textMuted, theme.panel) >= 4.5);
  ok(contrastRatio(theme.accent, theme.background) >= 4.5);
  ok(contrastRatio(theme.accentHover, theme.background) >= 4.5);
  ok(contrastRatio(theme.entanglementGlow, theme.background) >= 4.5);
  ok(contrastRatio(theme.phaseAccent, theme.background) >= 4.5);
  ok(contrastRatio(theme.entropyAccent, theme.background) >= 4.5);
  ok(contrastRatio(theme.success, theme.background) >= 4.5);
  ok(contrastRatio(theme.warning, theme.background) >= 4.5);
  ok(contrastRatio(theme.danger, theme.background) >= 4.5);
  ok(contrastRatio(theme.foreground, theme.selection) >= 4.5);
  ok(contrastRatio(theme.accentContrast, theme.accent) >= 4.5);
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

test('CSS variables are immutable and synchronized with the theme', () => {
  ok(Object.isFrozen(theme));
  ok(Object.isFrozen(themeCssVariables));
  strictEqual(Object.keys(themeCssVariables).length, REQUIRED_KEYS.length);
  for (const key of REQUIRED_KEYS) {
    const cssName = `--simqc-${key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
    strictEqual(themeCssVariables[cssName], theme[key]);
  }
});

test('browser shell uses theme variables instead of ad-hoc hex colors', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const adHocColors = html.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(|\b(?:Canvas|CanvasText|black|white|red|blue|green|gray|grey|orange|purple|cyan|magenta|yellow)\b/g) ?? [];
  strictEqual(adHocColors.length, 0, `index.html contains ad-hoc colors: ${adHocColors.join(', ')}`);

  const references = [...html.matchAll(/var\(--simqc-([a-z0-9-]+)/g)].map((match) => `--simqc-${match[1]}`);
  ok(references.length > 0, 'index.html should reference canonical theme variables');
  for (const reference of references) {
    ok(
      Object.prototype.hasOwnProperty.call(themeCssVariables, reference),
      `index.html references unknown theme variable: ${reference}`,
    );
  }
});
