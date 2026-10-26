/**
 * Quantum gate registry — central lookup for all gates used by the
 * application. Fixed gates come from `basis.js`; parameterized rotation
 * gates come from `param.js`.
 *
 * Per CONVENTIONS.md §5:
 *   - Gate lookups return flat 8-tuples for the hot-path kernel.
 *   - θ is in radians for parameterized gates.
 *
 * Immutability: once built, the internal maps cannot be added to,
 * removed from, or replaced. All mutating Map operations throw.
 */

import {
    I, X, Y, Z, H, S, T,
    I_MATRIX, X_MATRIX, Y_MATRIX, Z_MATRIX, H_MATRIX, S_MATRIX, T_MATRIX,
} from './basis.js';

import { Rx, Ry, Rz } from './param.js';

/* ------------------------------------------------------------------ */
/*  Immutable read-only Map wrapper                                   */
/* ------------------------------------------------------------------ */

const MUTATING_METHODS = new Set(['set', 'delete', 'clear']);

/**
 * Wrap a Map so that every read works normally but every mutating
 * operation (set/delete/clear) throws. The wrapper itself is frozen
 * so the handler cannot be swapped either.
 */
function freezeMap(map) {
    const proxy = new Proxy(map, {
        get(target, prop, receiver) {
            if (MUTATING_METHODS.has(prop)) {
                throw new Error(
                    `Gate registry is immutable: Map.${prop}() is not allowed`
                );
            }
            const value = Reflect.get(target, prop, receiver);
            // Bind Map methods to the underlying Map so `this` inside them is the
            // real Map, not the proxy (otherwise Map.prototype methods throw an
            // "incompatible receiver" TypeError).
            return typeof value === 'function' ? value.bind(target) : value;
        },
        set() {
            throw new Error(
                'Gate registry is immutable: cannot reassign properties'
            );
        },
        deleteProperty() {
            throw new Error(
                'Gate registry is immutable: cannot delete properties'
            );
        },
    });
    return Object.freeze(proxy);
}

/* ------------------------------------------------------------------ */
/*  Build gate maps (done once at module load)                        */
/* ------------------------------------------------------------------ */

const FIXED_GATES = freezeMap(new Map([
    ['I', I],
    ['X', X],
    ['Y', Y],
    ['Z', Z],
    ['H', H],
    ['S', S],
    ['T', T],
]));

const FIXED_MATRICES = freezeMap(new Map([
    ['I', I_MATRIX],
    ['X', X_MATRIX],
    ['Y', Y_MATRIX],
    ['Z', Z_MATRIX],
    ['H', H_MATRIX],
    ['S', S_MATRIX],
    ['T', T_MATRIX],
]));

const PARAMETERIZED_GATES = freezeMap(new Map([
    ['Rx', Rx],
    ['Ry', Ry],
    ['Rz', Rz],
]));

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/**
 * Look up a fixed gate by name and return its canonical flat 8-tuple.
 *
 * @param {string} name - gate name ('I', 'X', 'Y', 'Z', 'H', 'S', 'T')
 * @returns {number[]} flat 8-tuple, or undefined if unknown
 */
export function getFixedGate(name) {
    return FIXED_GATES.get(name);
}

/**
 * Look up a fixed gate's Complex Matrix form (definition-time only,
 * for validation / display — never inside kernel loops).
 *
 * @param {string} name - gate name
 * @returns {import('./Matrix.js').default|undefined}
 */
export function getFixedMatrix(name) {
    return FIXED_MATRICES.get(name);
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
