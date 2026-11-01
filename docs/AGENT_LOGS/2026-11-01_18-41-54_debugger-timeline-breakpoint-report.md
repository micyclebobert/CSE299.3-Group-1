# SimQC Debugger Feature Leaves — In-Depth Implementation Report

**Files covered:** `src/debugger/Timeline.js` (252 LOC), `src/debugger/Debugger.js` (472 LOC), `src/debugger/BreakpointManager.js` (280 LOC).

**Tests:** `test/debugger/Timeline.test.js` (312 LOC), `test/debugger/Debugger.test.js` (383 LOC), `test/debugger/BreakpointManager.test.js` (286 LOC).

**Primary dependency:** `src/sim/StepTrace.js` (432 LOC) — shared, read-only, feature-neutral state-trace engine output.

**Classification (per FOLDER_STRUCTURE.md / SOURCE_OF_TRUTH.md §3):** All three modules are **discardable feature leaves** under `src/debugger/`. They import only `core/`, `circuit/`, and `sim/` (StepTrace). They are imported **exclusively** by `main.js`. Deleting the entire `debugger/` folder requires at most a 2-line diff in `main.js` with zero inter-feature dependencies. Zero import edges exist between `debugger/`, `inspector/`, and `ai/`.

---

# 1. Timeline.js — Column Scrubber Over StepTrace Snapshots

## Role and Responsibilities

`Timeline` is the UI-facing scrubber / playback-position controller built on top of `StepTrace`. It provides **O(1) scrubbing in Dense Mode** (cached snapshot copy via `Float64Array.set()`) and **zero-allocation fast-forward replay in Ephemeral Mode** (reset + loop `next()` in place). All operations are read-from-StepTrace except `seek`, which is a controlled state transition on the shared `StepTrace` instance.

## Class Structure

```
export class Timeline {
  #stepTrace;      // StepTrace instance (validated at construction)
  #callbacks;      // { onScrub, onStepChange, onModeChange }
  #lastScrubTarget; // number|null — dedupes repeated no-op scrubs
}
```

All fields are **hard private (`#`)**. No module-level mutable state. Construction validates `stepTrace.seek` is a function; throws `TypeError` otherwise.

## Callback Registration (typed, validated)

| Method | Signature | Fires when |
|--------|-----------|------------|
| `onScrub(callback)` | `(step: number, mode: string) => void` | `scrub()` reaches a new target |
| `onStepChange(callback)` | `(step: number, totalSteps: number) => void` | step position changes |
| `onModeChange(callback)` | `(mode: string) => void` | (declared; Mode is fixed per trace instance) |

Each validates `typeof callback === 'function'` and throws `TypeError` on violation.

## Read-Only Query API

| Method | Returns | Notes |
|--------|---------|-------|
| `getMode()` | `'dense' \| 'ephemeral'` | Delegates to `stepTrace.mode` |
| `getCurrentStep()` | `number` | Delegates to `stepTrace.step` |
| `getTotalSteps()` | `number` | Delegates to `stepTrace.scheduleLength` |
| `getNumQubits()` | `number` | Delegates to `stepTrace.numQubits` |
| `getCurrentState()` | `StateVectorView` | Read-only view of current state (from `stepTrace.currentState`) |
| `getSummary()` | `TimelineSummary` | `{ mode, currentStep, totalSteps, numQubits, changedSteps }` |
| `getChangedSteps()` | `number[]` | Delegates to `stepTrace.getChangedSteps()` |

## Core Operation: `scrub(targetStep)`

```js
scrub(targetStep) {
  const clamped = Math.max(0, Math.min(targetStep, scheduleLength));
  const previousStep = stepTrace.step;
  if (clamped !== previousStep) stepTrace.seek(clamped);
  if (clamped !== this.#lastScrubTarget) {
    this.#lastScrubTarget = clamped;
    fire onScrub(clamped, mode);
    fire onStepChange(clamped, scheduleLength);
  }
  return clamped;
}
```

