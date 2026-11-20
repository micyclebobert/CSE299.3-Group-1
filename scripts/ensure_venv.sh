#!/usr/bin/env bash
# scripts/ensure_venv.sh
# -----------------------------------------------------------------------------
# OS-independent helper to create/refresh the SimQC Python venv used for
# cross-validation tests (Qiskit/NumPy differential verification).
#
#   ./scripts/ensure_venv.sh
#
# Environment overrides:
#   SIMQC_VENV      venv directory (default: .simqc-venv at project root)
#   SIMQC_PYTHON    python executable (default: python3)
#   SIMQC_PIP_ARGS  extra pip install args (default: --only-binary=:all:)
# -----------------------------------------------------------------------------
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${SIMQC_VENV:-$PROJECT_ROOT/.simqc-venv}"
PYTHON="${SIMQC_PYTHON:-python3}"
PIP_ARGS="${SIMQC_PIP_ARGS:---only-binary=:all:}"

# Resolve venv python + pip executables (POSIX vs Windows / Git Bash).
if [ "${OSTYPE:-}" = "msys" ] || [ "${OSTYPE:-}" = "cygwin" ] || [ "$(uname -s 2>/dev/null)" = "Windows_NT" ]; then
  VENV_BIN="$VENV_DIR/Scripts"
  PY_EXE="python.exe"
  PIP_EXE="pip.exe"
else
  VENV_BIN="$VENV_DIR/bin"
  PY_EXE="python"
  PIP_EXE="pip"
fi

VENV_PYTHON="$VENV_BIN/$PY_EXE"
VENV_PIP="$VENV_BIN/$PIP_EXE"

echo "[simqc-venv] project root: $PROJECT_ROOT"
echo "[simqc-venv] venv dir:     $VENV_DIR"
echo "[simqc-venv] python:       $PYTHON"

# Create the venv if it doesn't already exist.
if [ ! -x "$VENV_PYTHON" ]; then
  echo "[simqc-venv] creating virtual environment at $VENV_DIR ..."
  "$PYTHON" -m venv "$VENV_DIR"
fi

# Upgrade pip, then install numpy + qiskit (binary-only wheels where possible
# to avoid compiling from source). $PIP_ARGS is intentionally unquoted so it
# can expand to multiple tokens (e.g. --only-binary=:all:).
echo "[simqc-venv] upgrading pip ..."
"$VENV_PYTHON" -m pip install --upgrade pip

echo "[simqc-venv] installing numpy qiskit ($PIP_ARGS) ..."
# shellcheck disable=SC2086
"$VENV_PIP" install $PIP_ARGS numpy qiskit

echo
echo "[simqc-venv] done. Activate with:"
echo "  source $VENV_DIR/bin/activate"
echo "  (or invoke $VENV_PYTHON directly)"
