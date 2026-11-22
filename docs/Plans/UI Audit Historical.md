# UI Audit

> **Review basis:** post-review UI delivery commits `1f2c139` and `d53e4e0` (the diff from `77a186e` through current `HEAD` `d53e4e0`). “DONE” means the change landed in source. Browser acceptance is recorded under **QA**. Mandatory or far-reaching failures remain under **TODO**. The complete previous audit is preserved verbatim at the end of this document as the prior-review TODO baseline.

## DONE

### 1. Browser startup and controller correctness fixes

- Removed the duplicate `theme` import and undefined `themeObj` usage; the inline browser module now parses.
- Implemented `_bindCanvas()` and `_bindResize()`; controller construction succeeds under the minimal DOM smoke shim.
- Corrected undo/redo restoration so `_setCircuit(..., { record: false })` preserves the redo branch.
- Corrected shot sampling by copying the `StepTrace` read-only state facade into a real `StateVector` before repeated-shot sampling.
- Added `test/ui/AppControllerStartup.test.js` for startup, pointer recording, and resize behavior.

### 2. Pure multi-qubit placement model

- `Interaction.drop()` now consumes palette metadata and allocates the required positive controls, `target2`, and default parameter angle.
- Added and passed coverage for CNOT, Toffoli, SWAP, Cu1, and insufficient-row conflicts.
- The pure model now rejects placement when a gate's required arity cannot fit.

### 3. Inspector readouts and tab behavior

- Moved tab selection handling onto the actual `#tab-strip` element.
- Added live amplitude, real/imaginary component, probability, probability-bar, Bloch-vector, vector-length, and linear-entropy tables.
- Added a browser shot-count control and empirical-count output.

### 4. Debugger UI state model

- Expanded `DebuggerUI` into a callback-driven state model for transport, changed steps, column/predicate breakpoints, breakpoint enablement, and navigation.
- Added `test/debugger/DebuggerUI.test.js` and completed the delegated breakpoint APIs in `Debugger`.

### 5. AI browser workflows

- Replaced Node-only `process.stderr.write` with a guarded browser-safe fallback log.
- Restored exclusive AI-leaf import through `src/main.js`.
- Added `AIBuilderUI` and `IOAnalyzerUI` state models with cache/status/error callbacks and mirrored tests.
- Added browser controls for AI explanation, natural-language circuit building, and input/output-row analysis.

### 6. URL persistence and sharing

- Added zero-dependency RFC 1951 deflate-raw plus URL-safe Base64 encoding in `src/circuit/URLCodec.js`.
- Added canonical JSON round-trip, URL-safe charset, repeated-cycle, compression, and Node-zlib interoperability tests.
- Wired Share URL generation and `#circuit=` hash loading into the browser.

### 7. Panels, documentation, and tests

- Added panel collapse/expand buttons wired through `PanelModel` visibility state.
- Split the README status table into separate engine and browser-UI columns.
- Added focused test suites for URL codec, AppController startup, Debugger UI, AI Builder UI, and I/O Analyzer UI.

## QA

### Review outcome

**Overall browser acceptance: FAIL.** Startup and many supporting components now work, but the primary editor action—placing a gate on the canvas—still throws `ReferenceError: n is not defined`. The pointer-to-grid mapping is also inconsistent with the renderer. Several other surfaces are partial models or tables rather than the canonical widgets.

### Delivered-area review (part 1 of 2)

| Delivered area | QA result | Evidence |
|---|---|---|
| Browser module startup | **PASS** | The inline module now passes `node --input-type=module --check`; the previous duplicate `theme` declaration and `themeObj` error are gone. |
| AppController construction | **PASS under minimal DOM shim** | `AppControllerStartup.test.js` constructs the controller and verifies pointer/resize bindings. No real-browser DOM suite is present. |
| Undo/redo | **PASS** | Controller reproduction: import → undo → redo preserves the expected circuit and redo availability. |
| Pure multi-qubit placement model | **PASS** | `Interaction.drop()` allocates the required controls/second target and rejects insufficient rows; focused tests pass. |
| Browser palette placement | **FAIL / BLOCKER** | Browser placement calls `AppController.placeGateAt()` → `_tryPlace()`, not the corrected `Interaction.drop()`. `_tryPlace()` references undefined `n` at `src/ui/AppController.js:211`; reproduction throws `ReferenceError: n is not defined` before any gate can be placed. |
| Browser pointer-to-grid mapping | **FAIL** | Renderer geometry is 80px column pitch and 48px row pitch with a 48px label gutter, but browser snapping uses 20px/20px and offsets 48/10. At renderer cell center `(80,20)`, browser mapping yields column 2/row 1 instead of column 0/row 0. |
| Browser drag/drop semantics | **PARTIAL / FAIL** | Palette selection and pointer pick/drag/snap/drop listeners now exist, but placement crashes and the snapped cell is wrong. The pure `Interaction.drop()` result is never consumed by the browser. |
| Controlled-gate browser semantics | **BLOCKED** | Pure-model arity handling is fixed, but the browser path bypasses it. The AppController path also allocates controls without reserving the chosen target row, so it can duplicate target/control rows if the undefined-variable crash is fixed in isolation. |
| Inspector tabs and numeric readouts | **PARTIAL / LIVE-UPDATE DEFECT** | Tabs now switch; amplitude/probability tables and bars are implemented. However, `app.onInspector(() => renderInspector())` is later overwritten by `app.onInspector(() => {})`, so controller notifications no longer refresh the Inspector automatically; only actions that explicitly call `renderInspector()` do. The “Bloch Spheres” tab is a numeric vector table, not a rendered Bloch sphere with per-qubit subtabs/register overview. |
| Ket labels | **PASS** | Inspector labels match the required `q(n-1)...q0` display order for representative indices. |
| Shot sampling | **PASS at controller level** | Sampling now accepts the copied `StateVector`. Browser output is a text frequency list, not a rendered histogram chart. |
| Canonical JSON import/export | **PASS at source level; browser blocked by placement** | The textarea uses `Serializer.toJson()`/`fromJson()`; copy/import/export actions are wired. |
| URL codec and share/hash loading | **PASS at codec/source level** | Deflate-raw + Base64url round-trips and interoperates with Node zlib. Browser hash loading is wired. Live-browser route behavior is not tested. |

