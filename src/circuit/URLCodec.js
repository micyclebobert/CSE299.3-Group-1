const BASE64_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LEN_BASE = Object.freeze([3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]);
const LEN_EXTRA = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]);
const DIST_BASE = Object.freeze([1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]);
const DIST_EXTRA = Object.freeze([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]);

const reverseBits = (value, width) => {
  let result = 0;
  for (let i = 0; i < width; i += 1) {
    result <<= 1;
    result |= value & 1;
    value >>= 1;
  }
  return result;
};

const TABLE = (() => {
  const table = new Array(512);
  const add = (sym, code, len) => {
    for (let x = 0; x < (1 << (9 - len)); x += 1) {
      table[code | (x << len)] = { sym, len };
    }
  };
  for (let s = 0; s < 144; s += 1) {
    add(s, reverseBits(0x30 + s, 8), 8);
  }
  for (let s = 144; s < 256; s += 1) {
    add(s, reverseBits(0x190 + (s - 144), 9), 9);
  }
  for (let s = 256; s < 280; s += 1) {
    add(s, reverseBits(s - 256, 7), 7);
  }
  for (let s = 280; s < 288; s += 1) {
    add(s, reverseBits(0xc0 + (s - 280), 8), 8);
  }
  return table;
})();

function valBase64(ch) {
  const v = BASE64_URL.indexOf(ch);
  if (v === -1) {
    throw new Error('URLCodec: invalid base64url character: ' + ch);
  }
  return v;
}

function deflateRaw(input) {
  const n = input.length;
  const out = [];
  let bits = 0;
  let bitCount = 0;
  const write = (code, len) => {
    bits |= (code & ((1 << len) - 1)) << bitCount;
    bitCount += len;
    while (bitCount >= 8) {
      out.push(bits & 0xff);
      bits >>= 8;
      bitCount -= 8;
    }
  };
  const writeLiteral = (sym) => {
    if (sym < 144) {
      write(reverseBits(0x30 + sym, 8), 8);
    } else if (sym < 256) {
      write(reverseBits(0x190 + (sym - 144), 9), 9);
    } else if (sym < 280) {
      write(reverseBits(sym - 256, 7), 7);
    } else {
      write(reverseBits(0xc0 + (sym - 280), 8), 8);
    }
  };

  write(1, 1);
  write(1, 2);

  let pos = 0;
  while (pos < n) {
    let bestLen = 0;
    let bestDist = 0;
    const maxLen = n - pos > 258 ? 258 : n - pos;
    if (maxLen >= 3) {
      const start = pos > 32768 ? pos - 32768 : 0;
      for (let j = start; j < pos; j++) {
        if (bestLen > 0 && input[j + bestLen - 1] !== input[pos + bestLen - 1]) {
          continue;
        }
        let len = 0;
        while (len < maxLen && input[j + len] === input[pos + len]) {
          len += 1;
        }
        if (len > bestLen) {
          bestLen = len;
          bestDist = pos - j;
        }
        if (len === maxLen) {
          break;
        }
      }
    }
    if (bestLen >= 3) {
      let lsym = 257;
      while (lsym < 285 && bestLen >= LEN_BASE[lsym - 256]) {
        lsym += 1;
      }
      writeLiteral(lsym);
      const le = LEN_EXTRA[lsym - 257];
      if (le > 0) {
        write(bestLen - LEN_BASE[lsym - 257], le);
      }
      let dsym = 0;
      while (dsym < 29 && bestDist >= DIST_BASE[dsym + 1]) {
        dsym += 1;
      }
      write(reverseBits(dsym, 5), 5);
      const de = DIST_EXTRA[dsym];
      if (de > 0) {
        write(bestDist - DIST_BASE[dsym], de);
      }
      pos += bestLen;
    } else {
      writeLiteral(input[pos]);
      pos += 1;
    }
  }
  writeLiteral(256);
  if (bitCount > 0) {
    out.push(bits & 0xff);
  }
  return new Uint8Array(out);
}

function inflateRaw(input) {
  const out = [];
  let bits = 0;
  let bitCount = 0;
  let ip = 0;
  const ensure = (need) => {
    while (bitCount < need && ip < input.length) {
      bits |= input[ip] << bitCount;
      bitCount += 8;
      ip += 1;
    }
  };
  const peek = (n) => {
    ensure(n);
    return bits & ((1 << n) - 1);
  };
  const consume = (n) => {
    bits >>= n;
    bitCount -= n;
  };

  peek(1);
  consume(1);
  peek(2);
  consume(2);

  while (true) {
    const entry = TABLE[peek(9)];
    consume(entry.len);
    const sym = entry.sym;
    if (sym < 256) {
      out.push(sym);
    } else if (sym === 256) {
      break;
    } else {
      const li = sym - 257;
      let len = LEN_BASE[li];
      if (LEN_EXTRA[li] > 0) {
        len += peek(LEN_EXTRA[li]);
        consume(LEN_EXTRA[li]);
      }
      const dsym = reverseBits(peek(5), 5);
      consume(5);
      let dist = DIST_BASE[dsym];
      if (DIST_EXTRA[dsym] > 0) {
        dist += peek(DIST_EXTRA[dsym]);
        consume(DIST_EXTRA[dsym]);
      }
      const start = out.length - dist;
      for (let k = 0; k < len; k += 1) {
        out.push(out[start + k]);
      }
    }
  }
  return new Uint8Array(out);
}

function base64urlEncode(input) {
  const n = input.length;
  let out = '';
  for (let i = 0; i < n; i += 3) {
    const b0 = input[i];
    const b1 = i + 1 < n ? input[i + 1] : 0;
    const b2 = i + 2 < n ? input[i + 2] : 0;
    const t = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_URL[(t >>> 18) & 0x3f];
    out += BASE64_URL[(t >>> 12) & 0x3f];
    out += i + 1 < n ? BASE64_URL[(t >>> 6) & 0x3f] : '';
    out += i + 2 < n ? BASE64_URL[t & 0x3f] : '';
  }
  return out;
}

function base64urlDecode(text) {
  const n = text.length;
  const out = [];
  let i = 0;
  while (i < n) {
    const c0 = valBase64(text[i]);
    i += 1;
    const c1 = valBase64(text[i]);
    i += 1;
    let b = (c0 << 18) | (c1 << 12);
    out.push(b >>> 16);
    if (i < n) {
      const c2 = valBase64(text[i]);
      i += 1;
      b |= c2 << 6;
      out.push((b >>> 8) & 0xff);
      if (i < n) {
        b |= valBase64(text[i]);
        i += 1;
        out.push(b & 0xff);
      }
    }
  }
  return new Uint8Array(out);
}

export function encode(circuitJson) {
  if (typeof circuitJson !== 'string') {
    throw new TypeError('URLCodec.encode expects a string');
  }
  return base64urlEncode(deflateRaw(new TextEncoder().encode(circuitJson)));
}

export function decode(urlSafeBase64) {
  if (typeof urlSafeBase64 !== 'string') {
    throw new TypeError('URLCodec.decode expects a string');
  }
  return new TextDecoder().decode(inflateRaw(base64urlDecode(urlSafeBase64)));
}
