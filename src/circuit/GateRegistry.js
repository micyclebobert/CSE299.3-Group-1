// =============================================================================
// src/circuit/GateRegistry.js
// -----------------------------------------------------------------------------
// Quantum gate registry — central lookup for all gates used by the
// application.
//
// Per CONVENTIONS.md §5:
//   - Gate lookups return flat 8-tuples for the hot-path kernel.
//   - θ is in radians for parameterized gates.
//
// Layering: circuit/ imports core/ and internal circuit/ only. This module
// imports NOTHING from gates/ — main.js is the sole importer of gates/ and
// registers gate implementations here via registerFixedGate /
// registerParameterizedGate, then calls seal() to freeze the registry.
//
// Immutability: after seal(), the internal maps cannot be mutated.
// =============================================================================

/* ------------------------------------------------------------------ */
/*  Mutable during construction, frozen after seal()                  */
/* ------------------------------------------------------------------ */

const FIXED_GATES = new Map();
const PARAMETERIZED_GATES = new Map();
let sealed = false;

function requireUnsealed() {
  if (sealed) {
    throw new Error('Gate registry is sealed: no further registration allowed');
  }
}

/**
 * Register a fixed gate's canonical flat 8-tuple. Callable only before seal().
 *
 * @param {string} name - gate name ('I', 'X', 'Y', 'Z', 'H', 'S', 'T')
 * @param {number[]} flatTuple - flat 8-tuple
 */
export function registerFixedGate(name, flatTuple) {
  requireUnsealed();
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('Gate name must be a non-empty string');
  }
  if (!Array.isArray(flatTuple) || flatTuple.length !== 8) {
    throw new TypeError('flatTuple must be a number[8]');
  }
  FIXED_GATES.set(name, flatTuple);
}

/**
 * Register a parameterized rotation gate constructor. Callable only before
 * seal().
 *
 * @param {string} name - gate name ('Rx', 'Ry', 'Rz')
 * @param {(theta: number) => number[]} fn - pure function thetaRad => flat 8-tuple
 */
export function registerParameterizedGate(name, fn) {
  requireUnsealed();
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('Gate name must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Parameterized gate must be a function');
  }
  PARAMETERIZED_GATES.set(name, fn);
}

/**
 * Freeze the registry so no further registration is allowed. Call once all
 * gates have been registered (by main.js).
 */
export function seal() {
  sealed = true;
  Object.freeze(FIXED_GATES);
  Object.freeze(PARAMETERIZED_GATES);
}

/**
 * Look up a fixed gate by name and return its canonical flat 8-tuple.
 *
 * @param {string} name - gate name
 * @returns {number[]} flat 8-tuple, or undefined if unknown
 */
export function getFixedGate(name) {
  return FIXED_GATES.get(name);
}

/**
 * Look up a parameterized rotation gate constructor by name.
 *
 * @param {string} name - gate name ('Rx', 'Ry', 'Rz')
 * @returns {(theta: number) => number[]|undefined}
 */
export function getParameterizedGate(name) {
  return PARAMETERIZED_GATES.get(name);
}

/**
 * Resolve any gate by name. For parameterized gates, pass θ in radians;
 * the result is a flat 8-tuple ready for the hot-path kernel.
 *
 * @param {string} name - gate name
 * @param {number} [theta] - rotation angle in radians (required for Rx/Ry/Rz)
 * @returns {number[]} flat 8-tuple, or undefined if unknown
 */
export function getGate(name, theta) {
  const fixed = FIXED_GATES.get(name);
  if (fixed !== undefined) {
    return fixed;
  }

  const param = PARAMETERIZED_GATES.get(name);
  if (param !== undefined) {
    if (theta === undefined) {
      throw new Error(`Gate '${name}' requires a rotation angle θ (radians)`);
    }
    return param(theta);
  }

  return undefined;
}

/**
 * List all registered gate names.
 *
 * @returns {string[]}
 */
export function listGates() {
  return [...FIXED_GATES.keys(), ...PARAMETERIZED_GATES.keys()];
}