### Delivered-area review (part 2 of 2)

| Delivered area | QA result | Evidence |
|---|---|---|
| Debugger UI model | **PASS at model level** | `DebuggerUI` has transport, timeline-state, breakpoint, and callback coverage. |
| Debugger browser workflow | **FAIL / NOT INTEGRATED** | `DebuggerUI` is imported but never instantiated; `AppController._debugger` remains null. Browser Step/Run call `StepTrace` directly. There is no timeline slider, seek control, current-column marker, breakpoint UI, or run-to-breakpoint control. `updateDebugStep()` is called initially but not after Step/Run/Reset, so the displayed step counter becomes stale. Step at the final schedule can still throw from `StepTrace.next()`. |
| AI explainer | **PARTIAL** | Browser-safe fallback and exclusive import are fixed. The browser still supplies empty sparse summaries instead of top-k state grounding and creates a new explainer/cache per request. |
| AI Builder | **PARTIAL** | Build/status/error/cache workflows exist and are tested, but the browser only displays generated JSON; it never applies `aiBuilder.circuit` to the editor. There is no builder qubit-count control. |
| I/O Analyzer | **FAIL in browser integration** | The UI model works when given suitable state, but browser analysis does not pass `options.state`, so sparse output is absent. It also assumes `causalChain` entries are objects (`c.column`), while `IOAnalyzer` returns strings, producing `col undefined`. Changed-step filtering uses snapshot indices (`[1, 2]`) against zero-based virtual columns (`[0, 1]`), so even after simulation the first changed column can be omitted. |
| Panel collapse behavior | **PARTIAL** | Buttons toggle DOM visibility through `PanelModel`; CSS grid tracks do not reflow to reclaim hidden space, and resize/drag/dock/responsive behavior remains absent. |
| Optional-leaf deletability | **FAIL** | `main.js` still imports five AI modules and two Inspector modules; deleting a leaf requires more than the mandated two-line diff. Browser consumption does correctly flow through `main.js` for feature leaves. |
| Test coverage | **PARTIAL** | Focused changed-area suites pass, but there is still no exact `test/ui/AppController.test.js` mirror, no Inspector test directory, and no browser interaction/E2E suite exercising placement, tabs, URL navigation, Inspector live updates, or canvas coordinates. |

### Verification performed for this review

- Focused UI/editor/canvas/Debugger/AI/URL suites: **268 passed, 0 failed**.
- Full `node --test`: **775 passed, 0 failed**. The suite does not exercise the browser placement path, pointer geometry, or integrated I/O rendering.
- Inline browser-module syntax check: **passed**.
- Controller undo/redo reproduction: **passed**.
- Browser placement reproduction: **failed** (`ReferenceError: n is not defined`).
- Browser pointer mapping reproduction: **failed** (renderer cell center mapped to column 2/row 1).
- I/O Analyzer browser-contract reproduction: **failed** (`col undefined`; no sparse state supplied).

## TODO

### Mandatory blockers found during QA

