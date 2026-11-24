// =============================================================================
// cli/cli.js
// -----------------------------------------------------------------------------
// Bare Node.js CLI runner (headless).
//
//   cat test/fixtures/bell_state.json | node cli/cli.js
//
// Reads canonical v1 circuit JSON from process.stdin, parses it, runs the
// simulation, and writes deterministic JSON state-vector output to
// process.stdout. All diagnostics/warnings go to process.stderr so stdout
// stays valid JSON.
//
// Zero-DOM guardrail: every module in the import graph is DOM-free, so this
// runs cleanly in bare Node and crashes immediately if any module imports
// window or document.
//
// Location: cli/ (per FOLDER_STRUCTURE Group 7), not src/.
// =============================================================================

import { fromJson } from '../src/circuit/Serializer.js';
import { flattenCircuit } from '../src/circuit/Flatten.js';
import { scheduleColumns } from '../src/circuit/Flatten.js';
import { evaluate } from '../src/sim/Evaluator.js';
import { HARD_CLI_CAP } from '../src/sim/limits.js';

// Seed the GateRegistry (main.js is the sole importer of gates/).
import '../src/main.js';

/** Collect all of stdin as a single UTF-8 string. */
function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', (err) => reject(err));
  });
}

/** Build the CLI output document from a simulated StateVector. */
function renderOutput(state) {
  const size = state.size();
  const probabilities = new Array(size);
  const amplitudes = new Array(size);
  for (let i = 0; i < size; i++) {
    probabilities[i] = state.probability(i);
    amplitudes[i] = { re: state.getRe(i), im: state.getIm(i) };
  }
  return {
    qubits: state.numQubits(),
    probabilities,
    amplitudes,
  };
}

async function main() {
  let input;
  try {
    input = await readStdin();
  } catch (err) {
    process.stderr.write(`cli: failed to read stdin: ${err.stack || err.message}\n`);
    process.exit(1);
    return;
  }

  let state;
  try {
    const circuit = fromJson(input);
    const n = circuit.numQubits;
    if (!Number.isInteger(n) || n < 1 || n > HARD_CLI_CAP) {
      process.stderr.write(`cli: qubit count ${String(n)} exceeds hard cap ${HARD_CLI_CAP}. Refusing to allocate state. No stdout produced.\n`);
      process.exit(1);
      return;
    }
    const instructions = flattenCircuit(circuit);
    const schedule = scheduleColumns(instructions);
    state = evaluate(schedule, n);
  } catch (err) {
    process.stderr.write(`cli: ${err.stack || err.message}\n`);
    process.exit(1);
    return;
  }

  const output = renderOutput(state);
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
