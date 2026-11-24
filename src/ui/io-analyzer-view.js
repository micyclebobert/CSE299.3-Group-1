import { flattenCircuit } from '../circuit/Flatten.js';

export function initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput) {
  ioOutput.style.whiteSpace = 'pre-wrap';
  const ioAnalyzer = app.ioAnalyzer;
  const section = ioOutput.parentElement;
  if (ioAnalyzer) {
    ioAnalyzer.onChange((s) => {
      if (s.status === 'error') ioOutput.textContent = 'Error: ' + (s.error || '');
      else if (s.status === 'ok' && s.analysis) {
        const a = s.analysis;
        let html = `<div>Input rows affected in ${a.inputAffectedColumns.length} column(s): [${a.inputAffectedColumns.join(', ')}]</div>`;
        html += `<div>Output rows affected in ${a.outputAffectedColumns.length} column(s): [${a.outputAffectedColumns.join(', ')}]</div>`;
        html += `<div>Touched columns: ${a.touchedColumns.length}</div>`;
        html += `<div>Causal chain: ${a.causalChain.join(' \u2192 ')}</div>`;
        html += `<div>Summary: ${a.summary}</div>`;
        if (s.sparse) html += `<div>Sparse top-k: ${s.sparse.topK.map((t) => t.label).join(', ')}</div>`;
        ioOutput.innerHTML = html;
      } else ioOutput.textContent = '';
    });

    // Boundary selector: final state vs a selected virtual step.
    const boundarySelect = document.createElement('select');
    boundarySelect.id = 'io-state-boundary';
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
    stepInput.id = 'io-selected-step';
    stepInput.type = 'number';
    stepInput.min = '0';
    stepInput.value = '0';
    stepInput.style.width = '60px';
    stepInput.style.marginLeft = '6px';
    if (section) {
      section.appendChild(boundarySelect);
      section.appendChild(stepLabel);
      section.appendChild(stepInput);
    }

    document.getElementById('btn-analyze').addEventListener('click', async () => {
      const inputRow = parseInt(ioInputRow.value, 10) || 0;
      const outputRow = parseInt(ioOutputRow.value, 10) || 0;
      const stateBoundary = boundarySelect.value;
      const selectedStep = stateBoundary === 'step' ? (parseInt(stepInput.value, 10) || 0) : null;
      ioAnalyzer.setInputRows([inputRow]);
      ioAnalyzer.setOutputRows([outputRow]);
      const stepTrace = app.getStepTrace();
      const result = ioAnalyzer.analyze(
        flattenCircuit(app.currentCircuit),
        stepTrace,
        {
          state: stepTrace && typeof stepTrace.currentState === 'function' ? stepTrace.currentState() : undefined,
          numQubits: app.numQubits,
          stateBoundary,
          selectedStep,
        }
      ) || {};
      if (result.status === 'error') {
        app.setStatus(`Analysis error: ${result.error || ''}`);
      } else {
        app.setStatus('Analysis complete.');
      }
    });
  } else {
    document.getElementById('btn-analyze').disabled = true;
    ioOutput.textContent = 'I/O Analyzer unavailable.';
  }
}
