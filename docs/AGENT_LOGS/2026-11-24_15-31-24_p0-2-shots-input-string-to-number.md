Title: P0-2 browser shot-count input string-to-number conversion

Summary:
Fixed P0-2 — the HTML shots <input> yields a string, which was passed directly to AppController.setShots(). src/ui/browser-app.js:118 now parses with Number(ev.target.value), rejects non-finite/non-positive values with a visible status via app._status() (keeping the previous count), floors valid fractions, and calls app.setShots(Math.floor(shots)). src/ui/app-controller-shots.js setShots() now coerces input with Number() before the existing NaN/Infinity/<=0 rejection (visible status, keeps previous count) and Math.max(1, Math.floor(value)) clamp, updating this._shots. Added regression test 'shots: setShots coerces numeric strings and rejects non-numeric strings' in test/ui/app-controller-shots.test.js covering "1024", "abc", "", "1024.7", "-5".

Verification:
- node --check src/ui/browser-app.js src/ui/app-controller-shots.js test/ui/app-controller-shots.test.js: SYNTAX OK
- npm run test:ui: 190 pass, 0 fail (new shots test ok 95)
- Line counts: browser-app.js 149, app-controller-shots.js 23, app-controller-shots.test.js 101 (all under 400)

Note: git status shows additional pre-existing working-tree changes (Debugger/main/StepTrace/AppController split refactor and AGENT_LOGS) from a parallel session; only the three shots-related files above were modified in this session.
