Title: P0-10 — Genuine browser integration test harness (skip-when-no-browser)

Summary:
Probed the environment for a real browser runtime: Node v22.22.1 (linux/x64) has global WebSocket and fetch, but NO chromium/chrome/firefox/webkit binary is installed (checked command -v and common paths under /usr/bin and /opt). Only xdg-open (distrobox wrapper) and flatpak exist, with no browser provisioned.

Created test/browser/ with three zero-dependency files (all under 400 lines, ESM, named exports):
- browser-probe.js: probeBrowser() checks for browser binaries via command -v and common paths, reads --version, and reports Node/browser/runtime identity. launchBrowser() spawns the browser with --headless=new --remote-debugging-port and returns a handle with kill().
- cdp-client.js: minimal Chrome DevTools Protocol client over WebSocket using only Node built-ins (global WebSocket + fetch), with send/evaluate/enable/on/close.
- real-browser-integration.test.js: two tests. (1) "browser/runtime identity probe" always runs and logs Node version/platform/arch, WebSocket/fetch availability, browser binary/version, and the probe reason to stdout. (2) "real-browser integration..." skips gracefully via t.skip() with a console.error diagnostic to stderr when no browser (or no WebSocket) is available; when a browser IS found it launches it on file://index.html, polls the CDP /json/version endpoint, connects via WebSocket, enables Page/Runtime/DOM, asserts all UI surface selectors (#gate-palette, #circuit, #tab-strip, inspector tabs/widgets, debugger transport/timeline/breakpoints, code import/export/share, AI sections, I/O analysis, URL routing controls, panel toggles, shots input), asserts zero console errors during load, and exercises a failure path (navigation to a nonexistent URL must surface an error).

Verification:
- node --check passes on all three new files.
- node --test test/browser/real-browser-integration.test.js: tests 2, pass 1, fail 0, skipped 1. The integration test skips with reason "no browser runtime available (checked ...)" and reports browser/runtime identity in output.
- Full `npm test` was started but the environment is slow (>7 min cap hit); a pre-existing stale log shows 130 failures in areas unrelated to this change (deutschJozsa, placeGateFromCell, etc.). Git status confirms I only added test/browser/ — all other working-tree modifications and failures are pre-existing and not introduced by P0-10. The browser test itself adds 0 failures.

No npm dependencies were added. The test must not fail when no browser is available — it skips gracefully.
