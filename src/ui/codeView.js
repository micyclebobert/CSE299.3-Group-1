export function initCodeView(app, codeEl) {
  app.onCode(() => { codeEl.value = app.serialize(); });

  codeEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); const result = app.deserialize(codeEl.value); if (result.ok) app.draw(); }
  });

  document.getElementById('btn-copy').addEventListener('click', () => { codeEl.select(); document.execCommand('copy'); });

  document.getElementById('btn-import').addEventListener('click', () => {
    const input = prompt('Paste canonical v1 JSON:');
    if (input) { const result = app.deserialize(input); if (result.ok) { codeEl.value = app.serialize(); app.draw(); } else alert(result.error); }
  });

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([app.serialize()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'circuit.simqc.json'; a.click(); URL.revokeObjectURL(url);
  });

  document.getElementById('btn-share').addEventListener('click', () => {
    const encoded = app.encodeURL();
    if (!encoded) return;
    const url = location.origin + location.pathname + '#circuit=' + encoded;
    prompt('Shareable URL (copy):', url);
  });
}
