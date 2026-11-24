Title: Editor interaction workflows — palette drag-and-drop, cell selection, select/move/delete/replace gates, keyboard editing

Summary:
- src/editor/Interaction.js: Refactored drop() to use new _placeGate() helper; added getSelectedGate(circuit, column, row), selectCell(circuit, column, row), deleteGate(circuit, column, row), moveGate(circuit, column, row, newColumn, newRow), replaceGate(circuit, column, row, gateEntry). All pure, no DOM, return new Circuit or conflict result.
- src/ui/app-controller-placement.js: Added selectGate(column, row), moveGate(column, row, newColumn, newRow), deleteGate(column, row), replaceGate(column, row, gateName), clearSelection(). All placement conflicts write visible status via this._status() with reasons: 'unknown gate', 'coordinate out of range', 'row occupied in column', 'insufficient free rows for gate arity'.
- src/ui/AppController.js: Added _selectedColumn/_selectedRow state; setSelectedEntry(entry), clearSelection(), getSelectedCell() methods.
- src/ui/placementView.js: pointerdown on empty cell clears selection; pointerdown on cell with existing gate selects it via app.selectGate(); document keydown handler — arrow keys move selection, Delete/Backspace deletes selected gate. document listener guarded for test environments.

Tests: npm run test:editor (54 pass, 0 fail), npm run test:ui (209 pass, 0 fail).
