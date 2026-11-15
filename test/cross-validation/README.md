# SimQC Cross-Validation Documentation

This directory contains optional cross-validation tests that compare SimQC's
bare-function kernels against external reference quantum computing libraries.

## Installation

### Required for cross-validation (optional — NOT npm packages)

SimQC itself has **zero JavaScript dependencies** and `node --test` passes
without any of the following installed. These are only needed for the
cross-validation suite in `test/cross-validation/`.

```bash
# Python packages (install via pip, not npm)
pip install qiskit numpy
```

**Version guidance:**
- `qiskit >= 1.0` (with `qiskit-aer` for statevector simulation)
- `numpy >= 1.26`

### Verify installation

```bash
python3 -c "import qiskit; import numpy; print('OK')"
```

## Running the Differential Suite

```bash
# Full cross-validation suite
node --test test/cross-validation/

# Individual test files
node --test test/cross-validation/qiskit-vs-simqc.test.js
node --test test/cross-validation/qiskit-gate-matrix.test.js
node --test test/cross-validation/qiskit-marginals.test.js
node --test test/cross-validation/qiskit-steptrace.test.js
node --test test/cross-validation/serializer-roundtrip.test.js
```

## Skip-When-Unavailable Behavior

Every cross-validation test that requires Qiskit/NumPy performs availability
checks at module load time:

1. **`python3` availability** — spawns `python3 --version`
2. **`qiskit`/`numpy` availability** — spawns `python3 -c "import qiskit; import numpy"`

If either check fails, the test is registered via `test.todo()` instead of
`test()`. A `todo` test is reported as skipped (not failed) by Node's test
runner, so **`node --test` passes in bare environments** where Qiskit is not
installed.

### Expected output when Qiskit is available

```
ok 1 - qiskit vs simqc: all M1 fixtures match within tolerance
ok 2 - algorithm: Bell state matches Qiskit
...
```

### Expected output when Qiskit is unavailable

```
ok 1 - qiskit vs simqc: differential comparison (python3/Qiskit unavailable) [todo]
ok 2 - algorithm: Bell state matches Qiskit [todo]
...
```

All tests pass (skipped) — no failures.

## Qiskit Differential Runner

`test/cross-validation/qiskit-differential.py` is the Python bridge between
SimQC's canonical v1 JSON circuit format and Qiskit's statevector simulator.

### Usage

```bash
# Full statevector output (default mode)
echo '{"format":"simqc-circuit",...}' | python3 test/cross-validation/qiskit-differential.py

# Marginals mode (per-qubit reduced density matrix via partial_trace)
echo '{"format":"simqc-circuit",...}' | python3 test/cross-validation/qiskit-differential.py "0,1,2"
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success — deterministic JSON on stdout |
| 1 | `qiskit`/`numpy` not installed — stderr message, no stdout |
| 2 | Invalid input / simulation error — stderr message, no stdout |

### Output schema

**Default mode:**
```json
{
  "qubits": 2,
  "probabilities": [0.5, 0, 0, 0.5],
  "amplitudes": [
    {"re": 0.7071, "im": 0},
    {"re": 0, "im": 0},
    {"re": 0, "im": 0},
    {"re": 0.7071, "im": 0}
  ]
}
```

**Marginals mode:**
```json
{
  "qubits": 2,
  "marginals": [
    {"row": 0, "rho00": 0.5, "rho11": 0.5, "gamma": 0.5, "S_L": 0.5},
    {"row": 1, "rho00": 0.5, "rho11": 0.5, "gamma": 0.5, "S_L": 0.5}
  ]
}
```

## SimQC → Qiskit Gate Mapping

SimQC row `q` maps directly to Qiskit qubit `q` (little-endian, both 0-indexed).

| SimQC gate | Qiskit equivalent | Notes |
|------------|-------------------|-------|
| `I` | `id(q)` | Identity |
| `X` | `x(q)` | Pauli-X |
| `Y` | `y(q)` | Pauli-Y |
| `Z` | `z(q)` | Pauli-Z |
| `H` | `h(q)` | Hadamard |
| `S` | `s(q)` | Phase gate |
| `T` | `t(q)` | π/8 gate |
| `CNOT` | `cx(c, t)` | Controlled NOT |
| `CZ` | `cz(c, t)` | Controlled Z |
| `SWAP` | `swap(c, t)` | Swap qubits |
| `Rx(θ)` | `rx(θ, q)` | X rotation (radians) |
| `Ry(θ)` | `ry(θ, q)` | Y rotation (radians) |
| `Rz(θ)` | `rz(θ, q)` | Z rotation (radians) |
| `Cu1(θ)` | `cu1(θ, c, t)` | Controlled U1 (radians) |
| `Toffoli` | `ccx(c0, c1, t)` | Toffoli / CCX |

## Adding a New Reference Library (Future Sprint)

To cross-validate against another library (e.g., Cirq, PennyLane), follow this
template:

### 1. Create a Python reference runner

`test/cross-validation/<lib>-differential.py`

Pattern (mirror `qiskit-differential.py`):

```python
#!/usr/bin/env python3
import json
import sys

try:
    import <lib>
except ImportError as exc:
    sys.stderr.write(f"<lib>-differential: required package not installed: {exc}\n")
    sys.exit(1)

