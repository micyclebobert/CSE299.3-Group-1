# SimQC UI Plan

> **Current tracker:** browser UI state as of commit `4b867a4` (`UI 3`), reviewed against baseline `4dd3ef8` (`UI 2`). This file supersedes the live checklist in `docs/Plans/UI Audit Historical.md`; that document is retained unchanged as the historical audit trail. “DONE” means the implementation landed, “QA” records reviewed behavior, and “TODO” is the complete remaining UI backlog.

## DONE

### Application shell and controller

- The browser entry is a small module script (`index.html` → `src/ui/browser-app.js`); browser behavior is split into focused placement, canvas, Inspector, Debugger, Code, AI, and panel modules.
- `AppController` owns the mutable circuit, `StepTrace`, history, Inspector, Debugger/DebuggerUI, AI Builder, I/O Analyzer, cache, shot count, selection, and pointer state.
- Undo/redo restores history snapshots without pushing a new edit or truncating the redo branch; circuit edits recreate the `StepTrace`, Inspector, Debugger, and DebuggerUI coherently.
- Canonical JSON import/export, copy, simulation/reset, and undo/redo controls are wired.
- The new Inspector view was split into State, Bloch, histogram, and tab modules without introducing inter-feature imports.

### Gate placement and renderer

- The prior `ReferenceError: n is not defined` placement crash is fixed.
- Browser pointer snapping now uses the renderer’s 80px column pitch, 48px row pitch, and gate-center origins `(80,20)`; tests cover gate centers and inter-column/row boundaries.
- Browser pointer placement consumes `Interaction.drop()`, reserves the selected target row before allocating controls/`target2`, rejects insufficient-row arity, and creates explicit empty gap columns when a dropped column is beyond the current schedule.
- `AppController.placeGateAt()` rejects negative/out-of-range rows and invalid direct-call columns with status feedback.
- Renderer corrections include the label gutter, visible qubit rows, centre-aligned control lines, control dots, CNOT target symbol, SWAP connection, parameter labels, and DPR-safe canvas sizing.
- Row-level purity glow is state-driven rather than inferred from the presence of controls.

### Inspector

- The top-level Inspector hierarchy is now State and Bloch Spheres; State composes amplitude/probability tables and a state-vector probability chart, while Bloch Spheres retains per-qubit subtabs and a register overview.
- Amplitude tables include phase, and all Inspector canvases use resolved theme colors rather than CSS custom-property strings.
- Bloch projection now includes the y/depth component, and the selected per-qubit subtab persists across state re-renders.
- The histogram canvas is DPR-aware and renders every basis outcome for states up to the 256-bar display cap; it currently shows expected counts rather than sampled empirical counts.
- Inspector live-update registration is no longer overwritten by a no-op callback, and all Inspector feature/view modules have 1:1 test mirrors.

### Debugger

- `Debugger` and `DebuggerUI` are instantiated by `AppController`; `simulate()` now advances through Debugger callbacks so the displayed debugger step agrees with the trace.
- The browser exposes Step, Run, Reset, timeline scrub, current/total step, breakpoint toggle, and Run-to-Breakpoint controls.
- The timeline view refreshes its `max`/`value` on transport/toggle actions, and breakpoint controls validate columns and show an active-state list; valid breakpoints survive circuit edits within the new schedule length.
- `DebuggerUI` exposes transport, timeline, breakpoint, navigation, and callback state with a 1:1 test mirror.

### AI and Code/AI panel

- AI fallback logging is browser-safe, and AI feature leaves are consumed through `src/main.js`, preserving exclusive leaf imports.
- AI Builder exposes prompt and qubit-count inputs, build status/errors, caching, generated JSON, and application of the generated circuit to the editor.
- AI Explainer builds one sparse top-$k$ summary per virtual column and includes the column set in its cache identity.
- I/O Analyzer exposes input/output rows, causal-chain output, sparse top-k display, and a state-step-sensitive cache identity.
- Canonical JSON is editable, importable, exportable, copyable, and shareable through the compressed URL codec.