Key behaviors:
- **Clamps** to `[0, scheduleLength]`.
- **No-op short-circuit:** if already at `clamped`, does not call `stepTrace.seek`.
- **Dedupes callbacks** via `#lastScrubTarget`: repeated `scrub(0)` fires callbacks only once even if called multiple times (test asserts `callCount === 1` for double `scrub(0)`).
- Calls `stepTrace.seek(clamped)` which, in Dense Mode, is O(1) snapshot copy; in Ephemeral Mode is zero-allocation fast-forward from step 0.

## Auxiliary Scrub Operations

| Method | Behavior |
|--------|----------|
| `scrubBy(delta)` | `scrub(step + delta)`; validates integer delta |
| `scrubToStart()` | `scrub(0)`; returns `0` |
| `scrubToEnd()` | `scrub(scheduleLength)` |

## `peekState(step)` — Read-Only Non-Mutating State Inspection

Returns a **frozen-style read-only view** (not the raw buffers) of the state at `step` **without changing current position**:

```js
{
  numQubits, size,
  getRe(i) => snap.re[i],
  getIm(i) => snap.im[i],
  probability(i) => r*r + im*im,
  probabilities() => Float64Array (full distribution),
  normSquared() => sum of r*r + im*im
}
```

Mode-dependent behavior:
- **Dense Mode:** O(1) via `stepTrace.getSnapshot(step)` (cached copy). Returns `null` for invalid step or missing snapshot.
- **Ephemeral Mode:** Always returns `null` — peeking would require mutating the shared working buffer position, violating the non-mutation contract.

The returned object exposes **only** read methods (`getRe`, `getIm`, `probability`, `probabilities`, `normSquared`). It deliberately does **not** expose `getRawRe` / `getRawIm` (tests assert these are `undefined`).

## Mode Semantics

| Aspect | Dense Mode (`n <= 12`) | Ephemeral Mode (`n > 12`) |
|--------|----------------------|---------------------------|
| `scrub()` | O(1) snapshot copy | Zero-alloc fast-forward from step 0 |
| `peekState(step)` | Available via cached snapshot | `null` (cannot peek without mutation) |
| `getChangedSteps()` | Compares cached snapshots pairwise | `[]` (would require full replay) |
| Memory | `scheduleLength + 1` snapshot pairs | Single mutable buffer pair |

---

# 2. BreakpointManager.js — Breakpoint Storage & Trigger Detection

## Role and Responsibilities

`BreakpointManager` owns breakpoint **storage** and **detection logic** for a `StepTrace`. It supports two breakpoint kinds: explicit **column breakpoints** (break at a virtual column index) and **predicate breakpoints** (break when a state predicate evaluates true at a step). All operations are read-only with respect to `StepTrace`.

## Class Structure

```
export class BreakpointManager {
  #stepTrace;              // StepTrace (validated: must expose findStepWhere)
  #columnBreakpoints = new Set<number>();
  #predicateBreakpoints = new Map<string, predicateFn>();
  #enabled = true;         // global enable/disable flag
}
```

All fields hard-private. Construction validates `stepTrace.findStepWhere` is a function; throws `TypeError` otherwise. Breakpoints are **globally enabled by default**.

## Global Enable/Disable

| Method | Behavior |
|--------|----------|
| `setEnabled(enabled)` | Sets `this.#enabled = Boolean(enabled)` |
| `isEnabled()` | Returns current flag |

When disabled, `checkBreakpoints()` returns `null` and `findNext/PreviousBreakpoint()` return `-1`.

## Column Breakpoints

| Method | Signature | Behavior / Returns |
|--------|-----------|------------------- |
| `addColumnBreakpoint(virtualColumn)` | `number => boolean` | Validates non-negative integer, `<= scheduleLength` (else `TypeError` / `RangeError`). Returns `true` if added, `false` if duplicate. |
| `removeColumnBreakpoint(virtualColumn)` | `number => boolean` | `Set.delete` result. |
| `toggleColumnBreakpoint(virtualColumn)` | `number => boolean` | Removes if present (returns `false`), else adds (returns `true`). |
| `hasColumnBreakpoint(virtualColumn)` | `number => boolean` | `Set.has`. |
| `getColumnBreakpoints()` | `=> number[]` | Sorted ascending array copy. |
| `clearColumnBreakpoints()` | `=> void` | `Set.clear`. |