- [ ] Fix `AppController._tryPlace()` so the browser placement path does not reference undefined `n`, reserves the selected target row before allocating controls, and validates target/control/`target2` rows.
- [ ] Make the browser consume the tested `Interaction.drop()` result (or share one placement implementation) rather than maintaining a second, divergent placement algorithm.
- [ ] Derive pointer snapping from renderer geometry (`colWidth + colGap`, `rowHeight + rowGap`, label gutter, and cell-center offsets); add a browser-coordinate regression test.
- [ ] Add an end-to-end browser placement test that selects a palette gate, drops it at a known cell, verifies the resulting circuit, and re-renders the canvas/Inspector.
- [ ] Integrate `DebuggerUI` into `AppController`/the browser and add timeline seek, current-column display, breakpoint controls, run-to-breakpoint, safe end-of-schedule Step behavior, and live step-counter updates.
- [ ] Restore Inspector live updates by preventing the later empty `onInspector` registration from replacing `renderInspector()`.
- [ ] Fix I/O Analyzer integration: align changed-step indices with zero-based virtual columns, analyze the intended state boundary, pass `options.state` for sparse summaries, and render the string-based causal chain without accessing `c.column`.
- [ ] Add actual Bloch-sphere rendering with per-qubit subtabs/register overview; the numeric vector table is not the canonical widget.
- [ ] Add a rendered empirical shot histogram; the current text frequency list is not a chart.
- [ ] Apply AI Builder results to the editor and expose builder qubit count; populate AI explainer prompts with sparse state summaries and reuse the cache.
- [ ] Restore optional-leaf deletability to the mandatory two-line-diff rule.
- [ ] Add the exact `test/ui/AppController.test.js` mirror, Inspector module test mirrors, and browser-level startup/interaction coverage.

### Far-reaching remaining work

- [ ] Add user workflows for controls, anti-controls, second targets, and parameterized-gate angles; preserve automatic allocation only as an explicit fallback.
- [ ] Support moving/deleting existing gates and keyboard-accessible placement.
- [ ] Apply `PanelModel.getLayoutRects()` to CSS grid tracks; add resize, drag/dock behavior, responsive layout, and circuit zoom/pan/scroll.
- [ ] Add URL hash-change handling and browser persistence/error-state feedback beyond the initial load path.
- [ ] Add reusable circuit blocks/subcircuits and algorithm insertion workflows.
- [ ] Update README browser-UI status claims after browser acceptance, rather than retaining “planned/scaffold-only” labels for features whose integrated workflows are now present.

### Prior audit contents (preserved verbatim as the TODO baseline)

<details>
<summary>Previous UI audit and original investigation report</summary>


# UI Audit

> **Review basis:** browser controller/renderer delivery commit `77a186e` (`HEAD~1..HEAD`). The note referred to `HEAD~1`, but in the reviewed repository the delivered UI work is the current `HEAD`; `HEAD~1` is `542de9c` (theme unification). “DONE” means the change landed in source. Browser acceptance is recorded under **QA**. Mandatory or far-reaching failures remain under **TODO**.

## DONE

### 1. Browser application state/controller source

Delivered in `src/ui/AppController.js` and wired by `index.html`:

- Mutable current circuit and current `StepTrace`.
- Shared `History`, shot count, palette catalog, and Inspector model.
- Render, Inspector, and code-view subscriptions plus a change broadcaster.
- Circuit placement, serialization/deserialization, simulation/reset/step/seek methods, Inspector read accessors, and shot-sampling API.
- Browser toolbar and panel controls for simulate, reset, undo/redo, step/run, shots, canonical JSON, and AI explainer.

### 2. Renderer corrections

Delivered in `src/canvas/Renderer.js` and its browser painter:

- Label gutter and on-canvas qubit labels.
- Horizontal row separators.
- Centre-aligned controlled-gate lines, control dots, CNOT target symbol, and SWAP connection.
- State-driven row glow from linear entropy rather than “has controls.”
- Parameter-angle labels on gates.
- CSS canvas layout size separated from DPR-scaled backing-store size.

### 3. Palette and circuit catalog expansion

Delivered in `src/editor/gatePalette.js`:

- CNOT, CZ, SWAP, and Toffoli added to the palette.
- Arity, control-count, target2, and parameter metadata added to palette entries.
- Palette rendered by category in the browser.

### 4. Inspector and Code/AI surface scaffolding

Delivered in `index.html`:

- Inspector tab strip for Amplitudes, Probabilities, and Bloch Spheres.
- Shot-count input and empirical-count output area.
- Editable canonical JSON textarea with copy/import/export/share actions.
- AI explainer action and output area.

### 5. Existing feature wiring

`src/main.js` now exports Inspector, InspectorUI, DebuggerUI, AIExplainer, IOAnalyzer, AIBuilder, and Cache so the browser entry can consume them.


## QA

### Review outcome

**Overall browser acceptance: FAIL.** The delivery is substantial, but the browser module does not parse, so none of the newly wired UI can currently start. Even after the parse error is fixed, controller construction and several mandatory flows still fail.

### Delivered-area review (part 1 of 2)

