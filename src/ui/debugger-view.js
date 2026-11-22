export function initDebuggerView(app, stepCurrent, stepTotal) {
  function updateDebugStep() { stepCurrent.textContent = app.getDebuggerStep(); stepTotal.textContent = app.getDebuggerTotal(); }

  const timelineScrub = document.getElementById('timeline-scrub');
  timelineScrub.addEventListener('input', (ev) => {
    app.seekDebugger(parseInt(ev.target.value, 10));
    app.draw();
    updateDebugStep();
  });

  document.getElementById('btn-breakpoint').addEventListener('click', () => {
    const col = parseInt(document.getElementById('bp-column').value, 10) || 0;
    app.toggleBreakpoint(col);
  });

  document.getElementById('btn-run-to-bp').addEventListener('click', () => {
    app.runToBreakpoint();
    app.draw();
    updateDebugStep();
  });

  document.getElementById('btn-step').addEventListener('click', () => {
    app.stepDebugger();
    app.draw();
    updateDebugStep();
  });

  document.getElementById('btn-run').addEventListener('click', () => {
    app.simulate();
    app.draw();
    updateDebugStep();
  });

  updateDebugStep();

  return { updateDebugStep };
}
