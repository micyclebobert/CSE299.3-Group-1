# SimQC UI Plan

> **Current tracker:** browser UI state as of commit `4dd3ef8` (`UI 2`). This file supersedes the live checklist in `docs/Plans/UI Audit Historical.md`; that document is retained unchanged as the historical audit trail. “DONE” means the implementation landed, “QA” records reviewed behavior, and “TODO” is the complete remaining UI backlog.

## DONE

### Application shell and controller

- The browser entry is now a small module script (`index.html` → `src/ui/browser-app.js`) rather than a large inline script.
- Browser behavior is split into focused UI modules for placement, canvas painting, Inspector, Debugger, Code, AI Builder, AI Explainer, I/O Analyzer, and panels.
- `AppController` owns the mutable circuit, `StepTrace`, history, Inspector, Debugger/DebuggerUI, AI Builder, I/O Analyzer, cache, shot count, selection, and pointer state.
- Undo/redo restores history snapshots without pushing a new edit or truncating the redo branch.
- Circuit edits recreate the `StepTrace`, Inspector, Debugger, and DebuggerUI state coherently.
- Canonical JSON import/export, copy, simulation/reset, and undo/redo controls are wired.

### Gate placement and renderer

- The prior `ReferenceError: n is not defined` placement crash is fixed.
- Browser pointer snapping was revised to use the renderer’s 80px column pitch and 48px row pitch; the remaining column-center offset defect is tracked under QA/TODO.
- Selected target rows are reserved before controls and second targets are allocated.
- CNOT/CZ/Toffoli/SWAP/Cu1 arity metadata is available to the controller and pure `Interaction.drop()` model.
- Renderer corrections include the label gutter, visible qubit rows, centre-aligned control lines, control dots, CNOT target symbol, SWAP connection, parameter labels, and DPR-safe canvas sizing.
- Row-level purity glow is state-driven rather than inferred from the presence of controls.

### Inspector

- The Inspector has working Amplitudes, Probabilities, and Bloch Spheres tabs.
- Amplitude and probability tables show live big-endian ket labels, real/imaginary components, probabilities, and probability bars.
- Bloch Spheres includes a register overview and per-qubit subtabs with vector magnitude and linear-entropy readouts.
- Repeated-shot sampling renders an empirical histogram chart.
- Inspector live-update registration is no longer overwritten by a no-op callback.
- All five Inspector feature modules now have 1:1 test mirrors under `test/inspector/`.

### Debugger

- `Debugger` and `DebuggerUI` are instantiated by `AppController`.
- The browser exposes Step, Run, Reset, timeline scrub, current/total step, breakpoint toggle, and Run-to-Breakpoint controls.
- `DebuggerUI` exposes transport, timeline, breakpoint, navigation, and callback state with a 1:1 test mirror.

### AI and Code/AI panel

- AI fallback logging is browser-safe.
- AI feature leaves are consumed through `src/main.js`, preserving exclusive leaf imports.
- AI Builder exposes prompt and qubit-count inputs, build status/errors, caching, generated JSON, and application of the generated circuit to the editor.
- AI Explainer reuses one explainer/cache and supplies sparse current-state grounding.
- I/O Analyzer exposes input/output rows, causal-chain output, and sparse top-k display.
- Canonical JSON is editable, importable, exportable, copyable, and shareable through the compressed URL codec.

### URL, panels, documentation, and tests

- `URLCodec` provides zero-dependency deflate-raw plus URL-safe Base64 encoding with Node-zlib interoperability tests.
- Initial `#circuit=` hash loading is implemented.
- Panel collapse/expand buttons are connected through `PanelModel` visibility state.
- README status separates engine implementation from browser UI implementation.
- Focused tests cover AppController placement/startup, Inspector leaves, Debugger UI, AI UI, URL codec, editor interaction, canvas rendering, panels, and theme behavior.

## QA

### Review outcome

