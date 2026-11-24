// =============================================================================
// src/editor/gatePalette.js
// -----------------------------------------------------------------------------
// Categorized draggable gate catalog for the Left Gate Palette panel.
// Pure data: gate name, label, category, parameterized flag, default theta,
// plus arity/control metadata used by Interaction.drop() to construct valid
// gates (controls, anti-controls, target2, parameter values).
// No DOM. Only gates registered in gates/ (via main.js -> GateRegistry) are
// catalogued so the palette stays consistent with the engine.
// =============================================================================

export const CATEGORY_CORE = 'Core';
export const CATEGORY_EXTENSIONS = 'Extensions';
export const CATEGORY_SUBCIRCUITS = 'Subcircuits';

const PI_2 = Math.PI / 2;
const TWO_PI = 2 * Math.PI;

export const GATE_CATALOG = Object.freeze([
  { name: 'I', label: 'I', category: CATEGORY_CORE, parameterized: false, arity: 1, controls: 0, antiControls: 0 },
  { name: 'X', label: 'X', category: CATEGORY_CORE, parameterized: false, arity: 1, controls: 0, antiControls: 0 },
  { name: 'Y', label: 'Y', category: CATEGORY_CORE, parameterized: false, arity: 1, controls: 0, antiControls: 0 },
  { name: 'Z', label: 'Z', category: CATEGORY_CORE, parameterized: false, arity: 1, controls: 0, antiControls: 0 },
  { name: 'H', label: 'H', category: CATEGORY_CORE, parameterized: false, arity: 1, controls: 0, antiControls: 0 },
  { name: 'S', label: 'S', category: CATEGORY_CORE, parameterized: false, arity: 1, controls: 0, antiControls: 0 },
  { name: 'T', label: 'T', category: CATEGORY_CORE, parameterized: false, arity: 1, controls: 0, antiControls: 0 },
  { name: 'Rx', label: 'Rx', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2, arity: 1, controls: 0, antiControls: 0, parameterMin: -TWO_PI, parameterMax: TWO_PI, parameterStep: 0.01 },
  { name: 'Ry', label: 'Ry', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2, arity: 1, controls: 0, antiControls: 0, parameterMin: -TWO_PI, parameterMax: TWO_PI, parameterStep: 0.01 },
  { name: 'Rz', label: 'Rz', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2, arity: 1, controls: 0, antiControls: 0, parameterMin: -TWO_PI, parameterMax: TWO_PI, parameterStep: 0.01 },
  { name: 'Cu1', label: 'Cu1', category: CATEGORY_EXTENSIONS, parameterized: true, defaultTheta: PI_2, arity: 2, controls: 1, antiControls: 0, parameterMin: -TWO_PI, parameterMax: TWO_PI, parameterStep: 0.01 },
  { name: 'CNOT', label: 'CNOT', category: CATEGORY_CORE, parameterized: false, arity: 2, controls: 1, antiControls: 0 },
  { name: 'CZ', label: 'CZ', category: CATEGORY_CORE, parameterized: false, arity: 2, controls: 1, antiControls: 0 },
  { name: 'SWAP', label: 'SWAP', category: CATEGORY_CORE, parameterized: false, arity: 2, controls: 0, antiControls: 0, target2: true },
  { name: 'Toffoli', label: 'Toffoli', category: CATEGORY_CORE, parameterized: false, arity: 3, controls: 2, antiControls: 0 },
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

export function gateArity(name) {
  const entry = findGate(name);
  return entry ? entry.arity : 0;
}

export function gateControlCount(name) {
  const entry = findGate(name);
  return entry ? entry.controls : 0;
}

export function gateAntiControlCount(name) {
  const entry = findGate(name);
  return entry ? entry.antiControls : 0;
}

export function gateNeedsTarget2(name) {
  const entry = findGate(name);
  return Boolean(entry && entry.target2);
}

export function gateParameterBounds(name) {
  const entry = findGate(name);
  if (!entry || !entry.parameterized) return null;
  return {
    min: entry.parameterMin !== undefined ? entry.parameterMin : -TWO_PI,
    max: entry.parameterMax !== undefined ? entry.parameterMax : TWO_PI,
    step: entry.parameterStep !== undefined ? entry.parameterStep : 0.01,
  };
}
