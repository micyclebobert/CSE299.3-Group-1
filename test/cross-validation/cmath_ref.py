#!/usr/bin/env python3
"""
test/cross-validation/cmath_ref.py
----------------------------------
M1.2 reference implementation: Python stdlib `cmath` complex arithmetic.

Reads JSON from stdin:
  {"ops": [
     {"op": "add", "a": [re, im], "b": [re, im]},
     {"op": "sub", ...},
     {"op": "multiply", ...},
     {"op": "divide", ...},
     {"op": "conjugate", "a": [re, im]},
     {"op": "magnitude", "a": [re, im]},
     {"op": "phase", "a": [re, im]},
     {"op": "fromPolar", "a": [magnitude, phase]},
  ]}

Writes JSON to stdout:
  {"results": [
     {"re": float, "im": float} | {"error": "..."},
     ...
  ]}

Exit code 0 on success, 2 on invalid input / simulation error.

NOT an npm package. NOT required for `node --test` to pass; the Node test
skips gracefully when python3 is unavailable.
"""

import cmath
import json
import sys


def apply_op(op, a, b):
    ca = complex(a[0], a[1])
    if op in ("add", "sub", "multiply", "divide"):
        cb = complex(b[0], b[1])
        if op == "add":
            return ca + cb
        if op == "sub":
            return ca - cb
        if op == "multiply":
            return ca * cb
        if op == "divide":
            return ca / cb  # ZeroDivisionError caught by caller
    if op == "conjugate":
        return ca.conjugate()
    if op == "magnitude":
        return abs(ca)  # real scalar
    if op == "phase":
        return cmath.phase(ca)
    if op == "fromPolar":
        # ca holds (magnitude, phase); cmath.rect(magnitude, phase).
        return cmath.rect(ca.real, ca.imag)
    raise ValueError(f"unknown op: {op}")


def main():
    data = json.load(sys.stdin)
    results = []
    for entry in data["ops"]:
        op = entry["op"]
        a = entry["a"]
        b = entry.get("b")
        try:
            value = apply_op(op, a, b)
        except (ZeroDivisionError, ValueError, TypeError) as exc:
            results.append({"error": str(exc)})
            continue
        if isinstance(value, complex):
            results.append({"re": value.real, "im": value.imag})
        else:
            results.append({"re": float(value), "im": 0.0})
    json.dump({"results": results}, sys.stdout)


if __name__ == "__main__":
    main()
