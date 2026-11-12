// =============================================================================
// src/ai/IOAnalyzer.js
// -----------------------------------------------------------------------------
// Discardable feature leaf: causal input/output analysis over a flattened
// schedule using StepTrace. Pure analysis mode works without Ollama; optional
// LLM enrichment via AIExplainer. Reads StepTrace only; never imports
// debugger/ or inspector/. DOM-free; runs in bare Node.js.
// =============================================================================

/**
 * Collect the unique qubit rows touched by a single instruction.
 * @param {object} instr
 * @returns {number[]}
 */
function touchedRowsOf(instr) {
  const rows = new Set();
  if (Number.isInteger(instr.target)) rows.add(instr.target);
  if (Number.isInteger(instr.target2)) rows.add(instr.target2);
  for (const c of instr.controls || []) {
    if (Number.isInteger(c.row)) rows.add(c.row);
  }
  return [...rows].sort((a, b) => a - b);
}

/**
 * Group instructions by virtualColumn, preserving order within a column.
 * @param {Array} instructions
 * @returns {Array<{virtualColumn, instructions, touchedRows}>}
 */
function groupByColumn(instructions) {
  const map = new Map();
  for (const instr of instructions) {
    const vc = instr.virtualColumn;
    if (!map.has(vc)) map.set(vc, []);
    map.get(vc).push(instr);
  }
  const cols = [];
  for (const [vc, instrs] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
    const touched = new Set();
    for (const instr of instrs) {
      for (const r of touchedRowsOf(instr)) touched.add(r);
    }
    cols.push({ virtualColumn: vc, instructions: instrs, touchedRows: [...touched] });
  }
  return cols;
}

/**
 * Build a human-readable gate descriptor for an instruction.
 * @param {object} instr
 * @returns {string}
 */
function gateDescriptor(instr) {
  let s = instr.gateId;
  const parts = [];
  if (Number.isInteger(instr.target)) parts.push(`row ${instr.target}`);
  if (Number.isInteger(instr.target2)) parts.push(`target2 row ${instr.target2}`);
  const onCtrls = (instr.controls || []).filter((c) => c.on).map((c) => `row ${c.row}`);
  const offCtrls = (instr.controls || []).filter((c) => !c.on).map((c) => `anti row ${c.row}`);
  if (onCtrls.length) parts.push(`controlled on [${onCtrls.join(', ')}]`);
  if (offCtrls.length) parts.push(`anti-controlled on [${offCtrls.join(', ')}]`);
  if (instr.thetaRad !== undefined) parts.push(`theta=${instr.thetaRad.toFixed(3)}rad`);
  return s + (parts.length ? ' on ' + parts.join('; ') : '');
}

/**
 * Analyze how selected input rows combine to form selected output rows across
 * the flattened schedule.
 *
 * @param {Array} instructions - flattened Instruction[] from Flatten.js
 * @param {number[]} inputRows - qubit rows treated as inputs
 * @param {number[]} outputRows - qubit rows treated as outputs
 * @param {object} stepTrace - StepTrace instance (reset/stepped to the end)
 * @returns {object} { inputRows, outputRows, touchedColumns, inputAffectedColumns, outputAffectedColumns, causalChain, summary }
 */
function analyzeIO(instructions, inputRows, outputRows, stepTrace) {
  const inputSet = new Set(inputRows);
  const outputSet = new Set(outputRows);

  const columns = groupByColumn(instructions);

  // Determine which columns actually changed the state, when StepTrace
  // reports changed steps (dense mode). Fall back to all columns otherwise.
  let changedSteps = null;
  if (stepTrace && typeof stepTrace.getChangedSteps === 'function') {
    changedSteps = stepTrace.getChangedSteps();
  }
  const changedSet = changedSteps ? new Set(changedSteps) : null;

  const touchedColumns = [];
  const inputAffectedColumns = [];
  const outputAffectedColumns = [];

  for (const col of columns) {
    const isChanged = changedSet === null || changedSet.has(col.virtualColumn);
    if (!isChanged) continue;
    touchedColumns.push(col);
    const touchesInput = col.touchedRows.some((r) => inputSet.has(r));
    const touchesOutput = col.touchedRows.some((r) => outputSet.has(r));
    if (touchesInput) inputAffectedColumns.push(col.virtualColumn);
    if (touchesOutput) outputAffectedColumns.push(col.virtualColumn);
  }

  const causalChain = [];
  for (const col of touchedColumns) {
    const gateDescs = col.instructions.map(gateDescriptor).join('; ');
    const touchesInput = col.touchedRows.some((r) => inputSet.has(r));
    const touchesOutput = col.touchedRows.some((r) => outputSet.has(r));
    const tags = [];
    if (touchesInput) tags.push('input-affected');
    if (touchesOutput) tags.push('output-affected');
    const tagStr = tags.length ? ` [${tags.join(', ')}]` : '';
    causalChain.push(
      `virtual column ${col.virtualColumn}: ${gateDescs}${tagStr}`
    );
  }

  let summary;
  if (inputAffectedColumns.length === 0 && outputAffectedColumns.length === 0) {
    summary = `No shared columns between input rows [${inputRows.join(',')}] and output rows [${outputRows.join(',')}].`;
  } else {
    summary = `Input rows [${inputRows.join(',')}] affect ${
      inputAffectedColumns.length
    } column(s); output rows [${outputRows.join(',')}] are touched in ${
      outputAffectedColumns.length
    } column(s).`;
  }

  return {
    inputRows: [...inputRows],
    outputRows: [...outputRows],
    touchedColumns,
    inputAffectedColumns,
    outputAffectedColumns,
    causalChain,
    summary,
  };
}

/**
 * Optional LLM enrichment: ask AIExplainer to turn the analysis into prose.
 * @param {AIExplainer} explainer
 * @param {object} analysis
 * @param {Array} summaries
 * @param {number} numQubits
 * @returns {Promise<string>}
 */
async function enrichWithLLM(explainer, analysis, summaries, numQubits) {
  const lines = [];
  lines.push('Explain the causal input/output flow of this quantum circuit:');
  lines.push(analysis.summary);
  lines.push('');
  for (const step of analysis.causalChain) {
    lines.push(`- ${step}`);
  }
  return explainer.explain([], summaries, numQubits);
}

/**
 * Primary export matching the base filename (IOAnalyzer.js -> IOAnalyzer).
 */
export class IOAnalyzer {
  /**
   * Analyze how selected input rows combine to form selected output rows.
   * @param {Array} instructions
   * @param {number[]} inputRows
   * @param {number[]} outputRows
   * @param {object} stepTrace
   * @returns {object}
   */
  static analyzeIO(instructions, inputRows, outputRows, stepTrace) {
    return analyzeIO(instructions, inputRows, outputRows, stepTrace);
  }

  /**
   * Enrich an analysis with an LLM-generated explanation via AIExplainer.
   * @param {object} explainer - AIExplainer instance
   * @param {object} analysis - result of analyzeIO
   * @param {Array} summaries - sparse state summaries
   * @param {number} numQubits
   * @returns {Promise<string>}
   */
  static enrichWithLLM(explainer, analysis, summaries, numQubits) {
    return enrichWithLLM(explainer, analysis, summaries, numQubits);
  }
}
