// =============================================================================
// src/ai/AIBuilder.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: stretch / non-guaranteed capability. Translates a
// natural-language prompt into canonical v1 JSON, validated via
// Serializer.fromJson(json), and returns a Circuit. Never injects raw
// matrices; only registered gate string IDs. Imported exclusively by main.js
// via the ai/ leaf. DOM-free; runs in bare Node.js.
// =============================================================================

import { Serializer } from '../circuit/Serializer.js';

const DEFAULT_MODEL = 'qwen2.5:3b';
const DEFAULT_NUM_CTX = 4096;
const OLLAMA_CHAT_ENDPOINT = 'http://localhost:11434/api/chat';

/**
 * Call Ollama chat API and return the assistant's message content.
 * Throws on network or parse failure.
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
 * Extract a JSON object from text that may be wrapped in markdown code fences
 * or surrounded by prose.
 *
 * @param {string} text
 * @returns {object} parsed JSON
 */
function extractJson(text) {
  let candidate = text;
  const fenceMatch = candidate.match(/```json\n([\s\S]*?)\n```/i);
  if (fenceMatch) candidate = fenceMatch[1];
  else {
    const genericFence = candidate.match(/```\n([\s\S]*?)\n```/i);
    if (genericFence) candidate = genericFence[1];
  }
  // Fall back to the first '{'..'}' balanced span.
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }
  return JSON.parse(candidate);
}

/**
 * Build a prompt asking Ollama to emit canonical v1 JSON for a circuit.
 *
 * @param {string} prompt - natural-language request
 * @param {number} numQubits
 * @returns {string}
 */
function buildBuildPrompt(prompt, numQubits) {
  return (
    'You are a quantum circuit author. Output ONLY canonical SimQC v1 JSON ' +
    '(no markdown fences, no prose) for the following request on ' +
    numQubits +
    ' qubit rows (little-endian: row 0 is LSB). Use gate IDs: H, X, Y, Z, ' +
    'CNOT, Rx, Ry, Rz. Angles use thetaRad in radians. Controls use ' +
    '{row, on}. Valid schema keys: gate, target, target2, thetaRad, controls. ' +
    `Request: "${prompt}".\n` +
    'Example output: {\n' +
    '  "format": "simqc-circuit",\n' +
    '  "version": 1,\n' +
    '  "bitOrder": "little-endian",\n' +
    '  "numQubits": 2,\n' +
    '  "columns": [\n' +
    '    [{"gate": "H", "target": 0}],\n' +
    '    [{"gate": "CNOT", "target": 1, "controls": [{"row": 0, "on": true}]}]\n' +
    '  ]\n' +
    '}'
  );
}

/**
 * Build a Circuit from a natural-language prompt via Ollama.
 *
 * @param {string} prompt - natural-language request
 * @param {number} numQubits
 * @param {object} [options]
 * @param {string} [options.model]
 * @returns {Promise<{ok: true, circuit, json} | {ok: false, error, json?}>}
 */
async function build(prompt, numQubits, options = {}) {
  if (typeof prompt !== 'string' || prompt.length === 0) {
    return { ok: false, error: 'prompt must be a non-empty string' };
  }
  if (!Number.isInteger(numQubits) || numQubits < 1) {
    return { ok: false, error: 'numQubits must be a positive integer' };
  }

  const jsonPrompt = buildBuildPrompt(prompt, numQubits);

  let raw;
  try {
    raw = await callOllama(jsonPrompt, options);
  } catch (err) {
    return { ok: false, error: `Ollama unavailable: ${err.message}` };
  }

  let parsed;
  try {
    parsed = extractJson(raw);
  } catch (err) {
    return { ok: false, error: `Could not extract JSON from model output: ${err.message}`, json: raw };
  }

  let circuit;
  try {
    circuit = Serializer.fromJson(JSON.stringify(parsed));
  } catch (err) {
    return { ok: false, error: `Circuit JSON failed validation: ${err.message}`, json: JSON.stringify(parsed) };
  }

  return { ok: true, circuit, json: JSON.stringify(parsed) };
}

/**
 * Primary export matching the base filename (AIBuilder.js -> AIBuilder).
 */
export class AIBuilder {
  /**
   * Build a Circuit from a natural-language prompt via Ollama.
   * @param {string} prompt
   * @param {number} numQubits
   * @param {object} [options]
   * @param {string} [options.model]
   * @returns {Promise<{ok: true, circuit, json} | {ok: false, error, json?}>}
   */
  static build(prompt, numQubits, options = {}) {
    return build(prompt, numQubits, options);
  }
}
