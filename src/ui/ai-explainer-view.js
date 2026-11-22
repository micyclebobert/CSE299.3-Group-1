import { flattenCircuit } from '../circuit/Flatten.js';

let explainer = null;

export function initAIExplainerView(app, aiOutput, AIExplainer, sparseSummary, cache) {
  document.getElementById('btn-explain').addEventListener('click', async () => {
    aiOutput.textContent = 'Explaining…';
    try {
      const instructions = flattenCircuit(app.currentCircuit);
      if (instructions.length === 0) {
        aiOutput.textContent = 'Empty circuit: no instructions to explain.';
        return;
      }
      if (!explainer) explainer = new AIExplainer();

      // Build one SparseSummary per virtual column by stepping the trace
      // to each column boundary and capturing the resulting state.
      const trace = app._stepTrace;
      const priorStep = trace.step;
      trace.reset();

      const virtualColumns = [];
      for (const instr of instructions) {
        if (!virtualColumns.includes(instr.virtualColumn)) {
          virtualColumns.push(instr.virtualColumn);
        }
      }
      virtualColumns.sort((a, b) => a - b);

      const summaries = [];
      for (const vc of virtualColumns) {
        while (trace.step <= vc) {
          trace.next();
        }
        summaries[vc] = sparseSummary.summarize(trace.currentState);
      }

      // Restore the trace to its prior position so the debugger UI is unaffected.
      trace.seek(priorStep);

      const canonicalJson = app.serialize();
      const stateIdentity = JSON.stringify(virtualColumns);
      const text = await explainer.explain(instructions, summaries, app.numQubits, {
        cache: cache || app.cache || new Cache(),
        canonicalJson,
        stateIdentity,
      });
      aiOutput.textContent = text;
    } catch (err) { aiOutput.textContent = 'AI unavailable: ' + err.message; }
  });
}
