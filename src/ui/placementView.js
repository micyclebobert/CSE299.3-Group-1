import { snapCell } from '../../src/editor/Interaction.js';

const GEOMETRY = { colPitch: 80, rowPitch: 48, colOffset: 80, rowOffset: 20 };

export function initPlacementView(app, canvas, interaction, { onPlace = () => {} } = {}) {
  canvas.addEventListener('pointerdown', (ev) => {
    const entry = app.getSelectedEntry();
    if (entry) {
      interaction.pick(entry, ev.offsetX, ev.offsetY);
      return;
    }
    const cell = snapCell(ev.offsetX, ev.offsetY, GEOMETRY);
    const result = app.selectGate(cell.column, cell.row);
    if (result.conflict) {
      app.clearSelection();
    }
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (interaction.phase !== 'idle') interaction.drag(ev.offsetX, ev.offsetY);
    app.setPointer(ev.offsetX, ev.offsetY);
  });

  canvas.addEventListener('pointerup', (ev) => {
    if (interaction.phase === 'idle') return;
    const cell = interaction.snap(ev.offsetX, ev.offsetY, GEOMETRY);
    const entry = app.getSelectedEntry();
    if (entry) {
      const result = app.placeGateFromCell(cell, entry, { onPlace });
      if (result.conflict) {
        app.setStatus(result.reason);
      }
    }
    interaction.cancel();
  });

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', (ev) => {
      const key = ev.key;
      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        ev.preventDefault();
        const cell = app.getSelectedCell() ?? { column: 0, row: 0 };
        let newColumn = cell.column;
        let newRow = cell.row;
        if (key === 'ArrowLeft') newColumn -= 1;
        if (key === 'ArrowRight') newColumn += 1;
        if (key === 'ArrowUp') newRow -= 1;
        if (key === 'ArrowDown') newRow += 1;
        const result = app.selectGate(newColumn, newRow);
        if (result.conflict) {
          app.setStatus(result.reason);
        }
      } else if (key === 'Delete' || key === 'Backspace') {
        ev.preventDefault();
        const cell = app.getSelectedCell();
        if (cell) {
          const result = app.deleteGate(cell.column, cell.row);
          if (result.conflict) {
            app.setStatus(result.reason);
          } else {
            app.clearSelection();
          }
        }
      }
    });
  }
}
