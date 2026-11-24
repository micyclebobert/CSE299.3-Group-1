import { flattenCircuit } from '../circuit/Flatten.js';
import { Cache } from '../ai/Cache.js';

function uniqueVirtualColumns(instructions) {
  const columns = [];
  const seen = new Set();
  for (const instr of instructions) {
    const vc = instr.virtualColumn;
    if (!seen.has(vc)) {
      seen.add(vc);
      columns.push(vc);
    }
  }
  columns.sort((a, b) => a - b);
  return columns;
}

function summarizeAtBoundary(app, sparseSummary, boundary) {
  const trace = app.getStepTrace();
  if (!trace) return [];
  const priorStep = trace.step;
  try {
    if (boundary.kind === 'final') {
      trace.seek(trace.scheduleLength);
    } else {
      const step = Math.max(0, Math.min(boundary.step, trace.scheduleLength));
      trace.seek(step);
    }
    return [sparseSummary.summarize(trace.currentState)];
  } finally {
    trace.seek(priorStep);
  }
}

export function initAIExplainerView(app, aiOutput, AIExplainer, sparseSummary, cache) {
  // Closure-scoped (not module-level) state boundary selection.
  let stateBoundary = { kind: 'final' };

  function setStateBoundary(boundary, step) {
    if (boundary === 'final') {
      stateBoundary = { kind: 'final' };
    } else if (boundary === 'step') {
      stateBoundary = { kind: 'step', step: Number.isInteger(step) ? step : 0 };
    } else {
      throw new TypeError(`Unknown state boundary: ${boundary}`);
    }
  }

  let explainer = null;

  document.getElementById('btn-explain').addEventListener('click', async () => {
    aiOutput.textContent = 'Explaining…';
    try {
      const instructions = flattenCircuit(app.currentCircuit);
      if (instructions.length === 0) {
        aiOutput.textContent = 'Empty circuit: no instructions to explain.';
        return;
      }
      if (!explainer) explainer = new AIExplainer();

      const summaries = summarizeAtBoundary(app, sparseSummary, stateBoundary);

      const canonicalJson = app.serialize();
      const stateIdentity = JSON.stringify({
        boundary: stateBoundary,
        virtualColumns: uniqueVirtualColumns(instructions),
      });
      const text = await explainer.explain(instructions, summaries, app.numQubits, {
        cache: cache || app.cache || new Cache(),
        canonicalJson,
        stateIdentity,
      });

      const contextBlock =
        'Context sent:\n'
        + `  boundary=${stateBoundary.kind}${
            stateBoundary.kind === 'step' ? ` step=${stateBoundary.step}` : ''
          }\n`
        + `  summaries=${summaries.length}\n\n`;
      aiOutput.textContent = contextBlock + text;
    } catch (err) {
      aiOutput.textContent = 'AI unavailable: ' + err.message;
    }
  });

  return { setStateBoundary };
}