| Delivered area | QA result | Evidence |
|---|---|---|
| Browser module startup | **FAIL** | `index.html` imports `theme` from both `src/ui/theme.js` and `src/main.js`; `node --input-type=module --check` reports `Identifier 'theme' has already been declared`. `themeObj` is also undefined at `index.html:127`. |
| Controller construction | **FAIL** | `AppController` calls `_bindCanvas()` and `_bindResize()` at lines 61-62, but neither method exists. After import fixes, construction throws before `resetCircuit()`. |
| Controller DOM ownership/testability | **PARTIAL** | Elements are injected, but `_renderPalette()` uses global `document` directly, contradicting the file’s “via injected element refs” claim and making the controller harder to isolate in tests. |
| Undo/redo | **FAIL** | `undo()`/`redo()` call `_setCircuit()`, which always pushes onto `History`; this truncates the redo branch and duplicates the restored snapshot. Reproduction: after undo plus restore, `canRedo()` is false. |
| Palette placement | **PARTIAL / FAIL for multi-qubit gates** | Click placement works only into column 0. The existing `Interaction` state machine and canvas hit-testing are still unused, so real drag-and-drop and cell selection remain absent. `_tryPlace()` allocates only one control regardless of `entry.controls`; Toffoli is therefore built with one control. It can also create CNOT/CZ/Toffoli with zero controls when no second row is available. |
| Palette semantics | **PARTIAL** | CNOT/CZ/SWAP/Toffoli and metadata landed, but user selection of control rows, anti-controls, second target, and rotation angle is still absent. |
| Renderer geometry and symbols | **PASS at pure-renderer level** | Focused renderer tests pass (75/75 across focused canvas/editor/UI suites). Labels, separators, centre lines, symbols, parameter labels, and row-glow descriptors are emitted. |
| Renderer/browser integration | **BLOCKED** | The browser cannot parse/start. Visual paint order and canvas fit still require live-browser confirmation. |
| Simulation state | **PASS at controller-source level; browser blocked** | `StepTrace` construction, stepping, reset, seek, and Inspector access are present. There is still no real `Debugger` instance, timeline scrubber, breakpoint UI, or end-of-schedule guard on Step. |

### Delivered-area review (part 2 of 2)

| Delivered area | QA result | Evidence |
|---|---|---|
| Inspector widgets | **FAIL / SCAFFOLD ONLY** | Tabs exist, but their click listener is attached to `#inspector-content` while the buttons are siblings in `#tab-strip`, so tab switching never fires. Amplitudes shows probabilities only; Probabilities shows no distribution; Bloch shows only a sentence; no Bloch sphere or per-qubit subtab is rendered. `app.amplitudes()` and `app.bloch()` are unused. |
| Shot histogram | **FAIL** | `sampleShots()` passes `StepTrace.currentState` (a read-only facade) to `measurement.sampleHistogram()`, which requires a `StateVector`; reproduction throws `TypeError: sampleHistogram expects a StateVector instance`. The output is a text count list, not a histogram chart. |
| Canonical JSON | **PASS at source level; browser blocked** | `Serializer.toJson()`/`fromJson()` are now used, replacing the invalid `{name: ...}` display. Import/export/copy controls landed. |
| Share URL | **FAIL** | Share creates a Base64 fragment but there is no hash loader/decoder. It is not compressed and Base64 is not URL-safe, contrary to the canonical URL codec requirement. |
| AI explainer | **FAIL** | `index.html` directly imports `src/ai/AIExplainer.js`, violating the rule that `ai/` is imported exclusively by `main.js`. Offline fallback still crashes on `process.stderr.write` in a browser. The UI supplies empty sparse summaries. AI Builder and I/O Analyzer have no controls. |
| Optional-leaf deletability/layering | **FAIL** | `main.js` imports five AI modules and two Inspector modules; deleting a leaf requires more than the mandated two-line diff. `index.html` bypasses `main.js` for AI. |
| Browser integration tests | **FAIL / MISSING** | No `test/ui/AppController.test.js` exists despite the mandatory 1:1 mirror rule. Existing tests do not load `index.html`, so the duplicate-import/runtime failures are not detected. |

### Verification performed for this review

- Focused canvas/editor/UI tests: **75 passed, 0 failed**.
- Full `node --test`: **704 passed, 0 failed**. The suite does not load the inline browser module, so it does not detect the startup blockers.
- Inline browser-module syntax check: **failed** due to duplicate `theme` declaration.
- History undo/restore reproduction: **failed** (redo history lost).
- Toffoli placement reproduction: **failed** (one control instead of two).
- Shot-sampling reproduction: **failed** (`currentState` is not a `StateVector`).

## TODO

### Mandatory blockers found during QA

- [ ] Fix the duplicate `theme` import and undefined `themeObj` in `index.html`.
- [ ] Implement or remove the missing `_bindCanvas()` and `_bindResize()` calls in `AppController`; add a startup smoke test that loads the browser module.
- [ ] Correct undo/redo so restoring a history entry does not push it as a new edit or truncate the redo branch.
- [ ] Enforce gate arity/control requirements during placement; never create CNOT/CZ/Toffoli without their required controls.
- [ ] Fix shot sampling by using a compatible pre-collapse state/vector path, then verify empirical frequencies.
- [ ] Attach Inspector tab handling to the actual tab strip, then replace Inspector placeholders with actual amplitude/probability readouts, big-endian ket labels, empirical histogram, Bloch-sphere rendering, and per-qubit Bloch subtabs.
- [ ] Preserve the `ai/` exclusive-import rule and make the browser fallback safe when `process` is unavailable.
- [ ] Add the required mirrored `test/ui/AppController.test.js` and browser-level startup/interaction coverage.

### Far-reaching remaining work

