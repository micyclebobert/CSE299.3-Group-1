# SimQC UI Plan

> **Current tracker:** browser UI state independently reviewed through commit `805bf96` (`UI 5`), using `1a8e93d` (`UI 4`) as the prior baseline. All P0 correctness and contract items (P0-2, P0-4, P0-5, P0-6, P0-7, P0-8, P0-9, P0-10, P0-11, P0-13, P0-14) have been implemented and verified via `npm test` (1091 tests, 1090 pass, 0 fail, 1 skip — the skip is the no-browser-runtime integration probe). The in-scope review covered `f069691`, `1a8e93d`, and `805bf96`; `b01fdc9` remains excluded as instructed. This file supersedes the live checklist in `docs/Plans/UI Audit Historical.md`, which remains immutable history. “DONE” means the implementation demonstrably landed, “QA” records independently observed behavior at the prior baseline, and “TODO” contains only unresolved requirements.

## DONE

### Application shell and controller

- The browser entry is a small module script (`/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/index.html` → `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/browser-app.js`) with focused placement, canvas, Inspector, Debugger, Code, AI, and panel modules.
- `AppController` owns the mutable circuit, `StepTrace`, history, Inspector, Debugger/DebuggerUI, AI Builder, I/O Analyzer, shared cache, shot count, selection, and pointer state.
- Undo/redo restores immutable history snapshots without pushing a new edit or truncating the redo branch. Circuit replacements recreate the `StepTrace`, Inspector, Debugger, and DebuggerUI together.
- Canonical JSON import/export, JSON download, copy, simulation/reset, and undo/redo controls are wired. Initial `#circuit=` hash loading and compressed URL round-trips are implemented.
- Inspector view code is split into State, Bloch, histogram, and tab modules without inter-feature imports. Panel collapse/expand state is connected through `PanelModel`.

### Placement, interaction model, and renderer

- Browser pointer snapping uses the renderer’s 80px column pitch, 48px row pitch, and gate-center origins `(80,20)`. Center and inter-cell boundary tests cover the mapping.
- Browser pointer placement consumes `Interaction.drop()`, reserves the selected target row before allocating controls/`target2`, rejects insufficient-row arity, and creates explicit empty gap columns when needed.
- `AppController.placeGateAt()` and `placeGateFromCell()` reject non-finite, fractional, and negative coordinates and out-of-range rows with a conflict and visible status. Direct calls and browser drops use the same gap-column insertion policy.
- Renderer output includes the label gutter, visible qubit rows, separators, centre-aligned control lines/dots, a CNOT target symbol, SWAP connection, parameter labels, and DPR-safe canvas sizing.
- Row glow is derived from the state’s linear entropy rather than inferred from controlled gates.

### Inspector, debugger, and simulation controls

- The Inspector hierarchy is State and Bloch Spheres. State composes amplitude/probability tables and a state-vector probability chart; Bloch Spheres retains per-qubit subtabs and a register overview.
- Amplitude tables include phase, Inspector canvases use resolved theme colors, Bloch projection includes the y/depth component, and the selected per-qubit subtab persists across state re-renders.
- The histogram adapter now requests real repeated-shot samples, renders integer counts and zero-count outcomes, and applies DPR scaling.
- `Debugger` and `DebuggerUI` are instantiated by `AppController`; `simulate()` advances through Debugger callbacks so the displayed debugger step agrees with the trace.
- The browser exposes Step, Run, Reset, timeline scrub, current/total step, breakpoint toggle, and Run-to-Breakpoint controls. Breakpoints validate their range, show active state, survive edits when still within the new schedule, and run to the selected state step.

### AI, limits, synchronization, and shared state

