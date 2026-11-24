export function initInspectorTabsView(app, tabStripEl, inspectorContentEl, { renderState, renderBloch, renderHistogram }) {
  let activeTab = 'state';
  function renderInspector() {
    if (!app.currentCircuit) {
      inspectorContentEl.textContent = 'No state yet.';
      return;
    }
    if (activeTab === 'state') {
      renderState();
      if (renderHistogram) { renderHistogram(); }
    } else {
      renderBloch();
    }
    app.draw();
  }
  tabStripEl.addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab[data-tab]');
    if (!tab) return;
    tabStripEl.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    renderInspector();
  });
  app.onInspector(() => { renderInspector(); });
  return { renderInspector, getActiveTab: () => activeTab, setActiveTab: (v) => { activeTab = v; } };
}
