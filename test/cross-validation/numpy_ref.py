#!/usr/bin/env python3
"""
test/cross-validation/numpy_ref.py
----------------------------------
M1.3 reference implementation: NumPy matrix algebra.

Reads JSON from stdin:
  {"ops": [
     {"op": "multiply", "a": [[re, im], ...], "b": [[re, im], ...]},
     {"op": "tensorProduct", "a": [[re, im], ...], "b": [[re, im], ...]},
     {"op": "conjugateTranspose", "a": [[re, im], ...]},
     {"op": "isUnitary", "a": [[re, im], ...]},
     {"op": "frobeniusNormSquared", "a": [[re, im], ...]},
  ]}

Writes JSON to stdout:
  {"results": [
     {"matrix": [[re, im], ...]},   // multiply, tensorProduct, conjugateTranspose
     true | false,                   // isUnitary
     number,                         // frobeniusNormSquared
     ...
  ]}

Exit code 0 on success, 2 on invalid input / simulation error.

NOT an npm package. NOT required for `node --test` to pass; the Node test
skips gracefully when numpy is unavailable.
"""

import json
import sys

try:
    import numpy as np
except ImportError as exc:
    sys.stderr.write(f"numpy_ref: required package not installed: {exc}\n"
                     "Install with: pip install numpy\n")
    sys.exit(1)


def matrix_from_json(data):
    """Convert nested [[re, im], ...] to a numpy complex128 array."""
    return np.array(data, dtype=np.complex128)


def matrix_to_json(mat):
    """Convert a numpy complex array to nested [[re, im], ...]."""
    rows = []
    for i in range(mat.shape[0]):
        row = []
        for j in range(mat.shape[1]):
            c = complex(mat[i, j])
            row.append([c.real, c.imag])
        rows.append(row)
    return rows


def apply_op(op, a, b=None):
    if op == "multiply":
        return matrix_to_json(a @ b)
    if op == "tensorProduct":
        return matrix_to_json(np.kron(a, b))
    if op == "conjugateTranspose":
        return matrix_to_json(a.conj().T)
    if op == "isUnitary":
        n = a.shape[0]
        dagger = a.conj().T
        product = dagger @ a
        diff = product - np.eye(n, dtype=np.complex128)
        return bool(np.sum(np.abs(diff) ** 2) < 1e-12)
    if op == "frobeniusNormSquared":
        return float(np.sum(np.abs(a) ** 2))
    raise ValueError(f"unknown op: {op}")


def main():
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"numpy_ref: invalid JSON input: {exc}\n")
        sys.exit(2)

    results = []
    for entry in data["ops"]:
        op = entry["op"]
        a = matrix_from_json(entry["a"])
        b = matrix_from_json(entry["b"]) if "b" in entry else None
        try:
            value = apply_op(op, a, b)
        except (ValueError, TypeError, np.linalg.LinAlgError) as exc:
            sys.stderr.write(f"numpy_ref: op '{op}' failed: {exc}\n")
            sys.exit(2)
        results.append(value)

    json.dump({"results": results}, sys.stdout)


if __name__ == "__main__":
    main()