- [ ] Connect true palette drag-and-drop/canvas cell selection through `Interaction`; support move/delete and keyboard placement.
- [ ] Add user workflows for controls, anti-controls, second targets, and parameterized-gate angles.
- [ ] Instantiate the Debugger and add timeline scrubbing, current-column display, breakpoint markers/toggles, and safe end-of-schedule behavior.
- [ ] Implement the canonical compressed URL-safe codec plus hash loading/decoding; complete JSON import/export/copy behavior.
- [ ] Add AI Builder and I/O Analyzer workflows, sparse state grounding, and cache/status feedback.
- [ ] Apply `PanelModel` to the DOM; add collapse, resize, drag/dock behavior, responsive layout, and circuit zoom/pan/scroll.
- [ ] Restore optional-leaf deletability to the mandatory two-line-diff rule.
- [ ] Update README/status claims to distinguish engine completion from browser UI acceptance.

### Original UI investigation report (preserved as the pre-change TODO baseline)

<details>
<summary>Original audit contents (verbatim)</summary>

# UI investigation report

## Executive summary

The current browser UI is a **static four-panel demonstration**, not an interactive application.

Most of the underlying engine and pure UI models already exist, but the browser entry point does not connect them:

- The circuit is a fixed, immutable Bell-state example.
- Palette buttons have no click or drag handlers.
- The Inspector is a hard-coded sentence.
- Code is read-only and is not canonical SimQC JSON.
- Simulation, Debugger, Inspector, AI, History, and URL persistence are not wired into the page.
- The only browser event registered is `resize`.

The known Inspector and drag-and-drop failures are therefore symptoms of a broader missing **browser controller/state layer**.

The live deployment at `https://simqc.netlify.app` exposes the same static shell.

---

## Feature status matrix

| Area | Existing reusable code | Browser implementation | Status |
|---|---|---|---|
| Four-panel shell | `PanelModel` exists | Fixed CSS grid only | Partially implemented |
| Gate toolbox | Catalog and pure placement model | Inert buttons | Broken |
| Circuit canvas | Pure draw-command renderer | Fixed Bell circuit | Partially implemented, visually defective |
| Inspector calculations | Purity, Bloch vector, histogram sampler | Hard-coded text | Unimplemented |
| Inspector widgets | None | None | Unimplemented |
| Debugger engine | Playback, timeline, breakpoints | No controls or panel | Unimplemented |
| Code view | Canonical `Serializer` exists | Invalid read-only JSON | Broken |
| AI assistant | Explainer, Builder, I/O analyzer classes | No controls | Unimplemented |
| Undo/redo | `History` exists | No UI | Unimplemented |
| JSON/URL persistence | Canonical JSON only; no URL codec found | No import/export/share UI | Unimplemented |
| Measurement/shots | Measurement module exists | No shot controls | Unimplemented |
| Responsive/dockable panels | Partial pure model | Fixed dimensions, no resizing | Unimplemented |

---

# Confirmed findings

## Blocker 1 — The browser application has no interaction controller

The entire browser behavior is contained in the inline script in:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:55-143`

It creates one fixed circuit:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:62-69`

```js
const bell = new Circuit({
  numQubits: 2,
  columns: [...]
});
```

There is no mutable `currentCircuit`, simulation state, change notification, or render-after-edit path.

The only registered browser event is:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:142`

```js
window.addEventListener('resize', draw);
```

Repository-wide inspection found no `dragstart`, `dragover`, `drop`, `pointerdown`, `mousedown`, `click`, or keyboard editing handlers.

### Consequence

Even if a palette button were clicked:

- The circuit would not change.
- The canvas would not be redrawn.
- The Inspector would not update.
- The code view would not update.
- Undo/redo would not record anything.

### Missing foundational piece

A browser-side application controller/state store is needed before individual widgets can be implemented reliably.

---

## Blocker 2 — Drag-and-drop is only a pure state machine

The pure interaction model exists at:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/editor/Interaction.js`

However:

- It is not imported by `index.html`.
- It is not connected to palette buttons.
- It is not connected to canvas pointer/drag events.
- Its resulting immutable `Circuit` is not stored anywhere.
- The canvas is not redrawn after a drop.
- The simulation and Inspector are not updated after a drop.

`main.js` exports the interaction object:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/main.js:91`

but the browser entry point does not consume it.

### Additional editing gaps

Even after connecting the existing state machine, the editor would still lack:

- Selecting an existing gate.
- Moving an existing gate.
- Removing a gate.
- Replacing a gate.
- Adding/removing qubit rows.
- Editing parameterized-gate angles.
- Selecting control rows or anti-controls.
- Selecting a second target for SWAP.
- Keyboard-accessible placement.
- Undo/redo controls.

---

## Blocker 3 — Controlled and multi-qubit gates cannot be created correctly

The palette currently contains:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/editor/gatePalette.js:16-28`

- I, X, Y, Z, H, S, T
- Rx, Ry, Rz, Cu1

It is missing the gates required by the Sprint 5 palette contract:

- CNOT
- CZ
- SWAP
- Toffoli

