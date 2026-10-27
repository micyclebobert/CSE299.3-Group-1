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

import { I, X, Y, Z, H, S, T } from './gates/basis.js';
import { Rx, Ry, Rz } from './gates/param.js';

// ---------------------------------------------------------------------------
// Register all gates into the circuit-layer registry.
// This is the single import edge from gates/ into the application.
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

// Seal the registry so no further mutation is allowed.
seal();

// ---------------------------------------------------------------------------
// Discardable feature leaves are imported here only.
// Deleting any leaf folder requires at most a 2-line diff in this file.
// ---------------------------------------------------------------------------

// import { DebuggerUI } from './debugger/DebuggerUI.js';
// import { InspectorUI } from './inspector/InspectorUI.js';
// import { AIExplainer } from './ai/AIExplainer.js';

// ---------------------------------------------------------------------------
// Application entry point (browser / CLI wiring would go here).
// ---------------------------------------------------------------------------

export { registerFixedGate, registerParameterizedGate, seal };
export { listGates, getGate, getFixedGate, getParameterizedGate } from './circuit/GateRegistry.js';
