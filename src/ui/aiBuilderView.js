export function initAIBuilderView(app, aiPrompt, builderOutput, codeEl, renderInspector) {
  builderOutput.style.whiteSpace = 'pre-wrap';
  const aiBuilder = app.aiBuilder;
  if (aiBuilder) {
    aiBuilder.onChange((s) => {
      if (s.status === 'error') builderOutput.textContent = 'Error: ' + (s.error || '');
      else if (s.status === 'ok') builderOutput.textContent = s.generatedJson || '';
      else builderOutput.textContent = '';
    });
    const qubitsEl = document.getElementById('builder-qubits');
    if (qubitsEl) {
      qubitsEl.value = String(aiBuilder.numQubits);
      qubitsEl.addEventListener('change', () => {
        const n = parseInt(qubitsEl.value, 10);
        if (Number.isInteger(n) && n >= 1) aiBuilder.setNumQubits(n);
      });
    }
    document.getElementById('btn-build').addEventListener('click', async () => {
      builderOutput.textContent = 'Building…';
      aiBuilder.setPrompt(aiPrompt.value);
      await aiBuilder.build();
      if (aiBuilder.status === 'ok' && aiBuilder.circuit) {
        app.applyCircuit(aiBuilder.circuit);
        app.draw();
        if (typeof renderInspector === 'function') renderInspector();
        if (codeEl) codeEl.value = app.serialize();
        builderOutput.textContent = 'Circuit applied to editor.';
      }
    });
  } else {
    document.getElementById('btn-build').disabled = true;
    builderOutput.textContent = 'AI Builder unavailable.';
  }
}