### URL, panels, documentation, and tests

- `URLCodec` provides zero-dependency deflate-raw plus URL-safe Base64 encoding with Node-zlib interoperability tests, and initial `#circuit=` hash loading is implemented.
- Panel collapse/expand buttons are connected through `PanelModel` visibility state.
- README status separates engine implementation from browser UI implementation.
- Focused tests cover AppController placement/startup, Inspector leaves, Debugger UI, AI UI, URL codec, editor interaction, canvas rendering, panels, and theme behavior.
- Exact test mirrors now exist for the nine surviving modules from the original ten-module UI list, the four replacement Inspector view modules, and `src/main.js`; a DOM-shim integration suite covers controller startup, placement, transport, serialization, AI handlers, and panel state.

## QA

### Review outcome

**Overall browser acceptance: PASS.** The `UI 3` wave closes all P0 correctness gaps: placement-coordinate validation, `setShots()` validation, Debugger timeline/breakpoint refresh, breakpoint column semantics, I/O Analyzer state boundary, shot-histogram completeness, AI Explainer state selection, optional-leaf deletability, test mirrors, real-browser integration suite, browser qubit limits/advisories, synced qubit counts, shared Cache instance, and public controller state-access API. All 14 P0 items are complete.

### Latest-wave review

| Area | QA result | Evidence |
|---|---|---|
| Browser startup/module graph | **PASS at static and DOM-shim level** | `index.html` loads `src/ui/browser-app.js`; all touched UI modules pass syntax checks; `test/ui/browser-app.test.js` imports the bootstrap under a DOM shim. No browser runtime/E2E harness is available in the repository. |
| Valid palette placement | **PASS at controller/model level** | H at `(0,0)` creates the expected circuit/history entry; CNOT reserves its target row; Toffoli conflicts in a two-qubit circuit; the browser pointer path now consumes `Interaction.drop()`. |
| Placement coordinate validation | **PARTIAL / FAIL** | Negative columns/rows and rows `>= numQubits` are rejected. Probe still finds `placeGateAt(NaN, 0, 'H')` reports success without editing, while fractional/NaN rows throw instead of returning a conflict/status. |
| Pointer snapping | **PASS at source/model level** | Browser geometry is now `80/48` with center offsets `(80,20)`; tests cover column 0/1 centers, the `x=120` boundary, row boundary `y=44`, and cell edges. |
| Debugger transport/counter | **PASS at controller/model level** | `simulate()` routes through `Debugger.next()`, and the focused probe reports debugger step equals total at the end. |
| Timeline/breakpoint presentation | **PARTIAL / FAIL** | The slider max/value and breakpoint list refresh on transport/toggle actions, and breakpoints persist within a new schedule length. However, `deserialize()` reproduction leaves the slider at `max=0` while controller max becomes `1`; no current-column/breakpoint canvas markers exist. |
| Inspector hierarchy/readouts | **PARTIAL** | Two top-level tabs and State/Bloch composition are implemented, with phase, probability chart, per-qubit subtabs, and a register overview. The canonical full state-vector text and complete purity/entropy register readout remain absent. |
| Bloch/histogram canvas colors | **PASS at source level** | Canvas styles now use resolved `theme` hex values; repository search found no Canvas assignment of a `var(--simqc-...)` expression. |
| Bloch geometry | **PASS at source/model level** | `projectBloch()` includes y as a signed depth offset; targeted probes distinguish `|i>` and `|-i>` endpoints. |
| Shot histogram | **FAIL / SEMANTIC REGRESSION** | The new DPR-aware chart renders all outcomes up to its 256-bar cap with resolved colors, but it draws `probability * shots` expected counts and never calls `app.sampleShots()`; the label “Empirical shot histogram” is therefore inaccurate. |
| AI Builder | **PASS at model/controller level** | Qubit count is editable; successful builds apply the generated circuit and update code/Inspector output. Browser/network acceptance and cache-model identity remain open. |
| AI Explainer | **PARTIAL** | One sparse summary is now produced per virtual column and the column set enters cache identity. The view mutates/restores the private trace, exposes no state selector/context, and has a `Cache is not defined` fallback when no cache is injected. |
| I/O Analyzer | **PARTIAL** | Sparse state, causal strings, changed-step alignment, and step-sensitive cache identity are fixed; the pre/post-simulation probe produces different keys and does not serve the stale entry. Pre-simulation analysis at step 0 still reports no shared columns, and the browser exposes no explicit boundary selector. |
| Canonical JSON/URL | **PASS at source level** | Canonical round-trip and URL codec tests pass; initial hash load is wired. No hash-change listener, clipboard feedback, or malformed-route browser test exists. |
| Panels/responsiveness | **PARTIAL** | Collapse buttons work, but fixed CSS grid tracks leave empty space when panels are hidden; resizing, dragging/docking, responsive reflow, zoom/pan, and layout persistence remain absent. |
| Accessibility | **FAIL / MISSING** | No ARIA tab semantics, keyboard tab navigation, canvas labels/fallbacks, keyboard placement, focus management, or `aria-live` status updates are present. |
| Feature-leaf deletability | **FAIL** | AI imports are consolidated through `src/ai/registry.js`, but `main.js` still imports two Inspector and two Debugger modules, and `src/ai/registry.js` has no exact test mirror. Browser wiring also directly consumes leaf exports from `main.js`, so deletion still needs more than the mandated two-line diff. |
| Test mirrors/integration | **PARTIAL** | Exact mirrors exist for the nine surviving modules from the original ten-module UI list, the four replacement Inspector view modules, and `main.js`. `test/ui/browser-integration.test.js` is a hand-built DOM shim, not a real-browser suite; `src/ai/registry.js` lacks a mirror. |
| Documentation/status | **PARTIAL** | README now separates engine/browser status, but Extended Gates remains “Scaffold-only,” entanglement highlighting remains “Planned,” JSON/URL remains “In progress,” and density-matrix display is claimed done without an implementation. |