**Overall browser acceptance: PARTIAL / FAIL.** The latest wave fixes the previous placement, Inspector, Debugger, AI, I/O, URL, and module-organization blockers. Core source-level workflows are substantially implemented, but the browser still has important correctness and usability gaps: placement accepts invalid coordinates, `simulate()` can leave the Debugger’s displayed step stale, Bloch/histogram canvases use CSS-variable strings that the Canvas API cannot resolve directly, the I/O cache is not state-sensitive, and no real-browser interaction suite exists.

### Latest-wave review

| Area | QA result | Evidence |
|---|---|---|
| Browser startup/module graph | **PASS at static level** | `index.html` now loads `src/ui/browser-app.js`; all UI modules pass syntax checks. No browser runtime/E2E harness is available in the repository. |
| Valid palette placement | **PASS at controller level** | H at `(0,0)` creates the expected circuit/history entry; CNOT reserves its target row; Toffoli conflicts in a two-qubit circuit. |
| Placement coordinate validation | **FAIL** | `AppController.placeGateAt()` accepts negative columns and rows beyond `numQubits`; invalid requests report success and can create inaccessible columns or out-of-range targets. |
| Pointer snapping | **PARTIAL / FAIL** | Pitch values now match the renderer, but `snapCell()` interprets its offset as a cell origin. The browser passes `colOffset: 48` (the label gutter/gate left edge), so the first gate center at `x=80` maps to column 0 only because of rounding; the midpoint between columns is also shifted by 32px. Use the gate-center origin (`labelGutter + colWidth/2 = 80`) or make the mapping formula explicitly center-based, with boundary tests. |
| Debugger transport/counter | **PARTIAL / FAIL** | Step/Run/Reset, seek, breakpoint, and run-to-breakpoint controls exist, but `AppController.simulate()` advances `_stepTrace` directly while `DebuggerUI` listens to `Debugger` callbacks; reproduction shows trace step `1` while displayed debugger step remains `0`. |
| Timeline/breakpoint presentation | **PARTIAL** | Timeline max remains `0`; no code updates it as circuit length changes. Breakpoints have controls but no canvas markers, list, active-state feedback, or persistence across circuit edits. |
| Inspector readouts | **PASS for tables** | Tabs, amplitude/probability tables, ket labels, Bloch subtabs, and entropy readouts are implemented. Inspector modules have mirrored tests. |
| Bloch/histogram canvas colors | **FAIL / VISUAL DEFECT** | `src/ui/inspector-view.js` assigns strings such as `var(--simqc-border-strong)` directly to `ctx.strokeStyle`/`ctx.fillStyle`; Canvas 2D does not resolve CSS custom-property expressions, so intended theme colors are not applied. |
| Bloch geometry | **PARTIAL** | The arrow projects only x and z and omits the y/depth component from the drawn endpoint; the displayed vector text includes y, so the visualization can misrepresent `|i>`/`|-i>` states. |
| Shot histogram | **PASS functionally / FAIL visually** | A real empirical bar chart is rendered and labels are correct, but it shares the invalid CSS-variable color issue. Sampling only occurs after “Sample,” not automatically on state changes. |
| AI Builder | **PASS** | Qubit count is editable; successful builds apply the generated circuit to the editor and update code/Inspector output. |
| AI Explainer | **PARTIAL** | One sparse summary is supplied for the entire prompt rather than one per virtual column, contrary to the sparse-per-column grounding contract. |
| I/O Analyzer | **PARTIAL / FAIL** | Changed-step alignment, sparse state, and string rendering are fixed. Its cache key omits the trace/state boundary, so analyzing before and after simulation returns the cached earlier result. |
| Canonical JSON/URL | **PASS at source level** | Canonical round-trip and URL codec tests pass; initial hash load is wired. No hash-change listener, clipboard feedback, or malformed-route browser test exists. |
| Panels/responsiveness | **PARTIAL** | Collapse buttons work, but fixed CSS grid tracks leave empty space when panels are hidden; resizing, dragging/docking, responsive reflow, zoom/pan, and layout persistence remain absent. |
| Accessibility | **FAIL / MISSING** | No ARIA tab semantics, keyboard tab navigation, canvas labels/fallbacks, keyboard placement, focus management, or `aria-live` status updates are present. |
| Feature-leaf deletability | **FAIL** | `main.js` still imports seven AI modules plus two Inspector modules and two Debugger modules; deleting a leaf requires more than the mandated two-line diff. |
| Test mirrors | **PARTIAL** | AppController and Inspector mirrors now exist. The ten new `src/ui/*-view.js` modules have no 1:1 mirrored tests, and no browser interaction suite exists. |
| Documentation/status | **PARTIAL** | README now separates engine/browser status, but several browser rows are marked “Done” despite the remaining validation, accessibility, persistence, and panel-layout gaps. |