The Sprint 5 requirement explicitly lists those gates:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/docs/Plans/S5.md:56-60`

The current test suite actually codifies the omission:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/editor/gatePalette.test.js:95-98`

```js
strictEqual(findGate('CNOT'), null);
```

More seriously, the placement code always creates a single-target, uncontrolled gate:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/editor/Interaction.js:134-141`

```js
const gate = new Gate({
  name: gateEntry.name,
  target: row,
  controls: [],
  ...
});
```

It never supplies `target2` or control rows.

### Concrete Cu1 bug

Cu1 is currently in the palette, but Cu1 is a controlled-phase operation. Dropping it produces:

```text
name: "Cu1"
controls: []
target2: undefined
```

That means it behaves as an uncontrolled phase operation rather than controlled-U1.

### Consequence

The palette metadata needs explicit arity/control metadata, and `Interaction.drop()` needs to construct valid gates based on that metadata and the editor’s current control-selection state.

---

## Blocker 4 — The Inspector widgets do not exist

The browser Inspector is only:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:49-52`

```html
<div id="inspector" class="muted">No state yet.</div>
```

The inline script replaces it with a static sentence:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:139`

```js
inspectorEl.textContent =
  'Bell state rendered: H(0) then CNOT(0→1). Probabilities: |00⟩=0.5, |11⟩=0.5';
```

No `Inspector` class is imported or instantiated in the browser.

The purported UI adapter is only:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/InspectorUI.js:8-16`

```js
export class InspectorUI {
  constructor(stepTrace) {
    this._stepTrace = stepTrace;
  }

  probabilities() {
    return this._stepTrace.currentState.probabilities();
  }
}
```

It has no rendering, tabs, charts, controls, or DOM behavior.

### Clarification of the intended tab structure

The canonical specification defines two **top-level** Inspector tabs:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/SOURCE_OF_TRUTH.md:372-374`

1. **Amplitudes, Probabilities & Shot Histogram**
2. **Bloch Spheres**, containing per-qubit subtabs and a register overview

So the intended hierarchy is slightly deeper than simply “Histogram” and “Bloch Sphere” buttons.

### Missing Inspector widgets

- Tab strip and selected-tab state.
- Amplitude table or bars.
- Probability table or bars.
- Real/imaginary components.
- Phase display.
- Shot-count input and sampling button.
- Empirical shot histogram.
- Bloch sphere renderer.
- Per-qubit Bloch subtabs.
- Register-overview view.
- Purity/linear-entropy display.
- Live updates as the Debugger advances.

### Existing reusable calculations

The math portions already exist:

- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Inspector.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Bloch.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Histogram.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Purity.js`

They need browser presentation and state wiring, not a mathematical rewrite.

---

## Blocker 5 — The Code & AI panel is not a code editor and its JSON is invalid

The panel is a plain `<div>`:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:45-48`

```html
<div id="code-view" class="muted">{} </div>
```

There is no editable element, import action, export action, copy action, or AI form.

### Invalid canonical JSON

The displayed code is generated with `Gate.toDescriptor()`:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:135-138`

But `toDescriptor()` emits:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/circuit/GateColumn.js:93-102`

```js
{ name, target, target2?, controls? }
```

Canonical SimQC v1 requires `"gate"`, not `"name"`, and may include `"thetaRad"`.

A runtime reproduction confirmed that `Serializer.fromJson()` rejects the displayed document:

```text
Gate at column 0 gate 0 has missing or invalid 'gate' field: undefined
```

Additionally, `toDescriptor()` does not include `thetaRad`, so parameterized angles would disappear from this view.

The existing correct serializer is:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/circuit/Serializer.js:42-89`

The UI should use that rather than duplicating serialization.

### Missing Code & AI functionality

- Editable canonical JSON.
- Live synchronization both ways.
- Validation errors.
- Copy/download.
- JSON file import.
- Compressed shareable URL.
- Exported code view.
- AI explainer prompt and output.
- AI builder prompt and circuit replacement.
- Input/output row selectors for causal analysis.

No URL codec implementation was found anywhere in `src/` or `test/`.

---

## Blocker 6 — No live simulation is connected to the UI

The browser entry point does not import or use:

- `flattenCircuit`
- `scheduleColumns`
- `Evaluator`
- `StepTrace`
- `measurement`
- `Inspector`
- `Debugger`

As a result, the Inspector’s Bell probabilities are a hard-coded string rather than a computed state.

There are also no browser controls for:

- Run/simulate.
- Reset.
- Step forward/backward.
- Play/pause.
- Seek to a virtual column.
- Set breakpoint.
- Run to breakpoint.
- Set shot count.
- Reset shots.

The simulation and stepping engines are largely present, so this is primarily missing integration work.

---

# High-severity rendering and interaction defects

## High 1 — Qubit labels are drawn off-canvas

The renderer places labels at `x = 0`:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/canvas/Renderer.js:22-32`

The browser then right-aligns text at `x - 6`:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:89-94`

```js
ctx.textAlign = 'right';
ctx.fillText(g.text, g.x - 6, ...);
```

With `g.x === 0`, the text is positioned at `-6`, so the labels are effectively outside the canvas.

