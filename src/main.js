// =============================================================================
// src/main.js
// -----------------------------------------------------------------------------
// Application bootstrap and dependency wiring.
//
// Per AGENTS.md rule #3 and CONVENTIONS.md §3: main.js is the ONLY file
// permitted to import gates/ and discardable feature modules
// (debugger/, inspector/, ai/). It injects gate implementations into
// circuit/GateRegistry.js, breaking the circuit/ → gates/ dependency cycle.
//
// This module is DOM-free and runs in bare Node.js.
// =============================================================================

import {
  registerFixedGate,
  registerParameterizedGate,
  seal,
} from './circuit/GateRegistry.js';

import { encode as _urlEncode, decode as _urlDecode } from './circuit/URLCodec.js';
const URLCodec = { encode: _urlEncode, decode: _urlDecode };

import { I, X, Y, Z, H, S, T } from './gates/basis.js';
import { Cu1, Rx, Ry, Rz } from './gates/param.js';

// ---------------------------------------------------------------------------
// UI shell imports (one line per folder; deleting a UI folder requires
// removing only that folder's import line(s) here).
// ---------------------------------------------------------------------------

import { PanelModel, PanelRegion, PANEL_LEFT, PANEL_MAIN, PANEL_RIGHT, PANEL_BOTTOM } from './ui/panels.js';
import { theme, themeCssVariables } from './ui/theme.js';
import { Interaction, PHASE_IDLE, PHASE_PICKED, PHASE_DRAGGING, snapCell } from './editor/Interaction.js';
import {
  gateCatalog,
  CATEGORY_CORE,
  CATEGORY_EXTENSIONS,
  CATEGORY_SUBCIRCUITS,
  gateArity,
  gateControlCount,
  gateNeedsTarget2,
} from './editor/gatePalette.js';
import { History } from './state/History.js';

// ---------------------------------------------------------------------------
// Register all gates into the circuit-layer registry.
// This is the single import edge from gates/ into the application.
// Fixed gates (single-qubit flat tuples) and parameterized rotations are
// registered here. Multi-qubit gates (CNOT, CZ, SWAP, Toffoli) are dispatched
// by gateId in sim/Evaluator.js and sim/StepTrace.js via dedicated kernels,
// so they are catalogued in gatePalette.js but not registered as flat tuples.
// ---------------------------------------------------------------------------

registerFixedGate('I', I);
registerFixedGate('X', X);
registerFixedGate('Y', Y);
registerFixedGate('Z', Z);
registerFixedGate('H', H);
registerFixedGate('S', S);
registerFixedGate('T', T);

registerParameterizedGate('Rx', Rx);
registerParameterizedGate('Ry', Ry);
registerParameterizedGate('Rz', Rz);
registerParameterizedGate('Cu1', Cu1);

// Seal the registry so no further mutation is allowed.
seal();

// ---------------------------------------------------------------------------
// UI shell assembly: panel model (Left/Main/Right/Bottom regions), theme,
// drag-and-drop interaction state machine, gate catalog, and undo/redo
// history. All are pure (DOM-free) and constructible in bare Node.js.
// ---------------------------------------------------------------------------

const panelModel = new PanelModel({ viewport: { x: 0, y: 0, w: 1200, h: 800 } });
panelModel.addRegion(new PanelRegion({ id: PANEL_LEFT, rect: { x: 0, y: 0, w: 260, h: 800 }, zIndex: 0 }));
panelModel.addRegion(new PanelRegion({ id: PANEL_MAIN, rect: { x: 260, y: 0, w: 680, h: 660 }, zIndex: 0 }));
panelModel.addRegion(new PanelRegion({ id: PANEL_RIGHT, rect: { x: 940, y: 0, w: 260, h: 800 }, zIndex: 0 }));
panelModel.addRegion(new PanelRegion({ id: PANEL_BOTTOM, rect: { x: 0, y: 660, w: 1200, h: 140 }, zIndex: 0 }));

const history = new History();
const interaction = new Interaction();
const catalog = gateCatalog();

// ---------------------------------------------------------------------------
// Discardable feature leaves are imported here only.
// Deleting any leaf folder requires at most a 2-line diff in this file.
// ---------------------------------------------------------------------------

// debugger/ (2 lines)
import { DebuggerUI } from './debugger/DebuggerUI.js';
import { Debugger } from './debugger/Debugger.js';

// inspector/ (2 lines)
import { Inspector } from './inspector/Inspector.js';
import { InspectorUI } from './inspector/InspectorUI.js';

// ai/ (1 line via registry.js)
import { AIExplainer, IOAnalyzer, AIBuilder, SparseSummary, AIBuilderUI, IOAnalyzerUI, Cache } from './ai/registry.js';

let cache = null;
if (typeof Cache !== 'undefined') {
  cache = new Cache();
}

// ---------------------------------------------------------------------------
// Application entry point (browser / CLI wiring would go here).
// ---------------------------------------------------------------------------

export { registerFixedGate, registerParameterizedGate, seal };
export { listGates, getGate, getFixedGate, getParameterizedGate } from './circuit/GateRegistry.js';

// ---------------------------------------------------------------------------
// UI shell exports (browser entry point consumes these).
// ---------------------------------------------------------------------------

export { panelModel, history, interaction, catalog, cache, URLCodec };
export { theme, themeCssVariables, CATEGORY_CORE, CATEGORY_EXTENSIONS, CATEGORY_SUBCIRCUITS };
export { gateArity, gateControlCount, gateNeedsTarget2 };
export { PHASE_IDLE, PHASE_PICKED, PHASE_DRAGGING } from './editor/Interaction.js';
export { snapCell } from './editor/Interaction.js';

// ---------------------------------------------------------------------------
// Discardable feature leaf exports (browser controller consumes these).
// ---------------------------------------------------------------------------

export { DebuggerUI, Debugger, InspectorUI, Inspector };
export { AIExplainer, IOAnalyzer, AIBuilder, AIBuilderUI, IOAnalyzerUI, Cache, SparseSummary } from './ai/registry.js';
