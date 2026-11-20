// =============================================================================
// src/editor/gatePalette.js
// -----------------------------------------------------------------------------
// Categorized draggable gate catalog for the Left Gate Palette panel.
// Pure data: gate name, label, category, parameterized flag, default theta.
// No DOM. Only gates registered in gates/ (via main.js -> GateRegistry) are
// catalogued so the palette stays consistent with the engine.
// =============================================================================

export const CATEGORY_CORE = 'Core';
export const CATEGORY_EXTENSIONS = 'Extensions';
export const CATEGORY_SUBCIRCUITS = 'Subcircuits';

const PI_2 = Math.PI / 2;

export const GATE_CATALOG = Object.freeze([
  { name: 'I', label: 'I', category: CATEGORY_CORE, parameterized: false },
  { name: 'X', label: 'X', category: CATEGORY_CORE, parameterized: false },
  { name: 'Y', label: 'Y', category: CATEGORY_CORE, parameterized: false },
  { name: 'Z', label: 'Z', category: CATEGORY_CORE, parameterized: false },
  { name: 'H', label: 'H', category: CATEGORY_CORE, parameterized: false },
  { name: 'S', label: 'S', category: CATEGORY_CORE, parameterized: false },
  { name: 'T', label: 'T', category: CATEGORY_CORE, parameterized: false },
  { name: 'Rx', label: 'Rx', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2 },
  { name: 'Ry', label: 'Ry', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2 },
  { name: 'Rz', label: 'Rz', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2 },
  { name: 'Cu1', label: 'Cu1', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2 },
]);

export function gateCatalog() {
  return GATE_CATALOG;
}

export function gatesByCategory() {
  const byCat = new Map();
  for (const entry of GATE_CATALOG) {
    let list = byCat.get(entry.category);
    if (!list) {
      list = [];
      byCat.set(entry.category, list);
    }
    list.push(entry);
  }
  return byCat;
}

export function categoryNames() {
  return [...new Set(GATE_CATALOG.map((entry) => entry.category))];
}

export function findGate(name) {
  return GATE_CATALOG.find((entry) => entry.name === name) ?? null;
}

export function isParameterized(name) {
  const entry = findGate(name);
  return Boolean(entry && entry.parameterized);
}