### Verification performed for this review

- Focused UI/editor/canvas/Debugger/AI/Inspector/URL suites: **all passing**.
- Full `node --test`: **807 passed, 0 failed**.
- Placement boundary probe: **failed** (negative/out-of-range coordinates accepted).
- Debugger counter probe: **failed** after `simulate()` (trace `1`, displayed debugger step `0`).
- I/O cache probe: **failed** (post-simulation result served from the pre-simulation cache entry).

## TODO

### P0 — Correctness and mandatory contract gaps

- [ ] Correct pointer snapping to use renderer gate centers (column origin `labelGutter + colWidth/2 = 80`, row origin `rowHeight/2 = 20`) or an explicitly center-based formula; add tests for both gate centers and inter-column boundaries.
- [ ] Validate placement coordinates before editing: reject negative columns, columns beyond the insertion point, negative rows, rows `>= numQubits`, and any target/control/`target2` row outside the circuit.
- [ ] Validate `setShots()` input so non-numeric `shots` does not silently produce `NaN`; reject or clamp with visible status feedback.
- [ ] Define and test empty-column/gap semantics so dropping into column `k` creates or preserves the intended columns instead of silently appending to the end.
- [ ] Fix `_tryPlace` so targeting column `k` beyond the current length creates the intervening empty columns rather than silently appending only a single column.
- [ ] Unify the browser placement path with `Interaction.drop()` (or extract one shared placement kernel) so the controller and pure interaction model cannot drift again.
- [ ] Add a real browser/view-level placement test: select a palette gate, dispatch pointer events at a known cell, verify the resulting circuit, canvas repaint, Inspector update, code update, and undo history.
- [ ] Keep `StepTrace`, `Debugger`, and `DebuggerUI` synchronized: route `simulate()` through Debugger callbacks (or explicitly refresh DebuggerUI), and ensure current/total step, timeline value, Inspector state, and canvas purity all agree after every transport action.
- [ ] Update the timeline slider’s `max` and `value` whenever the circuit/schedule changes; reject or clamp invalid breakpoint-column input with visible status feedback.
- [ ] Preserve and visualize breakpoint state: show active breakpoints in a list and/or on the canvas, expose active/enabled state, retain breakpoints across navigation, and define whether edits preserve or clear them.
- [ ] Define the I/O Analyzer state boundary explicitly (for example, final state or user-selected virtual column), analyze that boundary, and include the boundary/state identity in the cache key so pre-simulation results cannot be served after simulation.
- [ ] Supply the AI Explainer with one sparse top-$k$ summary per virtual column, not one summary for the whole prompt; ensure cache identity also reflects the analyzed state when summaries differ by step.
- [ ] Replace CSS-variable strings in Canvas 2D style assignments with resolved theme values (`getComputedStyle()` or imported hex constants) for the Bloch sphere and histogram.
- [ ] Correct Bloch-sphere projection so all three vector components are represented; the current drawn endpoint uses only x and z and can misrepresent `|i>`/`|-i>` states.
- [ ] Bring the Inspector hierarchy in line with the canonical contract: two top-level tabs—State (amplitudes, probabilities, shot histogram) and Bloch Spheres (per-qubit subtabs plus register overview)—rather than three top-level tabs plus an external histogram.
- [ ] Add phase display to the amplitude/state readout and render an amplitude/probability chart with sufficient interactive/visual detail for the canonical Inspector.
- [ ] Render every basis outcome in the empirical histogram (including zero-count outcomes) instead of collapsing omitted states into a generic “rest” bar; apply high-DPI sizing to Inspector canvases.
- [ ] Restore optional-leaf deletability to the mandatory two-line-diff rule for `ai/`, `inspector/`, and `debugger/`; retain zero inter-feature import edges.
- [ ] Add exact 1:1 test mirrors for every new UI source module: `ai-builder-view.js`, `ai-explainer-view.js`, `browser-app.js`, `canvas-renderer.js`, `code-view.js`, `debugger-view.js`, `inspector-view.js`, `io-analyzer-view.js`, `panel-view.js`, and `placement-view.js`; add the missing `test/main.test.js` mirror as required by project convention.
- [ ] Add a real-browser or browser-DOM integration harness covering startup, palette placement, Inspector tabs/widgets, Debugger transport/timeline/breakpoints, code import/export/share, AI workflows, I/O analysis, and panel toggles.
- [ ] Enforce browser qubit limits and advisories in the UI layer: advisory for 15–20 qubits and hard refusal above 20, while retaining the Node CLI cap separately.
- [ ] Synchronize AI Builder/I/O Analyzer qubit counts and editor row count after JSON import or AI Builder application; currently these auxiliary models can retain the initial two-qubit value.
- [ ] Pass the shared `Cache` instance from `main.js` to `AIBuilderUI`/`IOAnalyzerUI` in `AppController.resetCircuit()` so auxiliary models share `app.cache` instead of constructing independent caches.
- [ ] Expose a public controller state-access API instead of browser views reading `app._stepTrace` and `app._currentCircuit` internals.