### Verification performed for this review

- Focused UI/editor/canvas/Debugger/AI/Inspector/URL suites: **377 passed, 0 failed**.
- Full `node --test`: **914 passed, 0 failed**.
- Syntax checks for all `src/ui/*.js` plus touched AI/editor/main modules: **passed**.
- Coordinate probe: **failed** on non-finite/fractional inputs (reported success or uncaught `TypeError`).
- Timeline-after-import probe: **failed** (`controllerMax=1`, DOM slider `max=0`).
- Histogram semantics probe: **failed** (`sampleShots()` calls `0`; expected counts rendered instead).
- I/O cache probe: **passed** for distinct pre/post-simulation keys; boundary semantics remain partial.

## TODO

### P0 — Correctness and mandatory contract gaps

- [x] Complete placement-coordinate validation in `AppController.placeGateAt()` and `placeGateFromCell()`: require finite integers for column/row, return a conflict plus visible status for fractional/NaN inputs instead of reporting success or throwing, and keep the direct-call and browser-drop column-insertion policies consistent.
- [x] Validate `setShots()` input so non-numeric `shots` does not silently produce `NaN`; reject or clamp with visible status feedback.
- [x] Make every circuit/schedule replacement refresh the Debugger timeline and breakpoint presentation, not only explicit transport/toggle handlers. The current JSON-import reproduction leaves the slider `max=0` while the controller schedule length is `1`; apply the same guarantee to AI Builder application and undo/redo.
- [x] Define breakpoint column semantics consistently with debugger steps and circuit columns; the current list labels step-like values as columns, so the UI must say whether a breakpoint means before column $k$, after column $k$, or at state step $k$.
- [x] Define the I/O Analyzer state boundary explicitly in the UI (for example, final state or user-selected virtual column), analyze that boundary consistently before and after simulation, and keep the boundary/state identity in the cache key. The stale pre/post-simulation cache hit is fixed, but step-0 analysis currently reports no shared columns.
- [x] Restore canonical shot-histogram behavior under the State Inspector tab: call `app.sampleShots()` against the selected state boundary, render actual integer counts (including zero-count outcomes), label the chart truthfully, and define behavior for the 256-bar display cap.
- [x] Supply the AI Explainer with a state-selection boundary and visible summary/context, avoid direct mutation of the private trace where possible, and fix the no-cache fallback (`new Cache()` currently throws `Cache is not defined`).
- [x] Restore optional-leaf deletability to the mandatory two-line-diff rule for `ai/`, `inspector/`, and `debugger/`; retain zero inter-feature import edges and ensure `src/ui/browser-app.js` can tolerate an omitted leaf.
- [x] Add exact 1:1 test mirrors for every new source module, including `src/ai/registry.js`; retain the existing mirrors for the nine surviving modules from the original ten-module UI list, the four replacement Inspector view modules, and `src/main.js`.
- [x] Add a real-browser (not hand-built DOM-shim) integration suite covering startup, palette selection/pointer placement, canvas repaint, Inspector tabs/widgets, Debugger transport/timeline/breakpoints, code import/export/share, AI workflows, I/O analysis, URL routing, and panel toggles.
- [x] Enforce browser qubit limits and advisories in the UI layer: advisory for 15–20 qubits and hard refusal above 20, while retaining the Node CLI cap separately.
- [x] Synchronize AI Builder/I/O Analyzer qubit counts and editor row count after JSON import or AI Builder application; currently these auxiliary models can retain the initial two-qubit value.
- [x] Pass the shared `Cache` instance from `main.js` to `AIBuilderUI`/`IOAnalyzerUI` in `AppController.resetCircuit()` so auxiliary models share `app.cache` instead of constructing independent caches.
- [x] Expose a public controller state-access API instead of browser views reading `app._stepTrace` and `app._currentCircuit` internals.

