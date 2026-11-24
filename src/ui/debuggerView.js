export function initDebuggerView(app, stepCurrent, stepTotal, breakpointListEl) {
  function refreshTimeline() {
    const timelineScrub = document.getElementById('timeline-scrub');
    if (!timelineScrub) return;
    timelineScrub.max = app.getTimelineMax();
    timelineScrub.value = app.getDebuggerStep();
    stepCurrent.textContent = app.getDebuggerStep();
    stepTotal.textContent = app.getDebuggerTotal();
    refreshBreakpoints();
  }

  const timelineScrub = document.getElementById('timeline-scrub');
  timelineScrub.addEventListener('input', (ev) => {
    const max = parseInt(timelineScrub.max, 10) || 0;
    let value = parseInt(ev.target.value, 10);
    if (!Number.isFinite(value) || value < 0) value = 0;
    if (value > max) value = max;
    timelineScrub.value = value;
    app.seekDebugger(value);
    app.draw();
    refreshTimeline();
  });

  document.getElementById('btn-breakpoint').addEventListener('click', () => {
    const col = parseInt(document.getElementById('bp-column').value, 10) || 0;
    app.toggleBreakpoint(col);
    refreshTimeline();
  });

  document.getElementById('btn-run-to-bp').addEventListener('click', () => {
    app.runToBreakpoint();
    app.draw();
    refreshTimeline();
  });

  document.getElementById('btn-step').addEventListener('click', () => {
    app.stepDebugger();
    app.draw();
    refreshTimeline();
  });

  document.getElementById('btn-run').addEventListener('click', () => {
    app.simulate();
    app.draw();
    refreshTimeline();
  });

  // Breakpoint semantics:
  //   Step 0 is the initial |0...0> state (no columns applied yet).
  //   Step k (1 <= k <= scheduleLength) is the state after column k-1 has
  //   been applied. A breakpoint at "column k" therefore breaks at state step
  //   k, i.e. the state *before* column k is applied. The UI labels show the
  //   step number to match this semantics. Breakpoint validity
  //   (0 <= column <= scheduleLength) is enforced by AppController._validBreakpointCol.
  function refreshBreakpoints() {
    if (!breakpointList) return;
    breakpointList.textContent = '';
    for (const bp of app.getBreakpointsWithStatus()) {
      const row = document.createElement('div');
      row.className = 'breakpoint-row' + (bp.active ? ' breakpoint-active' : '');
      row.textContent = `Step ${bp.column}`;
      breakpointList.appendChild(row);
    }
  }

  let breakpointList = breakpointListEl ?? document.getElementById('breakpoint-list');
  if (!breakpointList) {
    breakpointList = document.createElement('div');
    breakpointList.id = 'breakpoint-list';
    breakpointList.className = 'breakpoint-list';
    const bottom = document.getElementById('panel-bottom');
    if (bottom) bottom.appendChild(breakpointList);
  }

  // Visible breakpoint-semantics contract (see index.html for the mirror line).
  const bpContract = document.createElement('div');
  bpContract.className = 'bp-contract small';
  bpContract.textContent = 'Step 0 = initial |0...0\u2022 state (no columns applied yet). Step k (1 \u2264 k \u2264 scheduleLength) = state after column k-1 has been applied. A breakpoint at "step k" halts at state step k \u2014 the state BEFORE column k is applied.';
  const bpParent = breakpointList.parentElement ?? document.getElementById('panel-bottom');
  if (bpParent && typeof bpParent.insertBefore === 'function') {
    bpParent.insertBefore(bpContract, breakpointList);
  }

  refreshTimeline();
  refreshBreakpoints();

  return { updateDebugStep: refreshTimeline };
}