Column breakpoints are validated against `scheduleLength` at add time (throw `RangeError` if exceeding).

## Predicate Breakpoints

| Method | Signature | Behavior / Returns |
|--------|-----------|------------------- |
| `addPredicateBreakpoint(id, predicate)` | `(string, (re, im, step) => boolean) => boolean` | Validates non-empty string id and function predicate. Returns `false` on duplicate id. |
| `removePredicateBreakpoint(id)` | `string => boolean` | `Map.delete` result. |
| `togglePredicateBreakpoint(id)` | `string => boolean` | Removes if present (returns `false`); **cannot** toggle on without re-adding via `addPredicateBreakpoint` (always returns `false` when absent). |
| `hasPredicateBreakpoint(id)` | `string => boolean` | `Map.has`. |
| `getPredicateBreakpointIds()` | `=> string[]` | All registered ids. |
| `clearPredicateBreakpoints()` | `=> void` | `Map.clear`. |
| `clearAll()` | `=> void` | Clears both column and predicate sets/maps. |

## `checkBreakpoints(currentStep)` — Trigger Detection

```js
checkBreakpoints(currentStep) {
  if (!this.#enabled) return null;
  if (this.#columnBreakpoints.has(currentStep)) return currentStep; // column match
  for (const [id, predicate] of this.#predicateBreakpoints) {
    const state = this.#stepTrace.currentState;       // read-only view
    const size = state.size();
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) { re[i] = state.getRe(i); im[i] = state.getIm(i); }
    if (predicate(re, im, currentStep)) return id;     // predicate match
  }
  return null;
}
```

Key implementation detail: predicate evaluation **copies** the current state into fresh `Float64Array` buffers (`re`, `im`) before invoking the predicate. This keeps the predicate side-effect free with respect to the shared working buffers (the predicate receives its own copies, not live references to `stepTrace.#re`/`#im`).

Returns:
- `currentStep` (as number) if a column breakpoint matches.
- `id` (string) if a predicate breakpoint matches.
- `null` if no match or disabled.

Column breakpoints are checked **first**, so an exact column hit takes precedence over predicate matches at the same step.

## Navigation: `findNextBreakpoint` / `findPreviousBreakpoint`

| Method | Behavior |
|--------|----------|
| `findNextBreakpoint(currentStep)` | Returns next column breakpoint `> currentStep`, else `-1`. Predicate breakpoints **do not** participate (comment explains stepping through would mutate StepTrace; callers should use `findStepWhere` explicitly). |
| `findPreviousBreakpoint(currentStep)` | Returns previous column breakpoint `< currentStep`, else `-1`. |

Both return `-1` when globally disabled. Both operate on the sorted column-breakpoint list only.

## Design Note: Shared-Buffer Aliasing Risk

`checkBreakpoints` copies state into local `Float64Array`s before calling the predicate. This is a deliberate safety measure: if the predicate mutated its `re`/`im` arguments, those mutations would **not** corrupt `stepTrace`'s internal buffers. However, this copy is an `O(2^n)` allocation per predicate check per step — acceptable for interactive breakpoint stepping but not for hot-path continuous evaluation.

---

# 3. Debugger.js — Orchestrator / Integration Facade

## Role and Responsibilities

`Debugger` is the top-level debugger integration class. It **composes** `BreakpointManager` and `Timeline` (both constructed in its constructor from the shared `StepTrace`) and exposes a unified facade: playback controls, breakpoint management, timeline scrubbing, state queries, and a callback event system. It never mutates simulation state directly — all state transitions flow through `StepTrace`.

## Class Structure

