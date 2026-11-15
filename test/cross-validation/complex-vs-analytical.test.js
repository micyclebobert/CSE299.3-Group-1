// test/cross-validation/complex-vs-analytical.test.js
// -----------------------------------------------------------------------------
// M1.2 — Complex arithmetic cross-validation.
//
// Compares src/core/Complex.js operations against:
//   1. Hand-computed analytical values (always run, exact constants).
//   2. Python stdlib `cmath` via test/cross-validation/cmath_ref.py
//      (skipped gracefully when python3 is unavailable, so `node --test`
//      passes in bare environments).
//
// Tolerance: 1e-12 per component (CONVENTIONS.md #225-226).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'assert';
import { spawnSync } from 'child_process';
import { Complex } from '../../src/core/Complex.js';

const REF_SCRIPT = new URL('./cmath_ref.py', import.meta.url).pathname;
const TOL = 1e-12;

/* ------------------------------------------------------------------ */
/*  Deterministic seeded PRNG (mulberry32)                            */
/* ------------------------------------------------------------------ */

let rngSeed = 0x243f6a88;
function randUint32() {
  rngSeed = (rngSeed + 0x9e3779b9) | 0;
  let z = rngSeed;
  z = (z ^ (z >>> 16)) >>> 0;
  z = Math.imul(z, 0x21f0aa8d) >>> 0;
  z = (z ^ (z >>> 15)) >>> 0;
  z = Math.imul(z, 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

function randFloat(min, max) {
  return min + (randUint32() / 0xffffffff) * (max - min);
}

function randComplex() {
  return [randFloat(-10, 10), randFloat(-10, 10)];
}

/* ------------------------------------------------------------------ */
/*  Python cmath reference                                            */
/* ------------------------------------------------------------------ */

function isPython3Available() {
  try {
    const result = spawnSync('python3', ['--version'], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
}

function runRef(ops) {
  const result = spawnSync('python3', [REF_SCRIPT], {
    input: JSON.stringify({ ops }),
    encoding: 'utf-8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `cmath_ref.py exited ${result.status}: ${result.stderr.toString()}`,
    );
  }
  return JSON.parse(result.stdout).results;
}

function assertComplexClose(actual, expected, label) {
  ok(
    Math.abs(actual.real - expected.re) <= TOL,
    `${label}: real mismatch actual=${actual.real} expected=${expected.re}`,
  );
  ok(
    Math.abs(actual.imaginary - expected.im) <= TOL,
    `${label}: imaginary mismatch actual=${actual.imaginary} expected=${expected.im}`,
  );
}

/* ------------------------------------------------------------------ */
/*  1. Hand-computed analytical values (always run)                   */
/* ------------------------------------------------------------------ */

test('Complex add analytical: (1+2i) + (3+4i) = 4+6i', () => {
  const c = new Complex(1, 2).add(new Complex(3, 4));
  strictEqual(c.real, 4);
  strictEqual(c.imaginary, 6);
});

test('Complex sub analytical: (5+7i) - (2+3i) = 3+4i', () => {
  const c = new Complex(5, 7).sub(new Complex(2, 3));
  strictEqual(c.real, 3);
  strictEqual(c.imaginary, 4);
});

test('Complex multiply analytical: (1+2i)(3+4i) = -5+10i', () => {
  const c = new Complex(1, 2).multiply(new Complex(3, 4));
  strictEqual(c.real, -5);
  strictEqual(c.imaginary, 10);
});

test('Complex multiply by real scalar: (2+3i) * 5 = 10+15i', () => {
  const c = new Complex(2, 3).multiply(new Complex(5));
  strictEqual(c.real, 10);
  strictEqual(c.imaginary, 15);
});

test('Complex multiply by i: (1+2i) * i = -2+1i', () => {
  const c = new Complex(1, 2).multiply(new Complex(0, 1));
  strictEqual(c.real, -2);
  strictEqual(c.imaginary, 1);
});

test('Complex divide analytical: (1+2i)/(3+4i) = 0.44+0.08i', () => {
  const result = new Complex(1, 2).divide(new Complex(3, 4));
  ok(Math.abs(result.real - 11 / 25) <= TOL, 'real part');
  ok(Math.abs(result.imaginary - 2 / 25) <= TOL, 'imaginary part');
});

test('Complex divide by unit magnitude preserves value: z / 1 = z', () => {
  const z = new Complex(-3.7, 2.1);
  const result = z.divide(new Complex(1));
  strictEqual(result.real, z.real);
  strictEqual(result.imaginary, z.imaginary);
});

test('Complex conjugate analytical: conjugate(3-4i) = 3+4i', () => {
  const c = new Complex(3, -4).conjugate();
  strictEqual(c.real, 3);
  strictEqual(c.imaginary, 4);
});

test('Complex conjugate involution: conjugate(conjugate(z)) = z', () => {
  const z = new Complex(-2.5, 7.25);
  strictEqual(z.conjugate().conjugate().real, z.real);
  strictEqual(z.conjugate().conjugate().imaginary, z.imaginary);
});

test('Complex magnitude analytical: |3+4i| = 5', () => {
  strictEqual(new Complex(3, 4).magnitude(), 5);
  strictEqual(new Complex(0, 5).magnitude(), 5);
  strictEqual(new Complex(0, 0).magnitude(), 0);
});

test('Complex magnitudeSquared analytical: |3+4i|^2 = 25', () => {
  strictEqual(new Complex(3, 4).magnitudeSquared(), 25);
});

test('Complex phase quadrant correctness', () => {
  ok(Math.abs(new Complex(1, 0).phase() - 0) <= TOL, 'phase(1,0) = 0');
  ok(
    Math.abs(new Complex(0, 1).phase() - Math.PI / 2) <= TOL,
    'phase(0,1) = pi/2',
  );
  ok(
    Math.abs(new Complex(-1, 0).phase() - Math.PI) <= TOL,
    'phase(-1,0) = pi',
  );
  ok(
    Math.abs(new Complex(0, -1).phase() - (-Math.PI / 2)) <= TOL,
    'phase(0,-1) = -pi/2',
  );
  ok(
    Math.abs(new Complex(-1, -1).phase() - (-3 * Math.PI / 4)) <= TOL,
    'phase(-1,-1) = -3pi/4',
  );
  ok(
    Math.abs(new Complex(1, 1).phase() - Math.PI / 4) <= TOL,
    'phase(1,1) = pi/4',
  );
});

test('Complex fromPolar analytical: fromPolar(2, 0) = 2+0i', () => {
  const c = Complex.fromPolar(2, 0);
  ok(Math.abs(c.real - 2) <= TOL);
  ok(Math.abs(c.imaginary - 0) <= TOL);
});

test('Complex fromPolar analytical: fromPolar(1, pi/2) = 0+1i', () => {
  const c = Complex.fromPolar(1, Math.PI / 2);
  ok(Math.abs(c.real) <= TOL);
  ok(Math.abs(c.imaginary - 1) <= TOL);
});

test('Complex fromPolar analytical: fromPolar(2, pi) = -2+0i', () => {
  const c = Complex.fromPolar(2, Math.PI);
  ok(Math.abs(c.real - (-2)) <= TOL);
  ok(Math.abs(c.imaginary) <= TOL);
});

test('Complex fromPolar round-trip: magnitude/phase preserved', () => {
  const z = new Complex(-1.7, 2.3);
  const polar = Complex.fromPolar(z.magnitude(), z.phase());
  ok(Math.abs(polar.real - z.real) <= TOL, 'real round-trip');
  ok(Math.abs(polar.imaginary - z.imaginary) <= TOL, 'imaginary round-trip');
});

test('Complex divide by zero throws RangeError', () => {
  throws(() => new Complex(1, 2).divide(new Complex(0, 0)), RangeError);
});

test('Complex from throws TypeError for invalid input', () => {
  throws(() => Complex.from({}), TypeError);
  throws(() => Complex.from('5'), TypeError);
  throws(() => Complex.from(null), TypeError);
});

test('Complex scale throws TypeError for non-number scalar', () => {
  throws(() => new Complex(1, 2).scale('2'), TypeError);
});

/* ------------------------------------------------------------------ */
/*  2. Python cmath reference (skipped when python3 unavailable)      */
/* ----------------------------------------------------------------------------- */

const python3Available = isPython3Available();

if (!python3Available) {
  test.todo('Complex vs Python cmath (python3 unavailable)');
} else {
  test('Complex vs cmath: random add/sub/multiply/divide', () => {
    const ops = [];
    const labels = [];
    const values = [];
    for (let i = 0; i < 40; i += 1) {
      const a = randComplex();
      const b = randComplex();
      values.push({ label: `add[${i}]`, a, b, op: 'add' });
      values.push({ label: `sub[${i}]`, a, b, op: 'sub' });
      values.push({ label: `multiply[${i}]`, a, b, op: 'multiply' });
      // Avoid (near-)zero divisors so neither side raises.
      if (Math.hypot(b[0], b[1]) > 0.01) {
        values.push({ label: `divide[${i}]`, a, b, op: 'divide' });
      }
    }
    for (const v of values) {
      ops.push({ op: v.op, a: v.a, b: v.b });
    }

    const ref = runRef(ops);
    strictEqual(ref.length, values.length, 'reference result count');

    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      const ca = new Complex(v.a[0], v.a[1]);
      const cb = new Complex(v.b[0], v.b[1]);
      let actual;
      if (v.op === 'add') actual = ca.add(cb);
      else if (v.op === 'sub') actual = ca.sub(cb);
      else if (v.op === 'multiply') actual = ca.multiply(cb);
      else actual = ca.divide(cb);
      assertComplexClose(actual, ref[i], v.label);
    }
  });

  test('Complex vs cmath: random conjugate/magnitude/phase', () => {
    const ops = [];
    const values = [];
    for (let i = 0; i < 40; i += 1) {
      const a = randComplex();
      values.push({ label: `conjugate[${i}]`, a, op: 'conjugate' });
      values.push({ label: `magnitude[${i}]`, a, op: 'magnitude' });
      values.push({ label: `phase[${i}]`, a, op: 'phase' });
    }
    for (const v of values) {
      ops.push({ op: v.op, a: v.a });
    }

    const ref = runRef(ops);
    strictEqual(ref.length, values.length, 'reference result count');

    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      const ca = new Complex(v.a[0], v.a[1]);
      let actual;
      if (v.op === 'conjugate') actual = ca.conjugate();
      else if (v.op === 'magnitude') {
        ok(
          Math.abs(ca.magnitude() - ref[i].re) <= TOL,
          `${v.label}: magnitude mismatch`,
        );
        continue;
      } else {
        actual = ca; // phase handled below
      }
      if (v.op === 'conjugate') {
        assertComplexClose(actual, ref[i], v.label);
      } else if (v.op === 'phase') {
        ok(
          Math.abs(ca.phase() - ref[i].re) <= TOL,
          `${v.label}: phase mismatch actual=${ca.phase()} expected=${ref[i].re}`,
        );
      }
    }
  });

  test('Complex vs cmath: random fromPolar', () => {
    const ops = [];
    const values = [];
    for (let i = 0; i < 40; i += 1) {
      const magnitude = randFloat(0.01, 10);
      const phase = randFloat(-Math.PI, Math.PI);
      values.push({ label: `fromPolar[${i}]`, a: [magnitude, phase], op: 'fromPolar' });
    }
    for (const v of values) {
      ops.push({ op: v.op, a: v.a });
    }

    const ref = runRef(ops);
    strictEqual(ref.length, values.length, 'reference result count');

    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      const actual = Complex.fromPolar(v.a[0], v.a[1]);
      assertComplexClose(actual, ref[i], v.label);
    }
  });
}
