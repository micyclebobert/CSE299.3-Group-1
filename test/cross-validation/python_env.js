// test/cross-validation/python_env.js
// -----------------------------------------------------------------------------
// Unified Python environment resolution for SimQC cross-validation tests.
//
// Resolution priority (highest first):
//   1. Explicit arguments (venv, python)
//   2. Environment variables (SIMQC_VENV, SIMQC_PYTHON)
//   3. Defaults: venv = ".simqc-venv", python = "python3"
//
// Returns { python: string, venv: string | null } | null
//   - python: executable path to spawn for reference runners
//   - venv: resolved venv directory path, or null when bare python is used
// -----------------------------------------------------------------------------

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

const PROJECT_ROOT = new URL('../..', import.meta.url).pathname
  .replace(/^\/([a-zA-Z]:)/, '$1');

const DEFAULT_VENV = '.simqc-venv';
const DEFAULT_PYTHON = 'python3';
const DEFAULT_PACKAGES = ['qiskit', 'numpy'];

function resolvePath(base, ...parts) {
  let joined = base;
  for (const part of parts) {
    joined = joined.replace(/\/+$/, '') + '/' + part.replace(/^\/+/, '');
  }
  return joined;
}

function resolveValue(arg, envKey, defaultValue) {
  if (arg !== undefined && arg !== null && arg !== '') return arg;
  const env = process.env[envKey];
  if (env !== undefined && env !== '') return env;
  return defaultValue;
}

function venvPythonPath(venv) {
  const binDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  const exe = process.platform === 'win32' ? 'python.exe' : 'python';
  return resolvePath(venv, binDir, exe);
}

function hasPackages(python, packages) {
  const code = packages.map((pkg) => `import ${pkg}`).join('; ');
  try {
    const result = spawnSync(python, ['-c', code], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Resolve a Python executable usable for cross-validation tests.
 *
 * Resolution:
 *   1. explicit options.venv / options.python (highest priority)
 *   2. SIMQC_VENV / SIMQC_PYTHON environment variables
 *   3. defaults (.simqc-venv, python3)
 *
 * If the venv exists and its python imports all required packages, the venv
 * python is returned. Otherwise the bare python is tested and returned if it
 * imports all required packages. Returns null when neither works.
 *
 * @param {Object} [options]
 * @param {string} [options.venv] - venv dir name/path
 * @param {string} [options.python] - python executable
 * @param {string[]} [options.packages] - modules that must import OK
 * @returns {{ python: string, venv: string | null } | null}
 */
export function resolvePythonEnv({ venv, python, packages = DEFAULT_PACKAGES } = {}) {
  const resolvedVenv = resolveValue(venv, 'SIMQC_VENV', DEFAULT_VENV);
  const resolvedPython = resolveValue(python, 'SIMQC_PYTHON', DEFAULT_PYTHON);

  const venvPath = resolvedVenv.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(resolvedVenv)
    ? resolvedVenv
    : resolvePath(PROJECT_ROOT, resolvedVenv);

  // 1. Try venv python: <venv>/bin/python (Scripts/python.exe on Windows).
  const venvPy = venvPythonPath(venvPath);
  if (existsSync(venvPy) && hasPackages(venvPy, packages)) {
    return { python: venvPy, venv: venvPath };
  }

  // 2. Try bare python from PATH (or user-provided).
  if (hasPackages(resolvedPython, packages)) {
    return { python: resolvedPython, venv: null };
  }

  return null;
}
