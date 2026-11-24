import { flattenCircuit } from '../circuit/Flatten.js';

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

function summarizeAtBoundary(app, sparseSummary, boundary, vcs) {
  const trace = app.getStepTrace();
  if (!trace) return [];
  const scheduleLength = trace.scheduleLength;

  let targetStep;
  if (boundary.kind === 'final') {
    targetStep = scheduleLength;
  } else if (boundary.kind === 'step') {
    targetStep = Math.max(0, Math.min(Number.isFinite(boundary.step) ? boundary.step : 0, scheduleLength));
  } else {
    throw new TypeError(`Unknown state boundary: ${boundary.kind}`);
  }

  // One sparse Top-k summary per virtual column, indexed by virtualColumn.
  // getStateAtStep seeks then restores the trace position in its finally block,
  // so the trace is never permanently mutated.
  const summaries = [];
  for (const vc of vcs) {
    const state = app.getStateAtStep(Math.min(vc, targetStep));
    if (!state) continue;
    summaries[vc] = sparseSummary.summarize(state);
  }
  return summaries;
}

export function initAIExplainerView(app, aiOutput, AIExplainer, sparseSummary, cache) {
  aiOutput.style.whiteSpace = 'pre-wrap';

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

  // Browser boundary selector: final state vs a selected virtual step.
  const boundarySelect = document.createElement('select');
  boundarySelect.id = 'ai-state-boundary';
  const finalOpt = document.createElement('option');
  finalOpt.value = 'final';
  finalOpt.textContent = 'Final state';
  const stepOpt = document.createElement('option');
  stepOpt.value = 'step';
  stepOpt.textContent = 'Virtual step';
  boundarySelect.appendChild(finalOpt);
  boundarySelect.appendChild(stepOpt);
  const stepLabel = document.createElement('span');
  stepLabel.textContent = ' step:';
  stepLabel.style.marginLeft = '6px';
  const stepInput = document.createElement('input');
  stepInput.id = 'ai-selected-step';
  stepInput.type = 'number';
  stepInput.min = '0';
  stepInput.value = '0';
  stepInput.style.width = '60px';
  stepInput.style.marginLeft = '6px';

  const section = aiOutput.parentElement;
  if (section) {
    section.insertBefore(boundarySelect, aiOutput);
    section.insertBefore(stepLabel, aiOutput);
    section.insertBefore(stepInput, aiOutput);
  }

  boundarySelect.addEventListener('change', () => {
    const step = stepInput.value === '' ? 0 : parseInt(stepInput.value, 10) || 0;
    setStateBoundary(boundarySelect.value || 'final', step);
  });

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

      const vcs = uniqueVirtualColumns(instructions);
      const summaries = summarizeAtBoundary(app, sparseSummary, stateBoundary, vcs);

      const canonicalJson = app.serialize();
      const stateIdentity = JSON.stringify({
        boundary: stateBoundary,
        virtualColumns: vcs,
      });
      const text = await explainer.explain(instructions, summaries, app.numQubits, {
        cache: cache || app.cache,
        canonicalJson,
        stateIdentity,
      });

      const topKByColumn = vcs.map((vc) => {
        const s = summaries[vc];
        return s ? `vc=${vc}: ${s.topK.map((t) => t.label).join(', ')}` : `vc=${vc}: (none)`;
      });
      const contextBlock =
        'Context sent:\n'
        + `  boundary=${stateBoundary.kind}${
            stateBoundary.kind === 'step' ? ` step=${stateBoundary.step}` : ''
          }\n`
        + `  summaries=${vcs.length}\n`
        + `  top-k: ${topKByColumn.join('; ')}\n\n`;
      aiOutput.textContent = contextBlock + text;
    } catch (err) {
      aiOutput.textContent = 'AI unavailable: ' + err.message;
    }
  });

  return { setStateBoundary };
}
