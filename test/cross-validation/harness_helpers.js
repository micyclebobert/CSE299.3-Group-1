// test/cross-validation/harness_helpers.js
// -----------------------------------------------------------------------------
// Reusable differential pipe harness for M1.8 / M2.
//
// Spawns the headless CLI (cli/cli.js), feeds canonical v1 circuit JSON on
// stdin, and returns the parsed deterministic JSON output
//   { qubits, probabilities[], amplitudes[] }
// asserted on stdout. Diagnostics/warnings must go to stderr only so stdout
// stays valid JSON. This helper is consumed by M2's Qiskit comparison tests
// and by any future reference-library runner.
// -----------------------------------------------------------------------------

import { strictEqual, ok } from 'assert';
import { spawn } from 'child_process';

const CLI_PATH = new URL('../../cli/cli.js', import.meta.url).pathname;

/**
 * Spawn the headless CLI, feed canonical v1 circuit JSON on stdin, and return
 * the parsed deterministic JSON output.
 *
 * Asserts:
 *   - the CLI exits with code 0,
 *   - stderr is empty (warnings/diagnostics belong on stderr only),
 *   - stdout parses as valid JSON,
 *   - the result has the expected shape { qubits, probabilities, amplitudes }.
 *
 * @param {string} circuitJson - canonical v1 circuit JSON string
 * @returns {Promise<{ qubits: number, probabilities: number[], amplitudes: { re: number, im: number }[] }>}
 */
export async function runCli(circuitJson) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`cli exited with code ${code}: ${stderr}`));
        return;
      }
      strictEqual(stderr.length, 0, `cli wrote to stderr: ${stderr}`);
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch (err) {
        reject(new Error(`stdout is not valid JSON: ${err.message}`));
        return;
      }
      ok(
        parsed &&
          typeof parsed === 'object' &&
          Number.isInteger(parsed.qubits) &&
          Array.isArray(parsed.probabilities) &&
          Array.isArray(parsed.amplitudes),
        `unexpected cli output shape: ${JSON.stringify(parsed).slice(0, 200)}`,
      );
      strictEqual(
        parsed.probabilities.length,
        parsed.amplitudes.length,
        'probabilities and amplitudes lengths must match',
      );
      resolve(parsed);
    });

    child.on('error', (err) => {
      reject(new Error(`failed to spawn cli: ${err.message}`));
    });

    child.stdin.write(circuitJson);
    child.stdin.end();
  });
}