There is also no left gutter reserved for labels.

---

## High 2 — The CNOT overlay hides the gate label

Renderer descriptor order for a controlled gate is:

1. Gate rectangle and text
2. Control line
3. Glow rectangle

See:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/canvas/Renderer.js:47-87`

The browser draws the gate text first:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:101-111`

Then later draws the glow as an **opaque** full-rectangle fill:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:112-118`

This covers the previously rendered gate label.

### Related semantic problems

- CNOT is rendered as a generic rectangle labeled “CNOT”.
- There is no control dot.
- There is no target-circle/⊕ symbol.
- Anti-controls look identical to positive controls.
- SWAP has no second-target connection.
- Parameter values are not displayed.

---

## High 3 — Controlled-gate lines connect to the wrong coordinates

The renderer uses the top of a row as its control/target coordinate:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/canvas/Renderer.js:70-75`

But gate boxes span from `rowY(...)` through `rowY(...) + rowHeight`. Their visual centers are therefore lower than the line endpoints.

The result is a control line that:

- Starts at the top edge of the source row.
- Ends at the top edge of the target box.
- Does not pass through gate centers or control dots.

This should be corrected before adding more controlled gates.

---

## High 4 — “Entanglement glow” is not based on entanglement

Any gate with controls receives the green glow:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/canvas/Renderer.js:66-87`

That means the renderer treats “has a control” as “is entangled.”

The canonical requirement is a row-level glow proportional to linear entropy:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/SOURCE_OF_TRUTH.md:381-390`

The renderer does not receive simulation state and never calls `Purity`. It therefore cannot implement the required behavior.

The current glow is also applied to the target box instead of the affected qubit row.

---

## High 5 — Qubit rows are not visibly represented

The renderer emits vertical column separators but no horizontal row separators or row background:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/canvas/Renderer.js:35-45`

The `rowSeparator` theme token is unused.

The row structure is only implied by the vertical placement of gates. This makes the editor look like floating columns rather than a qubit-row grid.

---

## High 6 — Canvas backing size and CSS size are conflated

The canvas starts with fixed intrinsic dimensions:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:43`

```html
<canvas id="circuit" width="680" height="660"></canvas>
```

On every draw, the code assigns:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:79-85`

```js
const rect = canvas.getBoundingClientRect();
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
```

There is no CSS `width`/`height` for the canvas, so the bitmap dimensions also become its intrinsic layout dimensions. On a DPR of 2, this can turn a 680×660 canvas into a 1360×1320 layout element, causing overflow and further growth on later resize events.

The correct approach is to keep CSS layout dimensions separate from backing-store dimensions.

---

## High 7 — The layout is fixed and clips on smaller viewports

The shell uses fixed dimensions:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:12`

```css
grid-template-rows: 1fr 140px;
grid-template-columns: 260px 1fr 260px;
```

Combined with a fixed 680×660 canvas and `overflow: hidden`, the editor is clipped when the viewport is narrower than roughly 1200px or shorter than the canvas plus panel chrome.

There is no:

- Media query.
- Horizontal/vertical circuit scrolling.
- Zoom.
- Pan.
- Resizable panel.
- Responsive collapse of side panels.

---

## High 8 — Dockable-panel functionality exists only as a disconnected model

`PanelModel` supports visibility and z-order:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/panels.js:113-144`

But `index.html` does not apply those values to the DOM. It imports `panelModel` and never uses it:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:60`

The canonical UI requires toggleable and draggable panels:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/SOURCE_OF_TRUTH.md:366-374`

Missing browser behavior includes:

- Collapse/expand controls.
- Panel dragging.
- Resizing.
- Docking.
- Persistence of panel layout.
- Applying `PanelModel` visibility to DOM elements.

---

## High 9 — Debugger functionality exists, but the Debugger UI does not

The underlying Debugger is substantial:

- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/debugger/Debugger.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/debugger/Timeline.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/debugger/BreakpointManager.js`

However, `DebuggerUI` is only a thin wrapper around `next()` and `seek()`:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/debugger/DebuggerUI.js:9-18`

There is no browser integration for:

- Reset.
- Previous/next step.
- Play/pause.
- Timeline slider.
- Current virtual-column display.
- Column breakpoint markers.
- Breakpoint toggles.
- Predicate breakpoint configuration.
- Run-to-breakpoint.

The Debugger imports in `main.js` are commented out:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/main.js:76-78`

---

## High 10 — AI has no UI, and its browser fallback currently crashes

The AI classes exist, but no browser controls are present and their `main.js` imports are commented out.

There is also a concrete browser-compatibility defect in:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/AIExplainer.js:202-206`

```js
process.stderr.write(...)
```

Browsers do not define `process`. A runtime probe with `process` unavailable produced:

```text
TypeError: Cannot read properties of undefined (reading 'stderr')
```

Thus, when Ollama is unavailable, the intended deterministic browser fallback fails instead of returning an explanation.

A second latent AI issue exists in:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/IOAnalyzer.js:148-157`