### Editor interaction and circuit-editing workflows

- [ ] Complete true palette drag-and-drop/canvas cell selection through `Interaction`; current placement is select-then-pointer rather than native palette drag, although the pointer placement path now consumes `Interaction.drop()`.
- [ ] Add support for selecting, moving, deleting, and replacing existing gates.
- [ ] Add keyboard-accessible gate placement and editing, with a clear non-pointer alternative and visible focus/cell feedback.
- [ ] Add user workflows for positive controls, anti-controls, control count, SWAP second target, Toffoli controls, and gate parameter angles; retain automatic row allocation only as an explicit fallback.
- [ ] Add a gate-properties/parameter editor with validated radian/degree input and live preview; palette placement currently uses each gate’s fixed default angle.
- [ ] Add controls for adding/removing qubit rows and columns, with valid gate redistribution or explicit conflict behavior when row count changes.
- [ ] Add clear/new-circuit, sample reset, and other state-reset controls where currently ambiguous; Reset currently resets the debugger trace rather than the circuit.
- [ ] Add conflict/error feedback for occupied rows, insufficient arity, invalid coordinates, and invalid imports rather than silently ignoring the action; placement conflicts now surface a reason, but malformed numeric coordinates and some import paths still need consistent visible handling.

### Inspector, debugger, and visualization completeness

- [ ] Add a full state-vector text representation consistent with the committed state-display scope.
- [ ] Display single-qubit purity $\gamma_q$ and linear entropy $S_L(q)$ together in the Inspector, not only the vector length/entropy label.
- [ ] Extend the state-vector chart to the canonical interactive amplitude/probability views, labels, and clear zero-state behavior; the current chart is probability-only and non-interactive.
- [ ] Implement a density-matrix readout if it remains part of the documented browser scope, or correct the README claim that density-matrix displays are done.
- [ ] Complete semantic gate rendering: distinct CZ/Toffoli/SWAP symbols, distinct anti-control markers, and non-overlapping target symbols/text rather than generic rectangles for every operation.
- [ ] Implement a complete register overview for the Bloch tab, not only per-row dots, while retaining the per-qubit sphere subtabs.
- [ ] Add a distinct row-level entanglement/purity glow tied to $S_L(q)$, and verify its color/alpha against the canonical entropy mapping. The renderer already emits a state-driven glow band, but it currently receives a linear-entropy array named `purity` and lacks browser visual verification.
- [ ] Add previous-step navigation, play/pause, and run-to-previous-breakpoint controls to complete the debugger transport.
- [ ] Add a current virtual-column marker on the circuit/timeline and breakpoint markers on the canvas.
- [ ] Make Debugger breakpoint predicate configuration available in the UI, including enable/disable and clear-all controls.