def main():
    raw = sys.stdin.read()
    circuit_json = json.loads(raw)
    num_qubits = circuit_json["numQubits"]
    
    # Build <lib> circuit from canonical v1 JSON
    # ...
    
    # Simulate and output deterministic JSON
    # {qubits, probabilities[], amplitudes[]}
    # or marginals mode for partial trace
    # ...
    
    sys.stdout.write(json.dumps(output, None, 2) + "\n")

if __name__ == "__main__":
    main()
```

### 2. Create a Node test file

`test/cross-validation/<lib>-vs-simqc.test.js`

Pattern (mirror `qiskit-vs-simqc.test.js`):

```js
import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { spawnSync } from 'child_process';

const SCRIPT = new URL('./<lib>-differential.py', import.meta.url).pathname;

function isAvailable() {
  try {
    const r = spawnSync('python3', ['-c', 'import <lib>'], { stdio: 'ignore' });
    return r.status === 0;
  } catch { return false; }
}

function runReference(circuitJson) {
  const result = spawnSync('python3', [SCRIPT], {
    input: circuitJson, encoding: 'utf-8', maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`<lib>-differential.py exited ${result.status}: ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

const available = isAvailable();

if (!available) {
  test.todo('<lib> vs simqc: differential comparison (<lib> unavailable)');
} else {
  test('<lib> vs simqc: all fixtures match within tolerance', async (t) => {
    // For each fixture:
    //   1. Serialize SimQC circuit to canonical v1 JSON
    //   2. runReference(json) → reference state
    //   3. SimQC evaluate() → SimQC state
    //   4. Compare per-amplitude within tolerance
  });
}
```

### 3. Register in this README

Add the new library to the "Modules Cross-Validated" table below.

## Modules Cross-Validated

| SimQC module | Reference library | Test file | What is compared |
|--------------|-------------------|-----------|------------------|
| `src/core/StateVector.js` | Qiskit Statevector | `qiskit-vs-simqc.test.js` | Final state-vector amplitudes |
| `src/sim/kernel.js` | Qiskit Statevector | `qiskit-vs-simqc.test.js` | Per-gate unitary application |
| `src/sim/Evaluator.js` | Qiskit Statevector | `qiskit-vs-simqc.test.js` | Full circuit evaluation |
| `src/sim/StepTrace.js` | Qiskit Statevector (prefix circuits) | `qiskit-steptrace.test.js` | Intermediate states at each column boundary |
| `src/core/SparseSummary.js` | Qiskit partial_trace | `qiskit-marginals.test.js` | Per-qubit reduced density matrix (rho00, S_L, gamma) |
| `src/circuit/Serializer.js` | N/A (self-consistency) | `serializer-roundtrip.test.js` | JSON round-trip `isEqualTo`, key order, no unexpected fields |
| `src/gates/basis.js` | Qiskit gate library | `qiskit-gate-matrix.test.js` | I, X, Y, Z, H, S, T on \|0⟩ and \|1⟩ |
| `src/gates/param.js` | Qiskit RX/RY/RZ/CU1 | `qiskit-gate-matrix.test.js` | Rx, Ry, Rz, Cu1 with matching radian angles |
| `src/circuit/GateRegistry.js` | Qiskit gate library | `qiskit-gate-matrix.test.js` | CNOT (both directions), CZ, SWAP, Toffoli |
| `src/algorithms/qft.js` | Qiskit QFT | `qiskit-vs-simqc.test.js` | QFT(n) for n=1..4 |
| `src/algorithms/dj.js` | Qiskit (custom oracles) | `qiskit-vs-simqc.test.js` | Deutsch–Jozsa constant/balanced, n=1..3 |
| `src/algorithms/grover.js` | Qiskit GroverOperator | `qiskit-vs-simqc.test.js` | Grover n=2, peak amplification |
| `src/algorithms/shor.js` | Qiskit (order-finding) | `qiskit-vs-simqc.test.js` | Shor (15,7), (21,2), (35,2) |

## Tolerances

| Qubit count | Tolerance (per amplitude component) |
|-------------|--------------------------------------|
| n ≤ 8 | 1e-12 |
| n > 8 | 1e-9 |

Marginals tests use 1e-9 tolerance for `rho00`, `rho11`, `S_L`, `gamma`.

## File Size Constraint

Per `CONVENTIONS.md`, every source/test module must be ≤ 400 lines. All files
in this directory comply:

- `qiskit-differential.py` — ~330 lines
- `qiskit-vs-simqc.test.js` — 392 lines
- `qiskit-gate-matrix.test.js` — 310 lines
- `qiskit-marginals.test.js` — 196 lines
- `qiskit-steptrace.test.js` — 220 lines
- `serializer-roundtrip.test.js` — 398 lines

## Design Principles

1. **Zero npm dependencies** — Qiskit/NumPy are Python packages installed via `pip`, never `npm install`.
2. **NOT required for `node --test`** — all Qiskit-dependent tests skip gracefully via `test.todo()` when unavailable.
3. **stdin/stdout pipe contract** — Python runners read canonical v1 JSON from stdin, write deterministic JSON to stdout, diagnostics to stderr only.
4. **Little-endian qubit mapping** — SimQC row `q` ≡ Qiskit qubit `q`.
5. **Intermediate state verification** — StepTrace tests confirm column-by-column evolution, not just final output.
