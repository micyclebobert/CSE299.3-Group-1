export function initPlacementView(app, canvas, interaction, { onPlace = () => {} } = {}) {
  canvas.addEventListener('pointerdown', (ev) => {
    const entry = app.getSelectedEntry();
    if (!entry) return;
    interaction.pick(entry, ev.offsetX, ev.offsetY);
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (interaction.phase !== 'idle') interaction.drag(ev.offsetX, ev.offsetY);
    app.setPointer(ev.offsetX, ev.offsetY);
  });

  canvas.addEventListener('pointerup', (ev) => {
    if (interaction.phase === 'idle') return;
    const cell = interaction.snap(ev.offsetX, ev.offsetY, { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 });
    const entry = app.getSelectedEntry();
    if (entry) {
      const result = app.placeGateFromCell(cell, entry, { onPlace });
      if (result.conflict) {
        app._status(result.reason);
      }
    }
    interaction.cancel();
  });
}