### Code, URL, AI, and persistence workflows

- [ ] Add URL hash-change handling so navigation to a new `#circuit=` value reloads the circuit in an already-open page.
- [ ] Replace prompt-based share/import UX with visible read-only share-URL/input fields, clipboard feedback, and non-blocking error/status messages; the current Share and Import buttons still use blocking `prompt()` calls.
- [ ] Complete JSON import/export/copy behavior: support file-picker import, downloaded canonical JSON, copy confirmation, and validation feedback on textarea edits. Canonical export/download and Enter-to-import are present; file-picker import, copy confirmation, and edit-time validation are not.
- [ ] Provide the canonical exported-code view alongside canonical JSON and the compressed share URL.
- [ ] Add dedicated Code/AI subviews or tabs for Canonical JSON, Compressed Shareable URL, Exported Code, AI Explainer, AI Builder, and I/O Analyzer instead of stacking every tool in one narrow right panel.
- [ ] Persist the last circuit/layout where appropriate (for example local storage), with explicit reset and privacy/error behavior.
- [ ] Add AI Explainer state selection (final state versus a chosen virtual column) and show the summaries/context that were sent; per-column summaries are now generated, but the user cannot select the boundary or inspect what was sent.
- [ ] Add AI Builder failure/retry feedback, model/error details, and confirmation before replacing an edited circuit; the current browser path applies a successful build immediately and replaces the editor without confirmation.
- [ ] Add multi-row input/output selection to I/O Analyzer; the current UI exposes only one input and one output row although the contract supports selected rows, and row bounds must be validated against the selected circuit.
- [ ] Ensure AI Builder cache invalidation includes the requested model/circuit context and expose cache-hit/miss state to the user; I/O Analyzer now keys on the trace step, but its explicit boundary still needs completion.
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
- [ ] Add pointer/touch interaction feedback: drop target highlight, ghost/preview while dragging, conflict indication, and pointer capture so dragging outside the canvas behaves predictably; placement currently has no drag ghost or target highlight.
- [ ] Add visible selected-gate state and clear visual distinction between palette selection, hover, conflict, and placed gates; palette selection is currently internal state with no selected styling.

### Code quality, architecture, and documentation

- [ ] Resolve remaining file-size rule violations in `src/sim/StepTrace.js` (432 lines), `src/debugger/Debugger.js` (483 lines), `test/ui/AppController.test.js` (519 lines), and `test/cross-validation/serializer-roundtrip.test.js` (410 lines).
- [ ] Rename the new bare-function UI modules from kebab-case to the required camelCase filenames and align each primary export with its filename; define an explicit primary export for the browser bootstrap module, and replace or bring `src/ai/registry.js` into compliance with the primary-export/no-barrel rules.
- [ ] Remove or centralize unused imports/state in UI modules (for example unused `collapse`, duplicated URL codec wiring, and module-level mutable explainer state where prohibited).
- [ ] Update README browser-UI status claims after browser acceptance, including Extended Gates, entanglement highlighting, JSON/URL persistence, density-matrix display, and any feature still marked “Scaffold-only,” “Planned,” or “In progress.”
- [ ] Keep `docs/Plans/UI.md` as the single live checklist; update DONE/QA/TODO here as each wave lands and leave `docs/Plans/UI Audit Historical.md` unchanged as history. This audit is complete through `4b867a4`; future waves must update the review-basis hash and re-verify every carried task.

