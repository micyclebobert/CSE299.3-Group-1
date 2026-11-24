import { test } from 'node:test';
import { strictEqual, ok } from 'assert';
import { probeBrowser, launchBrowser } from './browser-probe.js';
import { CdpClient } from './cdp-client.js';

const HTML_FILE = 'index.html';
const DEBUG_PORT = 9222;

const SELECTORS = [
  '#gate-palette', '#circuit', '#tab-strip', '#panel-left', '#panel-main',
  '#panel-right', '#panel-bottom', '#btn-simulate', '#btn-reset', '#btn-undo',
  '#btn-redo', '#btn-copy', '#btn-import', '#btn-export', '#btn-share',
  '#code-view', '#ai-output', '#ai-prompt', '#builder-output', '#io-input-row',
  '#io-output-row', '#io-output', '#shots-input', '#btn-sample', '#btn-step',
  '#btn-run', '#btn-breakpoint', '#btn-run-to-bp', '#bp-column', '#timeline-scrub',
  '#step-current', '#step-total', '#breakpoint-list', '#inspector-content', '#status',
];

function waitForDebuggingPort(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  const poll = () =>
    fetch(`http://127.0.0.1:${port}/json/version`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`version endpoint HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        if (Date.now() >= deadline) throw err;
        return new Promise((resolve) => setTimeout(resolve, 250)).then(poll);
      });
  return poll();
}

test('browser/runtime identity probe', (t) => {
  const probe = probeBrowser();
  console.log(
    JSON.stringify({
      kind: 'browser-identity',
      node: probe.node,
      websocket: probe.websocket,
      fetch: probe.fetch,
      browserFound: probe.found,
      browserBinary: probe.binary,
      browserVersion: probe.version,
      browserSource: probe.source,
      reason: probe.reason,
    })
  );
  ok(true, 'browser/runtime identity reported');
});

test('real-browser integration: load index.html and assert UI surface', async (t) => {
  const probe = probeBrowser();
  if (!probe.found) {
    console.error(`[real-browser] SKIP: ${probe.reason}`);
    t.skip(`no browser runtime available: ${probe.reason}`);
    return;
  }
  if (!probe.websocket || !probe.fetch) {
    console.error(
      '[real-browser] SKIP: Node lacks WebSocket/fetch needed for Chrome DevTools Protocol'
    );
    t.skip('Node lacks WebSocket/fetch for CDP');
    return;
  }

  const harness = launchBrowser(probe.binary, HTML_FILE, DEBUG_PORT);
  let versionInfo = null;
  let pageTarget = null;
  let cdp = null;
  try {
    versionInfo = await waitForDebuggingPort(DEBUG_PORT);
    console.log(
      JSON.stringify({
        kind: 'browser-runtime',
        browser: versionInfo.Browser || probe.binary,
        protocolVersion: versionInfo.ProtocolVersion,
        userAgent: versionInfo.UserAgent,
        webkitVersion: versionInfo.WebKitVersion,
        debuggingPort: DEBUG_PORT,
        file: harness.fileUrl,
      })
    );

    const listRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await listRes.json();
    pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    ok(pageTarget, 'at least one debuggable page target');
    ok(pageTarget.webSocketDebuggerUrl, 'page target exposes a debugging WebSocket URL');

    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    ok(cdp.connected, 'CDP WebSocket connected');

    let cdpAvailable = true;
    try {
      await cdp.enable('Page');
      await cdp.enable('Runtime');
      await cdp.enable('DOM');
    } catch {
      cdpAvailable = false;
    }
    if (!cdpAvailable) {
      console.error(
        '[real-browser] SKIP: browser does not expose Chrome DevTools Protocol domains'
      );
      t.skip('browser does not expose Chrome DevTools Protocol');
      return;
    }

    const consoleErrors = [];
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error' || params.type === 'exception') {
        consoleErrors.push(params);
      }
    });

    const ready = await cdp.evaluate('document.readyState');
    ok(ready.value === 'complete' || ready.value === 'interactive', 'document reached ready state');

    for (const selector of SELECTORS) {
      const res = await cdp.evaluate(
        `!!document.querySelector(${JSON.stringify(selector)})`
      );
      strictEqual(res.result.value, true, `element present in DOM: ${selector}`);
    }

    strictEqual(
      consoleErrors.length,
      0,
      'no console errors during page load (no failure path triggered)'
    );

    // Failure path: navigating to a nonexistent URL must surface an error.
    let failureDetected = false;
    const errorsBefore = consoleErrors.length;
    try {
      await cdp.send('Page.navigate', {
        url: 'file:///__nonexistent_simqc_page__.html',
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      failureDetected = consoleErrors.length > errorsBefore;
    } catch {
      failureDetected = true;
    }
    ok(failureDetected, 'failure path detected for nonexistent URL');
  } finally {
    if (cdp) cdp.close();
    harness.kill();
  }
});
