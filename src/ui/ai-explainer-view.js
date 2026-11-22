import { flattenCircuit } from '../circuit/Flatten.js';
import { SparseSummary, Cache } from '../main.js';

let explainer = null;

export function initAIExplainerView(app, aiOutput, AIExplainer, cache) {
  document.getElementById('btn-explain').addEventListener('click', async () => {
    aiOutput.textContent = 'Explaining…';
    try {
      const instructions = flattenCircuit(app.currentCircuit);
      if (instructions.length === 0) {
        aiOutput.textContent = 'Empty circuit: no instructions to explain.';
        return;
      }
      if (!explainer) explainer = new AIExplainer();
      const state = app._stepTrace ? app._stepTrace.currentState : null;
      const summaries = state ? [SparseSummary.summarize(state)] : [];
      const canonicalJson = app.serialize();
      const text = await explainer.explain(instructions, summaries, app.numQubits, {
        cache: cache || app.cache || new Cache(),
        canonicalJson,
      });
      aiOutput.textContent = text;
    } catch (err) { aiOutput.textContent = 'AI unavailable: ' + err.message; }
  });
}
