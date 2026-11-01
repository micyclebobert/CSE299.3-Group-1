// =============================================================================
// src/state/History.js
// -----------------------------------------------------------------------------
// Linear undo/redo stack storing immutable Circuit object references compared
// via isEqualTo() (never serialized strings).
// =============================================================================

import { Circuit } from '../circuit/Circuit.js';

export class History {
  constructor() {
    this._stack = [];
    this._index = -1;
  }

  push(circuit) {
    if (!(circuit instanceof Circuit)) {
      throw new TypeError('History.push expects a Circuit instance');
    }
    this._stack = this._stack.slice(0, this._index + 1);
    this._stack.push(circuit);
    this._index = this._stack.length - 1;
  }

  undo() {
    if (this._index <= 0) return null;
    return this._stack[--this._index];
  }

  redo() {
    if (this._index >= this._stack.length - 1) return null;
    return this._stack[++this._index];
  }

  current() {
    return this._index >= 0 ? this._stack[this._index] : null;
  }
}