### Editor interaction and circuit-editing workflows

- [ ] Complete true palette drag-and-drop/canvas cell selection through `Interaction`; current placement is select-then-pointer rather than native palette drag and still bypasses `Interaction.drop()`.
- [ ] Add support for selecting, moving, deleting, and replacing existing gates.
- [ ] Add keyboard-accessible gate placement and editing, with a clear non-pointer alternative and visible focus/cell feedback.
- [ ] Add user workflows for positive controls, anti-controls, control count, SWAP second target, Toffoli controls, and gate parameter angles; retain automatic row allocation only as an explicit fallback.
- [ ] Add a gate-properties/parameter editor with validated radian/degree input and live preview.
- [ ] Add controls for adding/removing qubit rows and columns, with valid gate redistribution or explicit conflict behavior when row count changes.
- [ ] Add clear/new-circuit, sample reset, and other state-reset controls where currently ambiguous.
- [ ] Add conflict/error feedback for occupied rows, insufficient arity, invalid coordinates, and invalid imports rather than silently ignoring the action.

### Inspector, debugger, and visualization completeness

- [ ] Add phase display and a full state-vector text representation consistent with the committed state-display scope.
- [ ] Display single-qubit purity $\gamma_q$ and linear entropy $S_L(q)$ together in the Inspector, not only the vector length/entropy label.
- [ ] Implement the canonical interactive statevector bar chart with amplitude and probability views, labels, and clear zero-state behavior.
- [ ] Implement a density-matrix readout if it remains part of the documented browser scope, or correct the README claim that density-matrix displays are done.
- [ ] Complete semantic gate rendering: distinct CZ/Toffoli/SWAP symbols, distinct anti-control markers, and non-overlapping target symbols/text rather than generic rectangles for every operation.
- [ ] Implement canonical shot-histogram behavior under the State Inspector tab and make its state boundary explicit.
- [ ] Implement a complete register overview for the Bloch tab, not only per-row dots, while retaining the per-qubit sphere subtabs.
- [ ] Add a distinct row-level entanglement/purity glow tied to $S_L(q)$, and verify its color/alpha against the canonical entropy mapping.
- [ ] Add previous-step navigation, play/pause, and run-to-previous-breakpoint controls to complete the debugger transport.
- [ ] Add a current virtual-column marker on the circuit/timeline and breakpoint markers on the canvas.
- [ ] Make Debugger breakpoint predicate configuration available in the UI, including enable/disable and clear-all controls.
- [ ] Stop resetting `blochSubtab` to `'register'` on every Inspector re-render so a selected per-qubit subtab persists across state updates.

### Code, URL, AI, and persistence workflows

