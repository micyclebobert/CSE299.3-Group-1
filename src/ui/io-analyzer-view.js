import { flattenCircuit } from '../circuit/Flatten.js';

export function initIOAnalyzerView(app, ioInputRow, ioOutputRow, ioOutput) {
  ioOutput.style.whiteSpace = 'pre-wrap';
  const ioAnalyzer = app.ioAnalyzer;
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
    document.getElementById('btn-analyze').addEventListener('click', async () => {
      const inputRow = parseInt(ioInputRow.value, 10) || 0;
      const outputRow = parseInt(ioOutputRow.value, 10) || 0;
      ioAnalyzer.setInputRows([inputRow]);
      ioAnalyzer.setOutputRows([outputRow]);
      ioAnalyzer.analyze(flattenCircuit(app.currentCircuit), app._stepTrace, { state: app._stepTrace.currentState, numQubits: app.numQubits });
    });
  } else {
    document.getElementById('btn-analyze').disabled = true;
    ioOutput.textContent = 'I/O Analyzer unavailable.';
  }
}
