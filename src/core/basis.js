const Complex = require("./Complex");
const Matrix = require("./Matrix");

const invSqrt2 = 1 / Math.sqrt(2);

/**
 * Basis gates — fixed, non-parameterized single-qubit gates.
 *
 * Per CONVENTIONS.md §5:
 *   - Each 2x2 gate is defined once with Complex/Matrix at definition time.
 *   - The canonical hot-path form is a flat 8-element number tuple:
 *       [g00re, g00im, g01re, g01im, g10re, g10im, g11re, g11im]
 *   - Kernel signatures take flat tuples, never Matrix objects.
 *
 * All gates here are unitary by construction.
 */

/* ------------------------------------------------------------------ */
/*  Flat tuples — canonical kernel form (§5)                          */
/* ------------------------------------------------------------------ */

/** Identity gate I = [[1,0],[0,1]] */
const I = [1, 0, 0, 0, 0, 0, 1, 0];

/** Pauli-X gate X = [[0,1],[1,0]] */
const X = [0, 0, 1, 0, 1, 0, 0, 0];

/** Pauli-Y gate Y = [[0,-i],[i,0]] */
const Y = [0, 0, 0, -1, 0, 1, 0, 0];

/** Pauli-Z gate Z = [[1,0],[0,-1]] */
const Z = [1, 0, 0, 0, 0, 0, -1, 0];

/** Hadamard gate H = (1/sqrt(2)) [[1,1],[1,-1]] */
const H = [invSqrt2, 0, invSqrt2, 0, invSqrt2, 0, -invSqrt2, 0];

/** Phase gate S = [[1,0],[0,i]] */
const S = [1, 0, 0, 0, 0, 0, 0, 1];

/** T gate (pi/8 gate) = [[1,0],[0,e^(i*pi/4)]] */
const T = [1, 0, 0, 0, 0, 0, invSqrt2, invSqrt2];

/* ------------------------------------------------------------------ */
/*  Matrix forms — definition-time only (§5)                          */
/* ------------------------------------------------------------------ */

/** Identity gate as a Complex Matrix. */
const I_MATRIX = new Matrix([
    [new Complex(1, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(1, 0)],
]);

/** Pauli-X gate as a Complex Matrix. */
const X_MATRIX = new Matrix([
    [new Complex(0, 0), new Complex(1, 0)],
    [new Complex(1, 0), new Complex(0, 0)],
]);

/** Pauli-Y gate as a Complex Matrix. */
const Y_MATRIX = new Matrix([
    [new Complex(0, 0), new Complex(0, -1)],
    [new Complex(0, 1), new Complex(0, 0)],
]);

/** Pauli-Z gate as a Complex Matrix. */
const Z_MATRIX = new Matrix([
    [new Complex(1, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(-1, 0)],
]);

/** Hadamard gate as a Complex Matrix. */
const H_MATRIX = new Matrix([
    [new Complex(invSqrt2, 0), new Complex(invSqrt2, 0)],
    [new Complex(invSqrt2, 0), new Complex(-invSqrt2, 0)],
]);

/** Phase gate S as a Complex Matrix. */
const S_MATRIX = new Matrix([
    [new Complex(1, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(0, 1)],
]);

/** T gate as a Complex Matrix. */
const T_MATRIX = new Matrix([
    [new Complex(1, 0), new Complex(0, 0)],
    [new Complex(0, 0), new Complex(invSqrt2, invSqrt2)],
]);

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */

module.exports = {
    // Canonical flat tuples for the hot-path kernel
    I,
    X,
    Y,
    Z,
    H,
    S,
    T,
    // Definition-time Complex Matrix forms (validation / display)
    I_MATRIX,
    X_MATRIX,
    Y_MATRIX,
    Z_MATRIX,
    H_MATRIX,
    S_MATRIX,
    T_MATRIX,
    // Constant
    invSqrt2,
};
