// =============================================================================
// src/ai/registry.js
// -----------------------------------------------------------------------------
// Compliant primary-export facade over the ai/ discardable leaf modules.
//
// Primary export: `registry` (matches base filename registry.js -> registry).
// Provides lazy get(name), list(), and has(name) accessors over AI leaf
// modules. Loads leaves via dynamic import so deleting any ai/ module does not
// crash main.js. Does NOT re-export concrete modules (preserves leaf
// deletability; zero inter-leaf edges). DOM-free; runs in bare Node.js.
// =============================================================================

const AI_MODULES = [
  'AIExplainer',
  'IOAnalyzer',
  'AIBuilder',
  'SparseSummary',
  'AIBuilderUI',
  'IOAnalyzerUI',
  'Cache',
];

export const registry = {
  async get(name) {
    if (!AI_MODULES.includes(name)) {
      return undefined;
    }
    try {
      const mod = await import(`./${name}.js`);
      return mod[name];
    } catch {
      return undefined;
    }
  },

  list() {
    return [...AI_MODULES];
  },

  has(name) {
    return AI_MODULES.includes(name);
  },
};
