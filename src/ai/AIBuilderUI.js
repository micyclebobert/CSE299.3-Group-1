// =============================================================================
// src/ai/AIBuilderUI.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: DOM-free UI state machine for the AI Builder.
// Natural-language prompt -> canonical v1 JSON -> validated Circuit via
// Serializer.fromJson. Wires into index.html/AppController exclusively through
// callbacks (no DOM references). Imported exclusively by main.js via the ai/
// leaf. Runs in bare Node.js. Testable via node --test.
// =============================================================================

import { AIBuilder } from './AIBuilder.js';
import { Cache } from './Cache.js';

const STATUS_IDLE = 'idle';
const STATUS_BUILDING = 'building';
const STATUS_OK = 'ok';
const STATUS_ERROR = 'error';
const BUILD_CACHE_VERSION = 'builder-v1';

function isPositiveInteger(n) {
  return Number.isInteger(n) && n >= 1;
}

function defaultCallbacks() {
  return {
    onChange: () => {},
    onBuildStart: () => {},
    onBuildOk: () => {},
    onBuildError: () => {},
    onCacheHit: () => {},
    onCacheMiss: () => {},
  };
}

export class AIBuilderUI {
  #prompt;
  #numQubits;
  #status;
  #generatedJson;
  #circuit;
  #error;
  #cacheHit;
  #cacheKey;
  #cache;
  #callbacks;

  constructor(options = {}) {
    this.#prompt = '';
    this.#numQubits = isPositiveInteger(options.numQubits) ? options.numQubits : 2;
    this.#status = STATUS_IDLE;
    this.#generatedJson = null;
    this.#circuit = null;
    this.#error = null;
    this.#cacheHit = null;
    this.#cacheKey = null;
    this.#cache = options.cache instanceof Cache ? options.cache : new Cache();
    const cb = defaultCallbacks();
    for (const key of Object.keys(cb)) {
      if (typeof options[key] === 'function') {
        cb[key] = options[key];
      }
    }
    this.#callbacks = cb;
  }
  onChange(cb) {
    this.#callbacks.onChange = cb;
  }

  // ---- read-only state ------------------------------------------------------

  get prompt() {
    return this.#prompt;
  }

  get numQubits() {
    return this.#numQubits;
  }

  get status() {
    return this.#status;
  }

  get generatedJson() {
    return this.#generatedJson;
  }

  get circuit() {
    return this.#circuit;
  }

  get error() {
    return this.#error;
  }

  get cacheHit() {
    return this.#cacheHit;
  }

  get cacheKey() {
    return this.#cacheKey;
  }

  getStateSnapshot() {
    return {
      prompt: this.#prompt,
      numQubits: this.#numQubits,
      status: this.#status,
      generatedJson: this.#generatedJson,
      circuit: this.#circuit,
      error: this.#error,
      cacheHit: this.#cacheHit,
      cacheKey: this.#cacheKey,
    };
  }

  // ---- state mutators -------------------------------------------------------

  setPrompt(prompt) {
    if (typeof prompt !== 'string') {
      throw new TypeError(
        `AIBuilderUI.setPrompt expects a string, got: ${typeof prompt}`
      );
    }
    this.#prompt = prompt;
    this.#clearBuild();
    this.#notifyChange();
  }

  setNumQubits(numQubits) {
    if (!isPositiveInteger(numQubits)) {
      throw new RangeError(
        `AIBuilderUI.setNumQubits expects a positive integer, got: ${String(numQubits)}`
      );
    }
    this.#numQubits = numQubits;
    this.#clearBuild();
    this.#notifyChange();
  }

  // ---- build flow -----------------------------------------------------------

  async build(options = {}) {
    if (typeof this.#prompt !== 'string' || this.#prompt.length === 0) {
      this.#setError('prompt must be a non-empty string');
      this.#notifyChange();
      return this.getStateSnapshot();
    }
    if (!isPositiveInteger(this.#numQubits)) {
      this.#setError('numQubits must be a positive integer');
      this.#notifyChange();
      return this.getStateSnapshot();
    }

    this.#status = STATUS_BUILDING;
    this.#generatedJson = null;
    this.#circuit = null;
    this.#error = null;
    this.#cacheHit = null;
    this.#cacheKey = Cache.sha256Hex(
      `${this.#prompt}|${this.#numQubits}|${BUILD_CACHE_VERSION}`
    );
    this.#callbacks.onBuildStart(this.getStateSnapshot());

    if (this.#cache.has(this.#cacheKey)) {
      const cached = this.#cache.get(this.#cacheKey);
      this.#applyCached(cached);
      this.#cacheHit = true;
      this.#callbacks.onCacheHit(this.#cacheKey, this.getStateSnapshot());
      this.#notifyChange();
      return this.getStateSnapshot();
    }

    this.#cacheHit = false;
    this.#callbacks.onCacheMiss(this.#cacheKey, this.getStateSnapshot());

    let result;
    try {
      result = await AIBuilder.build(this.#prompt, this.#numQubits, {
        model: options.model || 'qwen2.5:3b',
      });
    } catch (err) {
      this.#setError(`Builder threw: ${err.message}`);
      this.#notifyChange();
      return this.getStateSnapshot();
    }

    if (result.ok) {
      this.#status = STATUS_OK;
      this.#circuit = result.circuit;
      this.#generatedJson = result.json;
      this.#error = null;
      this.#cache.set(this.#cacheKey, {
        ok: true,
        circuit: result.circuit,
        json: result.json,
      });
      this.#callbacks.onBuildOk(this.getStateSnapshot());
    } else {
      this.#status = STATUS_ERROR;
      this.#error = result.error;
      this.#generatedJson = result.json || null;
      this.#callbacks.onBuildError(result.error, this.getStateSnapshot());
    }
    this.#notifyChange();
    return this.getStateSnapshot();
  }

  // ---- cache / lifecycle ----------------------------------------------------

  #applyCached(cached) {
    this.#status = STATUS_OK;
    this.#circuit = cached.circuit;
    this.#generatedJson = cached.json;
    this.#error = null;
  }

  clearCache() {
    this.#cache = new Cache();
  }

  reset() {
    this.#prompt = '';
    this.#numQubits = 2;
    this.#clearBuild();
    this.#notifyChange();
  }

  // ---- internals ------------------------------------------------------------

  #clearBuild() {
    this.#status = STATUS_IDLE;
    this.#generatedJson = null;
    this.#circuit = null;
    this.#error = null;
    this.#cacheHit = null;
    this.#cacheKey = null;
  }

  #setError(error) {
    this.#status = STATUS_ERROR;
    this.#error = error;
  }

  #notifyChange() {
    this.#callbacks.onChange(this.getStateSnapshot());
  }
}
