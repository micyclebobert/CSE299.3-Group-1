                            #!/usr/bin/env python3
"""
test/cross-validation/qiskit-differential.py
--------------------------------------------
M2 — Qiskit/NumPy differential verification runner.

Reads canonical v1 circuit JSON from stdin, builds an equivalent Qiskit
QuantumCircuit with explicit little-endian qubit-row mapping
(SimQC row q == Qiskit qubit q), runs Statevector simulation, and writes
deterministic JSON {qubits, probabilities[], amplitudes[]} to stdout.

Diagnostics/warnings go to stderr only so stdout stays valid JSON.

Handles gates: I, X, Y, Z, H, S, T, CNOT, CZ, SWAP, Rx, Ry, Rz, Cu1, Toffoli.

Exit codes:
  0 — success (stdout = deterministic JSON)
  1 — qiskit/numpy not installed (stderr message, no stdout)
  2 — invalid input / simulation error (stderr message, no stdout)

NOT an npm package. NOT required for `node --test` to pass. Opt-in only.
"""

import json
import sys

try:
    import numpy as np
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector
except ImportError as exc:
    sys.stderr.write(
        f"qiskit-differential: required package not installed: {exc}\n"
        "Install with: pip install qiskit numpy\n"
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# Gate name -> Qiskit gate builder
# ---------------------------------------------------------------------------
# Each builder receives (circuit, qubit_index, *params).
# Single-qubit gates apply to `qubit_index`; two-qubit gates receive
# (control, target) as the two qubit indices.
# ---------------------------------------------------------------------------

def _apply_1q(circuit, q, gate_name, theta=None):
    """Apply a single-qubit gate to qubit q."""
    if gate_name == "I":
        circuit.id(q)
    elif gate_name == "X":
        circuit.x(q)
    elif gate_name == "Y":
        circuit.y(q)
    elif gate_name == "Z":
        circuit.z(q)
    elif gate_name == "H":
        circuit.h(q)
    elif gate_name == "S":
        circuit.s(q)
    elif gate_name == "T":
        circuit.t(q)
    elif gate_name == "Rx":
        circuit.rx(theta, q)
    elif gate_name == "Ry":
        circuit.ry(theta, q)
    elif gate_name == "Rz":
        circuit.rz(theta, q)
    else:
        raise ValueError(f"Unknown single-qubit gate: {gate_name}")


def _apply_2q(circuit, c, t, gate_name, theta=None):
    """Apply a two-qubit gate with control c and target t."""
    if gate_name == "CNOT":
        circuit.cx(c, t)
    elif gate_name == "CZ":
        circuit.cz(c, t)
    elif gate_name == "SWAP":
        circuit.swap(c, t)
    elif gate_name == "Cu1":
        circuit.cu1(theta, c, t)
    else:
        raise ValueError(f"Unknown two-qubit gate: {gate_name}")


def _apply_3q(circuit, c0, c1, t, gate_name):
    """Apply a three-qubit gate with controls c0, c1 and target t."""
    if gate_name == "Toffoli":
        circuit.ccx(c0, c1, t)
    else:
        raise ValueError(f"Unknown three-qubit gate: {gate_name}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Read all of stdin as UTF-8.
    try:
        raw = sys.stdin.read()
    except Exception as exc:
        sys.stderr.write(f"qiskit-differential: failed to read stdin: {exc}\n")
        sys.exit(2)

    if not raw.strip():
        sys.stderr.write("qiskit-differential: empty stdin\n")
        sys.exit(2)

    # Parse canonical v1 circuit JSON.
    try:
        circuit_json = json.loads(raw)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"qiskit-differential: invalid JSON input: {exc}\n")
        sys.exit(2)

    # Validate required top-level fields.
    for field in ("format", "version", "bitOrder", "numQubits", "columns"):
        if field not in circuit_json:
            sys.stderr.write(
                f"qiskit-differential: missing required field '{field}'\n"
            )
            sys.exit(2)

    if circuit_json["format"] != "simqc-circuit":
        sys.stderr.write(
            f"qiskit-differential: unsupported format '{circuit_json['format']}'\n"
        )
        sys.exit(2)

    if circuit_json["version"] != 1:
        sys.stderr.write(
            f"qiskit-differential: unsupported version {circuit_json['version']}\n"
        )
        sys.exit(2)

    if circuit_json["bitOrder"] != "little-endian":
        sys.stderr.write(
            "qiskit-differential: only 'little-endian' bitOrder is supported\n"
        )
        sys.exit(2)

    num_qubits = circuit_json["numQubits"]
    if not isinstance(num_qubits, int) or num_qubits < 1:
        sys.stderr.write(
            f"qiskit-differential: invalid numQubits: {num_qubits}\n"
        )
        sys.exit(2)

    columns = circuit_json["columns"]
    if not isinstance(columns, list):
        sys.stderr.write("qiskit-differential: 'columns' must be a list\n")
        sys.exit(2)

    # Build Qiskit QuantumCircuit. SimQC row q == Qiskit qubit q
    # (little-endian mapping, both 0-indexed top-to-bottom).
    qc = QuantumCircuit(num_qubits)

    for col_idx, column in enumerate(columns):
        if not isinstance(column, list):
            sys.stderr.write(
                f"qiskit-differential: column {col_idx} is not a list\n"
            )
            sys.exit(2)

        for gate_entry in column:
            if not isinstance(gate_entry, dict):
                sys.stderr.write(
                    f"qiskit-differential: column {col_idx} contains non-dict gate\n"
                )
                sys.exit(2)

            gate_name = gate_entry.get("gate")
            if not isinstance(gate_name, str) or not gate_name:
                sys.stderr.write(
                    f"qiskit-differential: column {col_idx} gate missing 'gate' name\n"
                )
                sys.exit(2)

            target = gate_entry.get("target")
            if not isinstance(target, int) or target < 0 or target >= num_qubits:
                sys.stderr.write(
                    f"qiskit-differential: column {col_idx} gate '{gate_name}' "
                    f"has invalid target {target}\n"
                )
                sys.exit(2)

            controls = gate_entry.get("controls", [])
            if not isinstance(controls, list):
                sys.stderr.write(
                    f"qiskit-differential: column {col_idx} gate '{gate_name}' "
                    "controls must be a list\n"
                )
                sys.exit(2)

            theta = gate_entry.get("thetaRad")

            # --- Route by gate arity ---
            if gate_name in ("I", "X", "Y", "Z", "H", "S", "T"):
                _apply_1q(qc, target, gate_name)
            elif gate_name in ("Rx", "Ry", "Rz"):
                if theta is None or not isinstance(theta, (int, float)):
                    sys.stderr.write(
                        f"qiskit-differential: column {col_idx} gate '{gate_name}' "
                        "requires numeric 'thetaRad'\n"
                    )
                    sys.exit(2)
                _apply_1q(qc, target, gate_name, theta=float(theta))
            elif gate_name in ("CNOT", "CZ", "SWAP", "Cu1"):
                if len(controls) != 1:
                    sys.stderr.write(
                        f"qiskit-differential: column {col_idx} gate '{gate_name}' "
                        f"requires exactly 1 control, got {len(controls)}\n"
                    )
                    sys.exit(2)
                c = controls[0].get("row")
                if not isinstance(c, int) or c < 0 or c >= num_qubits:
                    sys.stderr.write(
                        f"qiskit-differential: column {col_idx} gate '{gate_name}' "
                        f"has invalid control row {c}\n"
                    )
                    sys.exit(2)
                if gate_name == "Cu1":
                    if theta is None or not isinstance(theta, (int, float)):
                        sys.stderr.write(
                            f"qiskit-differential: column {col_idx} gate 'Cu1' "
                            "requires numeric 'thetaRad'\n"
                        )
                        sys.exit(2)
                    _apply_2q(qc, c, target, "Cu1", theta=float(theta))
                else:
                    _apply_2q(qc, c, target, gate_name)
            elif gate_name == "Toffoli":
                if len(controls) != 2:
                    sys.stderr.write(
                        f"qiskit-differential: column {col_idx} gate 'Toffoli' "
                        f"requires exactly 2 controls, got {len(controls)}\n"
                    )
                    sys.exit(2)
                c0 = controls[0].get("row")
                c1 = controls[1].get("row")
                for label, c in (("first", c0), ("second", c1)):
                    if not isinstance(c, int) or c < 0 or c >= num_qubits:
                        sys.stderr.write(
                            f"qiskit-differential: column {col_idx} gate 'Toffoli' "
                            f"has invalid {label} control row {c}\n"
                        )
                        sys.exit(2)
                _apply_3q(qc, c0, c1, target, "Toffoli")
            else:
                sys.stderr.write(
                    f"qiskit-differential: column {col_idx} unknown gate '{gate_name}'\n"
                )
                sys.exit(2)

    # Run Statevector simulation.
    try:
        statevector = Statevector(qc)
    except Exception as exc:
        sys.stderr.write(f"qiskit-differential: simulation failed: {exc}\n")
        sys.exit(2)

    # Extract amplitudes and probabilities.
    # Qiskit Statevector.data is already in little-endian computational basis
    # order matching SimQC's index convention (qubit 0 = LSB).
    amplitudes_data = np.asarray(statevector.data)
    num_states = 1 << num_qubits

    probabilities = []
    amplitudes = []
    for i in range(num_states):
        amp = complex(amplitudes_data[i])
        amplitudes.append({"re": float(amp.real), "im": float(amp.imag)})
        probabilities.append(float(amp.real * amp.real + amp.imag * amp.imag))

    output = {
        "qubits": num_qubits,
        "probabilities": probabilities,
        "amplitudes": amplitudes,
    }

    sys.stdout.write(json.dumps(output, None, 2) + "\n")


if __name__ == "__main__":
    main()
