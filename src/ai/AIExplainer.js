// =============================================================================
// src/ai/AIExplainer.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: LLM explainer consuming Flatten.js Instruction[]
// and Sparse Top-k state summaries. Imported exclusively by main.js.
// Built strictly last (SOURCE_OF_TRUTH §8.1). DOM-free; runs in bare Node.js.
// =============================================================================

const DEFAULT_MODEL = 'qwen2.5:3b';
const DEFAULT_NUM_CTX = 4096;
const OLLAMA_BASE = 'http://localhost:11434';
const OLLAMA_CHAT_ENDPOINT = `${OLLAMA_BASE}/api/chat`;

import { Cache } from './Cache.js';

// Gate blurbs used by the deterministic fallback explanation.
const GATE_DESCRIPTIONS = {
  I: 'identity (no change)',
  X: 'Pauli-X bit flip',
  Y: 'Pauli-Y bit and phase flip',
  Z: 'Pauli-Z phase flip',
  H: 'Hadamard (creates superposition)',
  S: 'phase gate (adds 90-degree phase)',
  T: 'T gate (adds 45-degree phase)',
  RX: 'X-axis rotation',
  RY: 'Y-axis rotation',
  RZ: 'Z-axis rotation',
  CNOT: 'controlled-NOT (entangles two qubits)',
  CZ: 'controlled-Z (conditional phase flip)',
  SWAP: 'swaps two qubit states',
  TOFFOLI: 'controlled-controlled-NOT (Toffoli)',
};

/**
 * Build a pedagogical prompt from flattened instructions and sparse summaries.
 * Pure function; deterministic; no network, no DOM.
 *
 * @param {Array<{gateId, target, target2?, thetaRad?, controls, column, virtualColumn, subcircuit?}>} instructions
 * @param {Array<{topK, marginals}>} summaries - one per virtual column (may be sparse)
 * @param {number} numQubits
 * @returns {string}
 */
function buildPrompt(instructions, summaries, numQubits) {
  const lines = [];
  lines.push(
    'You are a quantum computing tutor. Explain the following quantum circuit '
    + 'step by step for a student learning quantum circuits. '
  );
  lines.push(`The circuit acts on ${numQubits} qubit row(s) (little-endian indexing: row 0 is the least-significant bit).`);
  lines.push(`It contains ${instructions.length} gate instruction(s) across virtual columns.`);
  lines.push('');
  lines.push('Circuit instructions (applied left to right, virtual column by virtual column):');

  for (const instr of instructions) {
    const ctrl = (instr.controls || [])
      .map((c) => `${c.on ? '' : 'anti-'}${c.row}`)
      .join(', ');
    const ctrlStr = ctrl ? ` controlled by [${ctrl}]` : '';
    const theta = instr.thetaRad !== undefined ? ` theta=${instr.thetaRad.toFixed(4)}rad` : '';
    const target2 = instr.target2 !== undefined ? `, target2=${instr.target2}` : '';
    lines.push(
      `  - virtual column ${instr.virtualColumn}: ${instr.gateId} on row ${instr.target}${target2}${ctrlStr}${theta}`
    );
  }

  lines.push('');
  lines.push('Sparse state summaries (top-k basis states by probability at key columns):');
  let summaryIdx = 0;
  for (const instr of instructions) {
    const summary = summaries[summaryIdx];
    summaryIdx += 1;
    if (!summary) continue;
    lines.push(`  After virtual column ${instr.virtualColumn}:`);
    for (const term of summary.topK.slice(0, 8)) {
      lines.push(
        `    ${term.label}: p=${term.probability.toFixed(4)} phase=${term.phase.toFixed(3)}rad`
      );
    }
    for (const m of summary.marginals) {
      lines.push(
        `    row ${m.row}: rho00=${m.rho00.toFixed(3)} linear entropy S_L=${m.sl.toFixed(3)}`
      );
    }
    lines.push('');
  }

  lines.push(
    'Provide a concise, step-by-step explanation of what each gate does, how the state evolves, '
    + 'and what entanglement (if any) is created. Use plain language and reference the qubit rows by number.'
  );
  return lines.join('\n');
}

/**
 * Call Ollama chat API and return the assistant's message content.
 * Throws on network or parse failure so the caller can fall back.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @param {string} [options.model]
 * @returns {Promise<string>}
 */
async function callOllama(prompt, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const res = await fetch(OLLAMA_CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { num_ctx: DEFAULT_NUM_CTX },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body || !body.message || typeof body.message.content !== 'string') {
    throw new Error('Ollama returned malformed response');
  }
  return body.message.content;
}

/**
 * Deterministic template fallback explanation (no LLM required).
 * Describes each gate in order so the explainer flow never depends on Ollama.
 *
 * @param {Array} instructions
 * @returns {string}
 */
function templateFallback(instructions) {
  const lines = [];
  lines.push('Circuit explanation (template fallback; Ollama unavailable):');
  lines.push(`Total instructions: ${instructions.length}`);
  lines.push('');
  for (const instr of instructions) {
    const desc = GATE_DESCRIPTIONS[instr.gateId] || `${instr.gateId} gate`;
    const ctrl = (instr.controls || [])
      .filter((c) => c.on)
      .map((c) => `row ${c.row}`)
      .join(', ');
    const ctrlStr = ctrl ? ` controlled on ${ctrl}` : '';
    const theta = instr.thetaRad !== undefined ? ` with theta=${instr.thetaRad.toFixed(3)}rad` : '';
    lines.push(
      `- Step at virtual column ${instr.virtualColumn}: apply ${desc} on qubit row ${instr.target}${ctrlStr}${theta}.`
    );
  }
  lines.push('');
  lines.push('Enable Ollama (localhost:11434, model qwen2.5:3b) for a richer pedagogical explanation.');
  return lines.join('\n');
}

/**
 * Primary export matching the base filename (AIExplainer.js -> AIExplainer).
 */
export class AIExplainer {
  /**
   * Explain a flattened circuit using Ollama, with a deterministic template
   * fallback when Ollama is unreachable or errors. Optionally consults a
   * content-addressed Cache (passed via options.cache) keyed on the canonical
   * circuit JSON (options.canonicalJson) so repeated explanations skip the LLM.
   *
   * Only successful Ollama responses are cached; template fallbacks are not.
   *
   * @param {Array} instructions - flattened Instruction[] from Flatten.js
   * @param {Array} summaries - sparse state summaries (one per virtual column)
   * @param {number} numQubits
   * @param {object} [options]
   * @param {string} [options.model]
   * @param {Cache} [options.cache]
   * @param {string} [options.canonicalJson]
   * @returns {Promise<string>} explanation text
   */
  async explain(instructions, summaries, numQubits, options = {}) {
    if (!Array.isArray(instructions)) {
      throw new TypeError(
        `AIExplainer.explain expects an instructions array, got: ${typeof instructions}`
      );
    }
    if (instructions.length === 0) {
      return 'Empty circuit: no instructions to explain.';
    }

    const cache = options.cache;
    const canonicalJson = options.canonicalJson;
    const cacheKey =
      cache && canonicalJson ? Cache.computeKey(canonicalJson) : null;

    if (cacheKey !== null && cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const prompt = buildPrompt(instructions, summaries, numQubits);

    try {
      const result = await callOllama(prompt, options);
      if (cacheKey !== null) {
        cache.set(cacheKey, result);
      }
      return result;
    } catch (err) {
      process.stderr.write(
        `[AIExplainer] Ollama call failed, using template fallback: ${err.message}\n`
      );
      return templateFallback(instructions);
    }
  }
}
