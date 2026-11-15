#!/usr/bin/env python3
"""
test/cross-validation/bloch_ref.py
----------------------------------
M1.7 — Qiskit partial-trace reference for single-qubit Bloch cross-validation.

Reads JSON from stdin:
  { "amplitudes": [[re, im], ...], "numQubits": n }

Reconstructs a Qiskit Statevector from the amplitudes (little-endian
computational-basis order, qubit 0 = LSB, matching SimQC's index convention),
then for each qubit q computes the single-qubit reduced density matrix via
Qiskit's independent partial_trace (tracing out all other qubits) and reports
the Bloch-sphere coordinates:

  r = (2*Re(rho01), -2*Im(rho01), rho00 - rho11)

Writes deterministic JSON { qubits, bloch: [{row, x, y, z}, ...] } to stdout.
Diagnostics/warnings go to stderr only.

Exit codes:
  0 — success
  1 — qiskit/numpy not installed
  2 — invalid input / simulation error

NOT an npm package. NOT required for `node --test` to pass. Opt-in only.
"""

import json
import sys

try:
    import numpy as np
    from qiskit.quantum_info import Statevector, partial_trace
except ImportError as exc:
    sys.stderr.write(
        f"bloch_ref: required package not installed: {exc}\n"
        "Install with: pip install qiskit numpy\n"
    )
    sys.exit(1)


def main():
    try:
        raw = sys.stdin.read()
    except Exception as exc:
        sys.stderr.write(f"bloch_ref: failed to read stdin: {exc}\n")
        sys.exit(2)

    if not raw.strip():
        sys.stderr.write("bloch_ref: empty stdin\n")
        sys.exit(2)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"bloch_ref: invalid JSON input: {exc}\n")
        sys.exit(2)

    if not isinstance(payload, dict):
        sys.stderr.write("bloch_ref: top-level JSON must be an object\n")
        sys.exit(2)

    amplitudes = payload.get("amplitudes")
    num_qubits = payload.get("numQubits")
    if not isinstance(num_qubits, int) or num_qubits < 1:
        sys.stderr.write(f"bloch_ref: invalid numQubits: {num_qubits}\n")
        sys.exit(2)
    if not isinstance(amplitudes, list):
        sys.stderr.write("bloch_ref: 'amplitudes' must be a list\n")
        sys.exit(2)

    num_states = 1 << num_qubits
    if len(amplitudes) != num_states:
        sys.stderr.write(
            f"bloch_ref: amplitudes length {len(amplitudes)} "
            f"does not match 2^numQubits={num_states}\n"
        )
        sys.exit(2)

    try:
        state = Statevector(
            [complex(a[0], a[1]) for a in amplitudes]
        )
    except Exception as exc:
        sys.stderr.write(f"bloch_ref: failed to build Statevector: {exc}\n")
        sys.exit(2)

    bloch = []
    for q in range(num_qubits):
        trace_out = [i for i in range(num_qubits) if i != q]
        try:
            reduced = partial_trace(state, trace_out)
        except Exception as exc:
            sys.stderr.write(
                f"bloch_ref: partial_trace failed for qubit {q}: {exc}\n"
            )
            sys.exit(2)
        rho = np.asarray(reduced.data)
        rho00 = float(rho[0, 0].real)
        rho11 = float(rho[1, 1].real)
        rho01 = complex(rho[0, 1])
        x = 2.0 * rho01.real
        y = -2.0 * rho01.imag
        z = rho00 - rho11
        bloch.append({"row": q, "x": x, "y": y, "z": z})

    output = {"qubits": num_qubits, "bloch": bloch}
    sys.stdout.write(json.dumps(output, None, 2) + "\n")


if __name__ == "__main__":
    main()
