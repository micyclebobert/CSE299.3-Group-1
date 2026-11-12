// =============================================================================
// src/ai/Cache.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: content-addressed explanation cache keyed by
// SHA-256(canonicalJson + "|" + schemaVersion + "|" + promptVersion).
// Pure JS SHA-256 (no Node crypto) so it runs in bare Node.js and browsers.
// Imported exclusively by main.js via the ai/ leaf.
// =============================================================================

const SCHEMA_VERSION = '1';
const PROMPT_VERSION = '1';

// SHA-256 round constants (first 32 bits of fractional parts of cube roots
// of the first 64 primes).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Convert a string to UTF-8 bytes. */
function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      // surrogate pair
      i += 1;
      const code2 = str.charCodeAt(i);
      const cp = 0x10000 + ((code & 0x3ff) << 10) + (code2 & 0x3ff);
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Compute SHA-256 of a string, returning lowercase hex.
 * Pure JS; no Node `crypto` dependency.
 *
 * @param {string} message
 * @returns {string} 64-char lowercase hex digest
 */
function sha256Hex(message) {
  const bytes = utf8ToBytes(message);
  const bitLength = bytes.length * 8;

  // Prepend 0x80, pad with zeros to make length ≡ 448 mod 512, append 64-bit length.
  const paddedLen =
    Math.floor((bitLength + 64 + 512 - 1 - 448) / 512) * 512 + 448 + 64;
  const padded = new Uint8Array(paddedLen / 8);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const lenView = new DataView(padded.buffer, padded.length - 8, 8);
  lenView.setUint32(0, 0, false); // high 32 bits (message length < 2^32 practically)
  lenView.setUint32(4, bitLength, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const chunk = padded.subarray(chunkStart, chunkStart + 64);
    for (let t = 0; t < 16; t += 1) {
      w[t] =
        (chunk[t * 4] << 24) |
        (chunk[t * 4 + 1] << 16) |
        (chunk[t * 4 + 2] << 8) |
        chunk[t * 4 + 3];
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 =
        ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^
        ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^
        (w[t - 15] >>> 3);
      const s1 =
        ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^
        ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^
        (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t += 1) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const hex = (v) => (v >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
}

/**
 * Compute the content-addressed cache key for an explanation.
 *
 * @param {string} canonicalJson - Serializer.toJson(circuit) output
 * @param {string} [schemaVersion=SCHEMA_VERSION]
 * @param {string} [promptVersion=PROMPT_VERSION]
 * @returns {string} 64-char lowercase hex digest
 */
function cacheKey(canonicalJson, schemaVersion = SCHEMA_VERSION, promptVersion = PROMPT_VERSION) {
  return sha256Hex(`${canonicalJson}|${schemaVersion}|${promptVersion}`);
}

/**
 * In-memory content-addressed explanation cache.
 */
export class Cache {
  constructor() {
    this.#store = new Map();
  }

  /**
   * Retrieve a cached explanation by key.
   * @param {string} key
   * @returns {string | undefined}
   */
  get(key) {
    return this.#store.get(key);
  }

  /**
   * Store an explanation by key.
   * @param {string} key
   * @param {string} value
   */
  set(key, value) {
    this.#store.set(key, value);
  }

  /**
   * Check whether a key is present.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.#store.has(key);
  }

  /**
   * Compute the content-addressed cache key for an explanation.
   * @param {string} canonicalJson
   * @param {string} [schemaVersion]
   * @param {string} [promptVersion]
   * @returns {string}
   */
  static computeKey(canonicalJson, schemaVersion, promptVersion) {
    return cacheKey(canonicalJson, schemaVersion, promptVersion);
  }
}
