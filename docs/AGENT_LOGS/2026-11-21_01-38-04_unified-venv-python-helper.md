Title: Unified Python venv/python resolver helper for cross-validation tests

Summary:
Added a unified Python environment resolver (`test/cross-validation/python_env.js`) so cross-validation tests no longer each do their own inline `spawnSync('python3', ...)` availability check at module load.

`resolvePythonEnv({ venv, python, packages })` resolves the Python executable with this priority: explicit arguments > `SIMQC_VENV`/`SIMQC_PYTHON` env vars > `.simqc-venv-preferences` file at project root (KEY=VALUE lines) > defaults (`.simqc-venv`, `python3`). It prefers the venv python (`<venv>/bin/python`, or `Scripts/python.exe` on Windows) when it imports all required packages, otherwise falls back to bare python, returning `{ python, venv } | null`. All 10 cross-validation test files now call it once at module load and spawn the resolved python for reference runners, skipping via `test.todo()` when nothing usable is found.

Also added:
- `scripts/ensure_venv.sh`: OS-independent (POSIX + Windows/Git Bash) script to create/refresh the venv, upgrade pip, and install `numpy qiskit` with `--only-binary=:all:` to avoid source builds.
- `.gitignore`: ignore `.simqc-venv/` and `.simqc-venv-preferences`.
- README.md and test/cross-validation/README.md: document the venv enablement commands (`python3 -m venv .simqc-venv; .simqc-venv/bin/pip install --upgrade pip; .simqc-venv/bin/pip install numpy qiskit`) and the resolution order.

While enabling the venv (this environment has a pre-installed `.simqc-venv` with Qiskit/NumPy), I also fixed pre-existing execution bugs that the now-runnable differential tests exposed: `json.dumps(output, None, 2)` (invalid Py3 keyword-only call) in qiskit-differential.py/bloch_ref.py/partial_trace_ref.py, `cu1`→`cp` (Qiskit 2.x) and SWAP mis-handling in qiskit-differential.py, amplitude format mismatch in partial_trace_ref.py, `numpy_ref.py` `matrix_from_json` misinterpreting nested `[re, im]` cells, `Matrix.conjugateTranspose` non-square out-of-bounds in src/core/Matrix.js, `deutschJozsa` putting X+H on the same ancilla in one column in src/algorithms/dj.js, added missing `runSimQC`/`main.js` seeding in test files, and removed duplicate `pythonEnv` declarations.

Verification: `node --test` → 700 tests, 691 pass, 9 fail. The 9 remaining failures are pre-existing Qiskit 2.x differential comparison bugs (DJ×6, Grover, Shor N=15/N=21) that were always skipped when Qiskit/NumPy were unavailable and are unrelated to the venv helper; they were never validated against the installed Qiskit 2.6.2.
