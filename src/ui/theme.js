export const theme = Object.freeze({
  background: '#181818',
  panel: '#252526',
  panelRaised: '#2d2d2d',
  foreground: '#d4d4d4',
  textMuted: '#a6a6a6',
  border: '#3c3c3c',
  borderStrong: '#555555',
  accent: '#4daafc',
  accentHover: '#75beff',
  accentContrast: '#101010',
  focus: '#75beff',
  selection: '#264f78',
  control: '#3a3d41',
  controlHover: '#45494e',
  gateFill: '#3a3d41',
  gateStroke: '#555555',
  rowSeparator: '#2d2d2d',
  entanglementGlow: '#00e6a4',
  phaseAccent: '#c586c0',
  entropyAccent: '#d7ba7d',
  success: '#89d185',
  warning: '#cca700',
  danger: '#f48771',
});

function toKebabCase(name) {
  return name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

export const themeCssVariables = Object.freeze(
  Object.fromEntries(
    Object.entries(theme).map(([name, value]) => [`--simqc-${toKebabCase(name)}`, value]),
  ),
);