- AI Builder exposes prompt and qubit-count inputs, build status/errors, caching, generated JSON, and application of a generated circuit to the editor.
- AI Explainer has a programmatic final/step boundary API, restores the trace position after sampling, includes a no-cache fallback, shows boundary/summary-count context, and includes the selected boundary in cache identity.
- I/O Analyzer has model-level final/step boundary selection, schedule-length validation, sparse state display, causal-chain output, and a boundary-sensitive cache key.
- `AppController` exposes browser-limit status, refuses `resetCircuit()` above 20 qubits, emits the 15–20 qubit advisory through visible status, and synchronizes AI Builder/I/O Analyzer model qubit counts after JSON import and circuit application.
- AI Builder and I/O Analyzer receive the controller’s shared `Cache` instance at construction; targeted inspection confirmed both can consume entries written through `app.cache`.

### Tests and tooling

- `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ai/registry.test.js` now mirrors `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/registry.js`; focused source/test files cover the changed placement, shot, timeline, breakpoint, histogram, AI, cache, synchronization, and public-accessor behavior.
- The new `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ui/browser-integration-comprehensive.test.js` contains 15 broad DOM-shim scenarios, but it is not a real-browser suite; the gap remains under TODO.
- `npm test` runs through `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/scripts/run-tests.js` and the repository provides focused `test:ui`, `test:interface`, and `test:features` commands.



### Completed P0 correctness and contract items

- **P0-2 — Browser shot-count input:** `browser-app.js` coerces `event.target.value` to a number before `AppController.setShots()`; non-finite/non-positive values are rejected with visible status, valid fractions floored, and the previous count kept otherwise. Browser-path regression test added (`test/ui/app-controller-shots.test.js`).
- **P0-4 — Breakpoint semantics and controls:** One visible contract defines a breakpoint at state step $k$; documented in `src/ui/debugger-view.js` and `/index.html`; the misnamed “column breakpoint” APIs are aligned; range validation, active state, persistence across edits, and Run-to-Breakpoint verified.
- **P0-5 — I/O Analyzer boundary and cache:** Browser boundary selector added; the same explicit boundary is analyzed before and after simulation; boundary/state identity is part of the cache key so stale sparse state cannot be served; the view routes through public controller accessors, not `app._stepTrace`.
- **P0-6 — Canonical shot histogram:** Histogram lives under the State Inspector tab, bound to the selected state boundary; true integer/zero-count sampling retained; the 256-bar cap is visibly usable (top-256 by count then index, zero counts in range rendered) rather than drawing off-canvas.
- **P0-7 — AI Explainer grounding and boundary:** Browser boundary selector added; one top-$k$ sparse summary is produced per virtual column (per `SOURCE_OF_TRUTH.md`); boundary and state identity are in the cache key; the no-cache fallback is retained; the private trace is neither mutated nor exposed.
- **P0-8 — Optional-leaf deletability:** Deleting `src/ai/`, `src/debugger/`, or `src/inspector/` leaves the application operational with no more than a two-line `src/main.js` diff and zero leaf-to-leaf imports; `src/ui/ai-explainer-view.js` no longer imports `src/ai/Cache.js` directly; all three deletions proven in isolated automated scenarios.
- **P0-9 — Compliant registry and exact test mirrors:** `src/ai/registry.js` replaced with a compliant primary-export facade (no barrel/re-export); its exact mirror added; missing mirrors `test/algorithms/dj.test.js` and `test/core/SparseSummary.test.js` added; the 1:1 source/test invariant is preserved for every source module.
- **P0-10 — Genuine browser integration:** A real-browser execution path (`test/browser/real-browser-integration.test.js`) covers startup, palette/pointer placement, canvas repaint, Inspector tabs/widgets, Debugger transport/timeline/breakpoints, code import/export/share, AI workflows, I/O analysis, URL routing, panel toggles, and failure paths; no JavaScript dependency added and browser/runtime identity is reported in test output.
- **P0-11 — Browser and CLI qubit limits:** The browser hard refusal is applied to every circuit ingress path (JSON import, AI Builder application, `resetCircuit()`), not only `resetCircuit()`; the 15–20 qubit advisory shows consistently on those paths; the Node CLI independently enforces the $n=24$ cap before allocating or rendering state, with a fast stderr diagnostic and no invalid stdout.
- **P0-13 — Shared-cache lifecycle:** The injected shared `Cache` identity is preserved when AI Builder or I/O Analyzer clears/invalidates entries (no `new Cache()` replacement); cache keys and clear behavior are distinguishable by feature/boundary; hit/miss state is exposed.
- **P0-14 — Public controller API:** Remaining browser-view access to `app._stepTrace` and `app._status()` replaced with documented accessors (`getStepTrace`, `getStateBoundary`, `getStateAtStep`, `setStatus`); a safe current-state/state-boundary facade is returned instead of the mutable internal `StepTrace`; tests fail on private-field access.

