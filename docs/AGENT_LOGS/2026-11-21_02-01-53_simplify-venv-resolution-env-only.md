Title: Simplify Python/venv resolution — remove preferences file, keep env vars only

Summary:
Simplified the cross-validation Python environment resolution by dropping the
`.simqc-venv-preferences` file. Env vars (`SIMQC_VENV` / `SIMQC_PYTHON`) are
now the only global override mechanism (alongside explicit per-call arguments),
reducing hidden state and config surface area.

Changes:
- `test/cross-validation/python_env.js`: removed `readPreferences()`,
  `PREFERENCES_FILE`, `readFileSync` import, and the prefs layer of
  `resolveValue()`. Resolution is now: explicit arguments > `SIMQC_VENV` /
  `SIMQC_PYTHON` env vars > defaults (`.simqc-venv`, `python3`).
- `.gitignore`: removed `.simqc-venv-preferences`.
- README.md and test/cross-validation/README.md: updated the resolution-order
  documentation to drop references to the preferences file (and fixed a
  `venu`→`venv` typo).

Verification: `node --test` → 700 tests, 691 pass, 9 fail. The 9 remaining
failures are pre-existing Qiskit 2.x differential-comparison bugs (DJ×6,
Grover, Shor N=15/N=21) that were always skipped when Qiskit/NumPy were
unavailable and are unrelated to this change.
