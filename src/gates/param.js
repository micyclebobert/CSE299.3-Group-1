// =============================================================================
// src/gates/param.js
// -----------------------------------------------------------------------------
// Parameterized single-qubit rotation gates.
//
// Per CONVENTIONS.md §5:
//   - θ is in radians.
//   - Each gate returns a flat 8-element number tuple:
//       [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]
//   - Kernel signatures take flat tuples, never Matrix objects.
//
// All rotations are unitary by construction.
//
// Gate Isolation: gates/ is imported exclusively by main.js. This module has
// no external imports.
// =============================================================================

/**
 * X-axis rotation: Rx(θ) = [[cos(θ/2), -i·sin(θ/2)],
 *                           [-i·sin(θ/2), cos(θ/2)]]
 * @param {number} theta - rotation angle in radians
 * @returns {number[]} flat 8-tuple
 */
export function Rx(theta) {
    const c = Math.cos(theta / 2);
    const s = Math.sin(theta / 2);
    return [c, 0, 0, -s, 0, -s, c, 0];
}

/**
 * Y-axis rotation: Ry(θ) = [[cos(θ/2), -sin(θ/2)],
 *                           [sin(θ/2), cos(θ/2)]]
 * @param {number} theta - rotation angle in radians
 * @returns {number[]} flat 8-tuple
 */
export function Ry(theta) {
    const c = Math.cos(theta / 2);
    const s = Math.sin(theta / 2);
    return [c, 0, -s, 0, s, 0, c, 0];
}

/**
 * Z-axis rotation: Rz(θ) = [[e^(-i·θ/2), 0],
 *                           [0, e^(i·θ/2)]]
 * @param {number} theta - rotation angle in radians
 * @returns {number[]} flat 8-tuple
 */
export function Rz(theta) {
    const c = Math.cos(theta / 2);
    const s = Math.sin(theta / 2);
    return [c, -s, 0, 0, 0, 0, c, s];
}
