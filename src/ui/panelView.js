export function initPanelView(panelModel) {
  document.querySelectorAll('.panel-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      panelModel.toggle(id);
      const panel = document.getElementById('panel-' + id);
      if (panel) { const region = panelModel.getRegion(id); panel.style.display = region && region.visible ? 'flex' : 'none'; }
    });
  });
}