It calls `explainer.explain([], ...)`, but `AIExplainer.explain()` immediately returns “Empty circuit” for an empty instruction array. The causal analysis would therefore be discarded during enrichment.

---

# Medium-severity gaps

## 1 — The palette is not actually categorized in the UI

`gatesByCategory()` exists:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/editor/gatePalette.js:34-45`

but the browser simply creates one flat button grid:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html:127-133`

The category is only exposed as a tooltip. There are no Core/Extensions/Subcircuits sections.

The Subcircuits category is explicitly empty and intentionally planned:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/editor/gatePalette.test.js:67-70`

---

## 2 — Parameter and control editing have no UI

The current palette marks Rx, Ry, Rz, and Cu1 as parameterized, but placement only inserts the default `π/2` angle.

Missing:

- Angle input.
- Degrees/radians handling.
- Live parameter preview.
- Control-row selection.
- Anti-control toggle.
- SWAP second-target selection.
- Gate properties panel.

---

## 3 — Undo/redo has no browser controls

`History` is implemented and tested:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/state/History.js`

It is exported from `main.js`, but the browser never imports it and offers no undo/redo buttons or keyboard shortcuts.

---

## 4 — Measurement has no UI

The measurement engine exists:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/measurement/measurement.js`

There is no shot-count field, “sample” button, measurement result, or reset control.

---

## 5 — Accessibility is insufficient

Current gaps include:

- Canvas has no accessible label or fallback description.
- Palette buttons have no draggable semantics or keyboard placement alternative.
- No tab roles or keyboard tab navigation.
- No accessible names for future canvas controls.
- No `aria-live` region for simulation/Inspector updates.
- No clear status/error announcements.

---

# Test and documentation gaps

## Missing mirrored UI tests

The repository requires a 1:1 test mirror for each source module, but these UI-related files have no mirrored tests:

- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Inspector.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/InspectorUI.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Bloch.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Histogram.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/inspector/Purity.js`
- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/debugger/DebuggerUI.js`

Purity and Bloch have cross-validation coverage, but that is not a substitute for the required mirrored module tests.

## Existing tests do not cover browser integration

The passing UI tests validate pure data structures and theme values. There is no browser interaction test verifying:

- Palette interaction.
- Drag/drop.
- Canvas hit testing.
- Inspector updates.
- Tab switching.
- Debugger controls.
- Live JSON synchronization.
- AI fallback behavior in a browser-like environment.

## Status documentation overstates browser completion

The README marks state displays, breakpoints, and AI as done:

`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/README.md:53-70`

Those engine capabilities exist, but their browser interfaces do not. The README should distinguish “engine implemented” from “browser UI implemented.”

---

# Recommended remediation order

1. **Create the browser application state/controller layer**
   - Current circuit.
   - Current `StepTrace`.
   - History.
   - Simulation updates.
   - Change/render notifications.
   - Inspector and code-view subscriptions.

2. **Make palette placement valid**
   - Add CNOT/CZ/SWAP/Toffoli.
   - Add gate arity/control metadata.
   - Fix Cu1 construction.
   - Support controls, anti-controls, `target2`, and parameter values.
   - Connect drag, click, and keyboard placement.

3. **Repair canvas rendering before adding widgets**
   - Separate CSS and backing-store sizes.
   - Add a label gutter and row separators.
   - Correct control-line endpoints.
   - Add proper control/target symbols.
   - Render state-driven purity glow rather than “has controls” glow.

4. **Implement Inspector tabs and widgets**
   - Amplitudes/probabilities/histogram tab.
   - Shot controls.
   - Bloch tab with per-qubit subtabs and overview.
   - Live updates from `StepTrace`.

5. **Implement Debugger UI**
   - Transport controls.
   - Timeline scrubber.
   - Current-column pointer.
   - Breakpoint markers and toggles.

6. **Repair the Code & AI panel**
   - Use `Serializer.toJson()`.
   - Add an editable validated JSON view.
   - Implement the missing URL codec.
   - Add import/export/share.
   - Add AI controls and fix browser-safe fallback logging.

7. **Finish panel behavior and responsiveness**
   - Apply `PanelModel` to the DOM.
   - Add collapse/resize/drag behavior.
   - Add responsive layout and circuit scrolling/zoom.

8. **Add browser-level tests**
   - Inspector test mirrors.
   - DOM/controller integration tests.
   - Drag/drop tests.
   - Canvas visual/order tests.
   - AI browser fallback test.
   - Live JSON round-trip test.

---

## Verification performed

- Focused UI/editor/canvas/state/debugger/AI tests: **206 passed, 0 failed**.
- Full `node --test`: **703 passed, 0 failed**.
- Inline browser module syntax: valid.
- Canonical JSON mismatch reproduced.
- Browser AI fallback failure reproduced.
- Controlled-gate placement behavior reproduced.
- Working tree remained clean; no files were modified.

The highest-priority conclusion is: **do not implement the widgets independently yet**. First introduce a browser application state/controller layer and correct the renderer. Otherwise each new widget would be built on hard-coded values and disconnected models.
</details>

</details>