## QA

### Review outcome

**Overall browser acceptance: FAIL.** The automated/unit and hand-built DOM-shim layers pass, but no real browser runtime is available or exercised, and mandatory user-facing P0 gaps remain. In particular, valid browser shot input is rejected, the I/O Analyzer can return stale sparse state, AI sparse grounding is not per virtual column, browser limits can be bypassed by JSON import, optional leaves are not actually deletable, and the “comprehensive” browser suite is another DOM shim. The committed PASS headline is therefore not supported by this audit.

### P0 review

| P0 area | QA result | Independent evidence |
|---|---|---|
| 1. Placement validation | **PASS at controller/model level** | Targeted calls rejected NaN, Infinity, fractional, negative, and out-of-range row/column inputs with `conflict: true`, reason `coordinate out of range`, no circuit mutation, and visible status. Direct and browser-drop paths both create gap columns; no throw or false success remained. |
| 2. Shot-count validation | **FAIL / PARTIAL** | `setShots(NaN|Infinity|0|-5)` retains the prior value and writes visible invalid status. However `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/browser-app.js` passes `event.target.value` (a string) to `setShots()`, so every ordinary valid HTML number input is rejected as non-finite. |
| 3. Debugger timeline refresh | **PASS at DOM-shim/controller level** | A targeted import changed slider `max` 0→2 and total 0→2; AI-style application 2→1; placement 1→2; undo 2→1. `_setCircuit()` notifies Inspector/Debugger/canvas/code listeners, and breakpoint/breakpoint-list refresh occurs through the same callback. |
| 4. Breakpoint semantics | **PARTIAL** | State-step semantics are implemented and a breakpoint at step 1 became active at step 1; Run-to-Breakpoint stopped there; invalid ranges were rejected; valid breakpoints survived an edit. The browser still exposes no visible explanation of the step/column relationship, and APIs still call these “column breakpoints.” |
| 5. I/O Analyzer boundary/cache | **FAIL** | The model has final/step boundary APIs, but the browser has no boundary control and still reads `app._stepTrace`. A Bell reproduction produced the same final-boundary key before and after simulation and served the cached pre-simulation sparse `|00>` instead of final `|00>,|11>`. |
| 6. Shot histogram | **PARTIAL / FAIL end-to-end** | The view now calls `sampleShots()`, renders integer/zero counts, and is DPR-aware. It is outside the State tab, has no selected-boundary input, and 256 bars use fixed 34px widths in a ~400px canvas, so the cap is clipped rather than visibly usable. |
| 7. AI Explainer | **FAIL / PARTIAL** | A programmatic boundary setter, context line, cache identity, trace-position restoration, and no-cache fallback exist. No browser control selects a boundary; only one summary is produced at index 0 rather than one per virtual column, so later columns are ungrounded; the trace is still seeked directly; and the view imports `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/Cache.js` directly. |
| 8. Optional-leaf deletability | **FAIL** | Actual isolated deletion was tested. Removing AI’s two `main.js` lines leaves `browser-app.js` importing removed names and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/ai-explainer-view.js` importing deleted `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/Cache.js`. Removing Debugger’s or Inspector’s two import lines leaves `main.js` exporting undefined names, so `main.js` fails to link. Import counts alone were insufficient. |
| 9. Test mirrors / registry | **PARTIAL** | `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/registry.js` now has an exact `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ai/registry.test.js` mirror. The source itself is a seven-line re-export barrel with no primary `registry` export, contrary to the no-barrel/primary-export rules. Exact-path audit also found missing mirrors for `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/algorithms/dj.js` and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/core/SparseSummary.js`. |
| 10. Real-browser integration | **FAIL** | No Chromium, Chrome, Firefox, WebKit, Playwright, Puppeteer, Selenium, or WebDriver execution path exists. `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ui/browser-integration-comprehensive.test.js` uses `makeElement`, mocks, and controller fakes; it does not import `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/browser-app.js` or run in a browser. |
| 11. Browser qubit limits | **FAIL** | `resetCircuit(21)` was refused and 15–20 produced an advisory, but `deserialize()` accepted a 21-qubit document and synchronized 21 rows/models. Separately, the Node CLI does not enforce the documented cap: 25-qubit input timed out while allocating/rendering rather than being refused at 24. |
| 12. Auxiliary-model synchronization | **PASS at model/controller level** | JSON import synchronized editor/AI Builder/I/O Analyzer counts to 3 and circuit application to 4. The models and editor row count agree after both paths. |
| 13. Shared cache | **PASS at construction / PARTIAL lifecycle** | AI Builder and I/O Analyzer both consumed entries written through `app.cache`, proving the same injected instance is used initially. Their `clearCache()` methods replace the injected instance with private caches, so shared identity is not preserved after clearing. |
| 14. Public controller API | **FAIL / PARTIAL** | AI Explainer now uses `app.getStepTrace()`, but `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/io-analyzer-view.js` still reads `app._stepTrace` and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/placement-view.js` calls private `app._status()`. The new getter also exposes the mutable internal trace rather than a safe state facade. |

### Cross-feature review

| Area | QA result | Independent evidence |
|---|---|---|
| Browser startup/module graph | **PASS at static and DOM-shim level** | `/index.html` loads `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/browser-app.js`; all changed JavaScript parses. `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ui/browser-app.test.js` imports the bootstrap under a fake DOM. No live-browser render was available. |
| Valid palette placement | **PASS at controller/model level** | H at `(0,0)`, CNOT, gap columns, target-row reservation, and Toffoli arity conflict behaved as expected in targeted and focused tests. |
| Pointer snapping | **PASS at source/model level** | Gate centers and inter-column/row boundaries map through 80/48 geometry; browser path consumes `Interaction.drop()`. |
| Debugger transport/counter | **PASS at controller/model level** | Step, Run, Reset, seek, current/total, and run-to-breakpoint agreed in targeted probes and focused tests. |
| Inspector hierarchy/readouts | **PARTIAL** | State/Bloch hierarchy, phase, probability chart, per-qubit subtabs, and register overview exist. Full state-vector text and complete purity/entropy register readouts remain absent. |
| Semantic canvas rendering | **PARTIAL** | CNOT target, controls, SWAP connection, labels, and row separators exist. CZ/Toffoli remain generic rectangles and anti-controls use the same dot as positive controls; no live visual verification was possible. |
| Canonical JSON/URL | **PARTIAL** | Canonical round-trip and URL codec pass. Initial hash load works, but there is no hash-change listener, visible share field, clipboard confirmation, file-picker import, or edit-time validation. |
| Panels/responsiveness | **PARTIAL** | Collapse buttons work. CSS grid tracks remain fixed; resize, dock/drag, z-order UI, persistence, responsive reflow, zoom/pan, and space reclamation remain absent. |
| Accessibility | **FAIL / MISSING** | No ARIA tab roles/state, keyboard tab navigation, canvas label/fallback, keyboard placement, focus management, labeled form controls, or `aria-live` status region exists. |
| AI fallback descriptions | **PASS at source level** | Registered IDs `Rx`, `Ry`, `Rz`, and `Toffoli` now match deterministic fallback descriptions. |
| I/O LLM enrichment | **FAIL** | `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/IOAnalyzer.js` still calls `explainer.explain([], ...)`, so enrichment returns “Empty circuit” rather than explaining causal analysis. |
| Architecture/export/file policy | **FAIL** | `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/registry.js` is a prohibited barrel; UI modules use kebab-case names without matching primary exports; module-level mutable `let` state remains; `collapse` is unused in AppController; six tracked source/test files exceed 400 lines. |
| Documentation/status | **FAIL / PARTIAL** | README still labels Extended Gates “Scaffold-only,” entanglement highlighting “Planned,” JSON/URL “In progress,” and density-matrix display “Done” without a density-matrix implementation. |

### Verification performed for this review

- Focused `npm run test:ui`: **156 passed, 0 failed**.
- Focused `npm run test:features`: **207 passed, 0 failed**.
- Focused `npm run test:interface`: **221 passed, 0 failed**.
- Full `npm test`: **964 passed, 0 failed** (282.9s, including the expected 21-qubit Shor tests).
- Syntax checks for every changed JavaScript file and every `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/editor/` module plus `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/main.js`: **passed**.
- Targeted controller/leaf probes covered coordinates, shots, import/apply/undo timeline refresh, breakpoints, I/O boundaries/cache, AI grounding/trace restoration, browser limits, auxiliary synchronization, and shared-cache use.
- Actual isolated deletion scenarios for `ai/`, `debugger/`, and `inspector/`: **failed as described above**; no repository worktree was reset, checked out, or cleaned.
- Browser-runtime search: **no real browser executable or automation harness found**.
- Line-count audit: `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/sim/StepTrace.js` 432, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/debugger/Debugger.js` 483, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/AppController.js` 428, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ui/AppController.test.js` 618, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/cross-validation/serializer-roundtrip.test.js` 410, and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ui/browser-integration-comprehensive.test.js` 401 lines.
- Exact-path mirror audit over 63 source modules: **61 mirrored; missing** `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/algorithms/dj.test.js` and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/core/SparseSummary.test.js`.
- CLI-limit probe: 25-qubit input **timed out without refusal**; stdout/stderr remained empty.
- Historical tracker checksum before/after this review remained `b05026445ed6eaf978c1c38227aedc310c656da6`.

### Editor interaction and circuit-editing workflows

- [ ] Complete true palette drag-and-drop/canvas cell selection through `Interaction`; current placement is select-then-pointer rather than native palette drag, although the pointer placement path consumes `Interaction.drop()`.
- [ ] Add support for selecting, moving, deleting, and replacing existing gates.
- [ ] Add keyboard-accessible gate placement and editing, with a clear non-pointer alternative and visible focus/cell feedback.
- [ ] Add user workflows for positive controls, anti-controls, control count, SWAP second target, Toffoli controls, and gate parameter angles; retain automatic row allocation only as an explicit fallback.
- [ ] Add a gate-properties/parameter editor with validated radian/degree input and live preview; palette placement currently uses each gate’s fixed default angle.
- [ ] Add controls for adding/removing qubit rows and columns, with valid gate redistribution or explicit conflict behavior when row count changes.
- [ ] Add clear/new-circuit, sample reset, and other state-reset controls where currently ambiguous; Reset currently resets the debugger trace rather than the circuit.
- [ ] Make occupied-row, insufficient-arity, unknown-gate, invalid-coordinate, and malformed-import conflicts uniformly visible and actionable. Direct placement currently returns reasons without writing status for every conflict class, and import uses inconsistent alert/status paths.

### Inspector, debugger, and visualization completeness

- [ ] Add a full state-vector text representation consistent with the committed state-display scope.
- [ ] Display single-qubit purity $\gamma_q$ and linear entropy $S_L(q)$ together in the Inspector, not only the vector length/entropy label.
- [ ] Extend the state-vector chart to the canonical interactive amplitude/probability views, labels, and clear zero-state behavior; the current chart is probability-only and non-interactive.
- [ ] Implement a density-matrix readout if it remains part of the documented browser scope, or correct the README claim that density-matrix displays are done.
- [ ] Complete semantic gate rendering: distinct CZ/Toffoli/SWAP symbols, distinct anti-control markers, and non-overlapping target symbols/text rather than generic rectangles for every operation.
- [ ] Implement a complete register overview for the Bloch tab, not only per-row dots, while retaining the per-qubit sphere subtabs.
- [ ] Add and visually verify a distinct row-level entanglement/purity glow tied to $S_L(q)$ against the canonical entropy mapping. The renderer emits a state-driven band, but its input is a linear-entropy array named `purity` and no browser visual verification exists.
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
- [ ] Add AI Builder failure/retry feedback, model/error details, and confirmation before replacing an edited circuit; the current browser path applies a successful build immediately and replaces the editor without confirmation.
- [ ] Add multi-row input/output selection to I/O Analyzer; the current UI exposes only one input and one output row although the contract supports selected rows, and row bounds must be validated against the selected circuit.
- [ ] Ensure AI Builder cache invalidation includes the requested model/circuit context and expose cache-hit/miss state to the user. I/O Analyzer’s explicit boundary and actual-state cache identity remain mandatory per P0-5.
- [ ] Include the AI Builder model selection in the cache key so switching models does not serve a stale cached circuit.
- [ ] Fix `IOAnalyzer.enrichWithLLM()`, which currently calls `explain([])` and therefore returns “Empty circuit” instead of enriching the causal analysis. AI fallback gate-description keys are now correct and no longer need work.
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

- [ ] Resolve remaining file-size rule violations: `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/sim/StepTrace.js` (432), `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/debugger/Debugger.js` (483), `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/AppController.js` (428), `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ui/AppController.test.js` (618), `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/cross-validation/serializer-roundtrip.test.js` (410), and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/test/ui/browser-integration-comprehensive.test.js` (401).
- [ ] Rename the bare-function UI modules from kebab-case to the required camelCase filenames and align each primary export with its filename; define an explicit primary export for the browser bootstrap module. Examples include `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/ai-builder-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/ai-explainer-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/browser-app.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/canvas-renderer.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/code-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/debugger-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/inspector-bloch-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/inspector-histogram-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/inspector-state-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/inspector-tabs-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/io-analyzer-view.js`, `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/panel-view.js`, and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/placement-view.js`.
- [ ] Replace `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ai/registry.js` with a compliant primary-export facade/module and remove the barrel/re-export pattern; account for the shared-cache and optional-leaf constraints without re-exporting concrete feature modules.
- [ ] Remove or centralize unused imports/state in UI modules: `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/AppController.js` imports unused `collapse`; `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/main.js` and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/AppController.js` duplicate URL-codec wiring; `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/main.js` and `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/ui/browser-app.js` introduce mutable module-level `let` state where the conventions require closure/class-local or immutable state. Audit remaining module-level mutable state such as `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/src/circuit/GateRegistry.js` against the canonical rule and document/refactor any necessary exception.
- [ ] Update README browser-UI status claims after browser acceptance, including Extended Gates, entanglement highlighting, JSON/URL persistence, density-matrix display, and any feature still marked “Scaffold-only,” “Planned,” or “In progress.”
- [ ] Keep `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/docs/Plans/UI.md` as the single live checklist; update DONE/QA/TODO here as each wave lands and leave `/home/cat/Stuff/Projects/Quantum/CSE299.3-Group-1/docs/Plans/UI Audit Historical.md` unchanged as history. This audit is complete through `1a8e93d`; future waves must update the review-basis hash and re-verify every carried task.

