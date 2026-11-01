// =============================================================================
// src/ai/AIExplainer.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: LLM explainer consuming Flatten.js Instruction[]
// and Sparse Top-k state summaries. Imported exclusively by main.js.
// Built strictly last (SOURCE_OF_TRUTH §8.1).
// =============================================================================

export class AIExplainer {
  explain(instructions) {
    return `Explaining ${instructions.length} instructions`;
  }
}