- [ ] Add URL hash-change handling so navigation to a new `#circuit=` value reloads the circuit in an already-open page.
- [ ] Replace prompt-based share/import UX with visible read-only share-URL/input fields, clipboard feedback, and non-blocking error/status messages.
- [ ] Complete JSON import/export/copy behavior: support file-picker import, downloaded canonical JSON, copy confirmation, and validation feedback on textarea edits.
- [ ] Provide the canonical exported-code view alongside canonical JSON and the compressed share URL.
- [ ] Add dedicated Code/AI subviews or tabs for Canonical JSON, Compressed Shareable URL, Exported Code, AI Explainer, AI Builder, and I/O Analyzer instead of stacking every tool in one narrow right panel.
- [ ] Persist the last circuit/layout where appropriate (for example local storage), with explicit reset and privacy/error behavior.
- [ ] Add AI Explainer state selection (final state versus a chosen virtual column) and show the summaries/context that were sent.
- [ ] Add AI Builder failure/retry feedback, model/error details, and confirmation before replacing an edited circuit.
- [ ] Add multi-row input/output selection to I/O Analyzer; the current UI exposes only one input and one output row although the contract supports selected rows.
- [ ] Ensure AI Builder and I/O Analyzer cache invalidation includes circuit/state identity and expose cache-hit/miss state to the user.
- [ ] Include the AI Builder model selection in the cache key so switching models does not serve a stale cached circuit.
- [ ] Fix AI gate-description fallback keys (`RX`/`RY`/`RZ`/`TOFFOLI` do not match registered IDs `Rx`/`Ry`/`Rz`/`Toffoli`) and correct `IOAnalyzer.enrichWithLLM()`, which currently calls `explain([])` and therefore returns “Empty circuit” instead of enriching the causal analysis.
- [ ] Add reusable circuit blocks/subcircuits and algorithm insertion workflows to the palette/editor.
- [ ] Add subcircuit expansion/collapse and breadcrumb inspection in the editor for nested circuits.

### Panels, layout, responsiveness, and accessibility

- [ ] Apply `PanelModel.getLayoutRects()` to CSS grid tracks so collapsed/hidden panels reclaim space instead of leaving fixed empty tracks.
- [ ] Add panel resizing, dragging/docking, z-order behavior, and layout persistence required by the VS Code-style shell.
- [ ] Add responsive breakpoints/mobile behavior; the current fixed 260px side panels and 150px bottom panel can clip on narrow or short viewports.
- [ ] Add circuit zoom, pan, and scroll for large grids; the canvas currently renders only the visible panel area with no navigation model.
- [ ] Add semantic accessibility: ARIA tab roles/state and keyboard tab navigation, canvas labels/fallbacks, labeled form controls, focus management, and an `aria-live` status region.
- [ ] Add pointer/touch interaction feedback: drop target highlight, ghost/preview while dragging, conflict indication, and pointer capture so dragging outside the canvas behaves predictably.
- [ ] Add visible selected-gate state and clear visual distinction between palette selection, hover, conflict, and placed gates.

### Code quality, architecture, and documentation

- [ ] Resolve remaining file-size rule violations in `src/sim/StepTrace.js` and `src/debugger/Debugger.js` (both exceed 400 lines).
- [ ] Rename the new bare-function UI modules from kebab-case to the required camelCase filenames and align each primary export with its filename; define an explicit primary export for the browser bootstrap module.
- [ ] Remove or centralize unused imports/state in UI modules (for example unused `collapse`, duplicated URL codec wiring, and module-level mutable explainer state where prohibited).
- [ ] Fix the `// ai/ (6 lines)` comment in `src/main.js:99` to match the seven imports that follow.
- [ ] Update README browser-UI status claims after browser acceptance, including Extended Gates, entanglement highlighting, JSON/URL persistence, and any feature still marked “Scaffold-only,” “Planned,” or “In progress.”
- [ ] Keep `docs/Plans/UI.md` as the single live checklist; update DONE/QA/TODO here as each wave lands and leave `docs/Plans/UI Audit Historical.md` unchanged as history.