```
export class Debugger {
  #stepTrace;              // StepTrace (validated: must expose next)
  #breakpointManager;      // BreakpointManager(stepTrace)
  #timeline;               // Timeline(stepTrace)
  #callbacks;              // { onStep, onBreakpointHit, onReset, onSeek, onNext }
}
```

All fields hard-private. Construction validates `stepTrace.next` is a function; throws `TypeError` otherwise.

**Cross-wiring:** The constructor registers a `Timeline.onStepChange` handler that forwards to `Debugger.#callbacks.onStep` and then invokes `BreakpointManager.checkBreakpoints(step)`, forwarding hits to `onBreakpointHit`. This means any step change routed through the timeline also triggers breakpoint detection.

## Playback Controls (M4.1)

| Method | Behavior |
|--------|----------|
| `reset()` | `stepTrace.reset()`; fires `onReset` and `onStep(0, total)`. Returns `0`. |
| `next()` | If at end, returns current step (no-op). Else `stepTrace.next()`, fires `onNext(step)` and `onStep(step, total)`, then checks breakpoints via `checkBreakpoints`. Returns new step. |
| `seek(targetCol)` | Validates integer; clamps to `[0, scheduleLength]`. Short-circuits if already at target. `stepTrace.seek(clamped)`, fires `onSeek(newStep, oldStep)` and `onStep(clamped, total)`, checks breakpoints. Returns clamped step. |
| `runToBreakpoint()` | Loops: `checkBreakpoints(step)` → if hit return step; else `next()`. Until `step >= scheduleLength`. Finally checks breakpoints at final step and fires callback. Returns stop step. |
| `runToPreviousBreakpoint()` | `BreakpointManager.findPreviousBreakpoint(step)` → if found, `seek(prev)`; else `seek(0)`. Returns resulting step. |

Note: `next()` guards against advancing past `scheduleLength` — returns current step unchanged if already at end.

## Breakpoint Management (M4.2) — Thin Delegation

Every method delegates to `#breakpointManager`:
- `getBreakpointManager()` → returns the `BreakpointManager` instance (escape hatch for direct BM access).
- `add/remove/toggle/has/getColumnBreakpoint(...)`
- `add/remove/hasPredicateBreakpoint(...)`
- `findStepWhere(predicate)` → delegates to `stepTrace.findStepWhere(predicate)` (zero intermediate allocations; uses StepTrace's in-place replay).
- `setBreakpointsEnabled(enabled)` / `areBreakpointsEnabled()`.

## Timeline Scrubbing (M4.3) — Thin Delegation

- `getTimeline()` → returns the `Timeline` instance.
- `scrub(step)` / `scrubToStart()` / `scrubToEnd()` → delegate to `#timeline`.
- `getCurrentState()` → returns `stepTrace.currentState` directly (read-only view).
- `peekState(step)` → delegates to `#timeline.peekState(step)` (Dense Mode only).
- `getTimelineSummary()` → delegates to `#timeline.getSummary()`.

## State Queries

| Method | Returns |
|--------|---------|
| `getCurrentStep()` | `stepTrace.step` |
| `getTotalSteps()` | `stepTrace.scheduleLength` |
| `getMode()` | `stepTrace.mode` |
| `getNumQubits()` | `stepTrace.numQubits` |
| `isAtStart()` | `step === 0` |
| `isAtEnd()` | `step >= scheduleLength` |

## Callback Event System

| Method | Signature | Fires on |
|--------|-----------|----------|
| `onStep(callback)` | `(step, totalSteps) => void` | reset, next, seek, timeline step change |
| `onBreakpointHit(callback)` | `(breakpointId, step) => void` | column or predicate breakpoint hit |
| `onReset(callback)` | `() => void` | reset |
| `onSeek(callback)` | `(newStep, oldStep) => void` | seek |
| `onNext(callback)` | `(step) => void` | next |

Each validates function type and throws `TypeError` otherwise.

## Static Facade: `Debugger.fromCircuit(circuit)`

Convenience constructor that builds a `Debugger` end-to-end from a `Circuit`:

```js
static fromCircuit(circuit) {
  const instructions = flattenCircuit(circuit);
  const schedule = scheduleColumns(instructions);
  const trace = new StepTrace(schedule, circuit.numQubits);
  return new Debugger(trace);
}
```

Imports `flattenCircuit`, `scheduleColumns` from `../circuit/Flatten.js` and `StepTrace` from `../sim/StepTrace.js`. This is the **only** place `Debugger` touches circuit-flattening logic; normally a `StepTrace` is injected from `main.js`/`Evaluator`.

## Integration Flow Diagram

```
user action
    │
    ├─ next() ────────────────► stepTrace.next() ──► onNext, onStep ──┐
    │                                                                ▼
    ├─ seek(col) ────────────────► stepTrace.seek(col) ──► onSeek, onStep ──► BreakpointManager.checkBreakpoints(step) ──► onBreakpointHit
    │                                                                │
    ├─ reset() ─────────────────► stepTrace.reset() ──► onReset, onStep  │
    │                                                            │
    ├─ scrub(col) ───► Timeline.scrub(col) ─► stepTrace.seek(col) ──► onScrub, onStepChange ──► onStep ──► onBreakpointHit
    │                                                            │
    ├─ addColumnBreakpoint(n) ──► BreakpointManager.addColumnBreakpoint(n)
    ├─ runToBreakpoint() ──────► loop checkBreakpoints + next() until hit or end
    └─ getTimeline() ─────────► returns Timeline (for direct scrub UI binding)
```

## StateVectorView Contract

`getCurrentState()` and `peekState()` return a read-only view object (defined in `StepTrace.currentState` getter) exposing: `numQubits()`, `size()`, `getRe(i)`, `getIm(i)`, `probability(i)`, `probabilities()`, `normSquared()`. It does **not** expose raw mutable buffers — core invariant: core thinks in indices, UI in labels; buffers never leak.

---

# 4. Two-Tier Storage Architecture (Shared Foundation)

All three modules depend on `StepTrace`, which implements a tiered storage strategy selected by qubit count `n` (per `src/sim/limits.js`):

| Regime | `n` | Storage | Scrub cost | Peek cost | Changed-steps |
|--------|-----|---------|------------|-----------|---------------|
| **Dense Mode** | `n <= 12` | `snapshots[scheduleLength + 1]` array of `{re, im}` copies | O(1) via `TypedArray.set()` | O(1) from snapshot | Pairwise compare of cached snapshots |
| **Ephemeral Replay Mode** | `n > 12` | Single mutable buffer pair (`re`, `im`), `snapshots = null` | Zero-alloc fast-forward: `reset()` + loop `next()` | `null` (would mutate position) | `[]` (would require full replay) |

Key invariant: `StepTrace.seek()` is the single mutation entry point used by both `Timeline.scrub()` and `Debugger.seek()`. In Dense Mode it copies a cached snapshot; in Ephemeral Mode it resets to step 0 and fast-forwards in place — zero heap allocations.

---

# 5. Layering & Boundary Compliance

| Rule (per CONVENTIONS.md §3 / SOURCE_OF_TRUTH §3.3) | Status |
|---------------------------------------------------|--------|
| Imports only `core/`, `circuit/`, `sim/` (StepTrace) | ✅ `Debugger` imports `Flatten` + `StepTrace`; `Timeline`/`BreakpointManager` import nothing external |
| Imported exclusively by `main.js` | ✅ (per file headers) |
| Zero imports between `debugger/` ↔ `inspector/` ↔ `ai/` | ✅ |
| No DOM / `window` / `document` | ✅ Pure JS |
| Named exports only; explicit `.js` extensions | ✅ |
| Primary export matches base filename | ✅ (`class Timeline`, `class Debugger`, `class BreakpointManager`) |
| `const` by default; `#` hard-private fields; no `var` | ✅ |
| Zero module-level mutable state | ✅ |
| Under 400 LOC | ✅ (252 / 472 / 280 — Debugger.js is at 472, slightly over the 400 soft cap per CONVENTIONS §1; worth noting for a possible split) |
| 1:1 mirrored `*.test.js` in `test/debugger/` | ✅ All three present |

> **Note:** `Debugger.js` at 472 LOC exceeds the 400-line soft ceiling in CONVENTIONS.md §1. If enforcing the cap strictly, consider splitting into `DebuggerPlayback.js` (playback controls) and `DebuggerBreakpoints.js` (breakpoint + timeline delegation) or moving the static facade out. This is a refactor consideration, not a correctness issue.

---

# 6. Key Ideas for a Downstream Agent to Extract

1. **Read-through, write-via-StepTrace:** `Timeline` and `Debugger` never own state-vector buffers. They hold a reference to a shared `StepTrace` and route all mutations through `stepTrace.seek()` / `stepTrace.next()` / `stepTrace.reset()`. This preserves the "shared trace ownership" invariant — `StepTrace` is produced by `sim/`, owned by no feature.

2. **Dense vs. Ephemeral dual-mode:** All three modules are mode-agnostic at the API surface but behave differently under the hood:
   - `Timeline.scrub()`: O(1) snapshot copy vs. zero-alloc replay.
   - `Timeline.peekState()`: available in Dense, `null` in Ephemeral.
   - `Timeline.getChangedSteps()`: snapshot diff vs. empty array.
   - `BreakpointManager.checkBreakpoints()`: works identically in both modes (reads `stepTrace.currentState`), but predicates copy state to avoid aliasing the single mutable buffer in Ephemeral Mode.

3. **Callback dedup in `Timeline.scrub`:** `#lastScrubTarget` prevents duplicate `onScrub`/`onStepChange` firings when the user scrubs to the same column repeatedly (e.g., dragging a slider that emits repeated events).

4. **Breakpoint precedence:** Column breakpoints checked before predicates in `checkBreakpoints`. Predicate evaluation copies `currentState` into local `Float64Array`s — defensive against predicate-side mutation of shared buffers.

5. **Predicate navigation limitation:** `findNextBreakpoint` only considers column breakpoints; predicate breakpoints require explicit `findStepWhere` calls (which replay from step 0 in place). Documented in-code comment.

6. **Debugger as pure facade/orchestrator:** `Debugger` contains no state-transition logic of its own — it delegates to `stepTrace`, `BreakpointManager`, and `Timeline`. Its value is wiring callbacks (`onStep` → `checkBreakpoints` → `onBreakpointHit`) and providing a static `fromCircuit` convenience constructor.

7. **Defensive validation everywhere:** Every public method validates argument types (`Number.isInteger`, `typeof function`, non-empty string, range checks) and throws `TypeError`/`RangeError` before touching state. This makes the API safe for direct UI wiring.

---

# 7. Suggested Next Steps for a Downstream Agent

- **Wire into `main.js`:** Confirm how `main.js` instantiates `StepTrace` (via `Evaluator`) and injects `Debugger`/`Timeline` into the UI. Currently `main.js` references are minimal (grep showed only a commented-out `DebuggerUI` import).
- **UI integration:** Build `DebuggerUI` (or canvas toolbar) binding `Debugger.next/seek/reset/scrub` to buttons/slider and `onStep`/`onBreakpointHit` to visual row highlights.
- **Predicate breakpoint UI:** Expose `addPredicateBreakpoint(id, predicate)` so users can break on entanglement thresholds (e.g., `re[0] > 0 && re[3] > 0` for Bell detection).
- **Ephemeral Mode UX:** Handle `peekState === null` and `getChangedSteps() === []` gracefully in the UI for `n > 12` (show "replay required" or disable non-mutating peek).
- **Consider splitting `Debugger.js`** if enforcing the 400-LOC file cap strictly.

---

**Verification:** All three source modules have 1:1 mirrored tests under `test/debugger/`, executed via `node --test`. Run `node --test` from the repo root to confirm the full suite passes.
