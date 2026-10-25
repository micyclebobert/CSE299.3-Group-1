This week I worked on the circuit model and the pipeline that turns a circuit into an executable schedule. The concepts I focused on were discrete time slices, immutability, flattening, and virtual column expansion.

The first thing I learned is that a quantum circuit is not a list of gates — it is a list of time slices. Each time slice (a GateColumn) is a vertical column of gates that all act on disjoint qubit rows at the same instant. Think of a conductor's score: each vertical line in the sheet music is one beat, and on that beat multiple instruments (qubits) can play at once, but no single instrument can play two different notes simultaneously. That is why GateColumn now asserts intra-column disjointness — if two gates in the same column share a qubit row, they would overwrite each other's amplitude, so the constructor throws.

I learned to treat Circuit and GateColumn as immutable value objects, like snapshots. Instead of mutating a circuit in place (which would break undo/redo history), every edit returns a brand-new instance. `withColumnAt()` is like inserting a new page into a bound book — you do not erase the old pages, you print a new edition with the page added. This is why `isEqualTo()` exists for structural comparison: two circuits are equal if their contents match, even if they are different object instances.

The flattening pipeline taught me about the difference between an editor's view and the engine's view. The editor sees a 2D grid of columns and rows (the Circuit). The simulation engine needs a flat 1D instruction stream ordered by execution time. Layer 1 (`flattenCircuit`) is the translator: it walks columns left-to-right and gates top-to-bottom, emitting one canonical instruction per gate. Each instruction carries both `column` (editor position) and `virtualColumn` (execution position). Think of it like a film editor cutting a movie — the raw footage has scene numbers (columns), but the final cut has a continuous timeline (virtual columns).

The hardest concept was virtual column expansion for subcircuits. When a gate embeds a subcircuit like a Bell block, that subcircuit is 2 columns wide. If the next top-level gate stayed at the original column index, it would execute before the subcircuit finished. So the subcircuit's internal gates occupy successive virtual columns, and the next top-level gate shifts forward. Analogy: a train on a single track — a 2-car train takes two station slots, so the train behind it waits two slots, not one. This is why `scheduleColumns` (Layer 2) groups instructions by `virtualColumn` into execution batches — it is the timetable that tells the engine which gates run together at each step.

Finally, I learned ASCII parsing as a way to generate circuits from text. It is like a tiny compiler: characters are tokens (`H`, `X`, `.` for controls, `-` for wires), rows are qubits, and columns are time slices. Dots in a column attach as positive controls to gates in the same column, so `H-X` on row 0 and `--.-` on row 1 builds a CNOT-like structure. This makes circuits readable and testable without hand-constructing JSON.

Key takeaways: (1) time slices must be disjoint, (2) immutability enables safe history, (3) flattening bridges editor grid to execution timeline, (4) virtual columns handle subcircuit width correctly, (5) ASCII diagrams make circuits human-readable.

---

## Code Snippets & Explanations

### 1. Intra-column disjointness assertion (`GateColumn.js`)
A column is a simultaneous time slice, so no qubit row may appear in two gates:
```js
const usedRows = new Set();
for (const gate of this._gates) {
  const rows = new Set([gate.target]);
  for (const c of gate.controls) rows.add(c.row);
  for (const row of rows) {
    if (usedRows.has(row)) {
      throw new Error(`GateColumn: qubit row ${row} is used by more than one gate in the same column`);
    }
    usedRows.add(row);
  }
}
```
*Analogy:* One pianist cannot press two keys with the same finger at the same instant. If two gates share a row in one column, their amplitude updates would collide.

### 2. Immutable column insertion (`Circuit.js`)
```js
withColumnAt(index, column) {
  if (!(column instanceof GateColumn)) {
    throw new TypeError(`withColumnAt expects a GateColumn instance`);
  }
  if (!Number.isInteger(index) || index < 0 || index > this._columns.length) {
    throw new RangeError(`Column index ${index} is out of range`);
  }
  const next = [...this._columns];
  next.splice(index, 0, column);
  return new Circuit({ numQubits: this._numQubits, columns: next });
}
```
*Analogy:* Like printing a new edition of a book with a page inserted — the original stays untouched. This keeps undo/redo stacks safe.

### 3. Layer 1 flattening (`Flatten.js`)
```js
for (let colIdx = 0; colIdx < circuit.columns.length; colIdx++) {
  const column = circuit.columns[colIdx];
  for (const gate of column.gates) {
    instructions.push({
      gateId: gate.name,
      target: gate.target,
      controls: [...gate.controls],
      thetaRad: undefined,
      column: colIdx,
      virtualColumn,
      subcircuit: undefined,
    });
    virtualColumn++;
  }
}
```
*Analogy:* A film editor turning scene numbers (columns) into a continuous timeline (virtualColumn). Each gate becomes one instruction on that timeline.

### 4. Virtual column expansion for subcircuits (`Flatten.js`)
```js
if (gate.subcircuit && gate.subcircuit instanceof Circuit) {
  const subInstructions = flattenCircuit(gate.subcircuit);
  const subWidth = subInstructions.length > 0
    ? Math.max(...subInstructions.map((i) => i.virtualColumn)) + 1
    : 1;
  for (const subInstr of subInstructions) {
    instructions.push({
      ...subInstr,
      column: colIdx,
      virtualColumn: virtualColumn + subInstr.virtualColumn,
      subcircuit: gate.subcircuitName || subInstr.subcircuit,
    });
  }
  virtualColumn += subWidth;
}
```
*Analogy:* A 2-car train takes two station slots, so the train behind waits two slots. The subcircuit's width pushes subsequent gates forward in virtual time.

### 5. Layer 2 schedule projection (`Flatten.js`)
```js
const buckets = new Map();
for (const instr of instructions) {
  const key = instr.virtualColumn;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(instr);
}
const executionColumns = [];
for (const [virtualColumn, instrs] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
  executionColumns.push({ virtualColumn, instructions: instrs });
}
```
*Analogy:* Grouping mail by delivery slot — every instruction with the same `virtualColumn` is delivered together as one `ExecutionColumn` batch.

### 6. ASCII diagram parsing (`Ascii.js`)
```js
for (let c = 0; c < width; c++) {
  const columnGates = [];
  for (let r = 0; r < numQubits; r++) {
    const ch = rows[r]?.[c];
    if (!ch || ch === ' ' || ch === '-' || ch === '|' || ch === '.') continue;
    const upper = ch.toUpperCase();
    // attach control dots from this column (excluding own row)
    const gateControls = [];
    const dots = dotsByCol.get(c);
    if (dots) for (const d of dots) if (d.row !== r) gateControls.push({ row: d.row, on: d.on });
    columnGates.push({ name: upper, target: r, controls: gateControls });
  }
  if (columnGates.length > 0) {
    gateColumns.push({ index: c, gates: columnGates });
  }
}
```
*Analogy:* A tiny compiler — letters are gate tokens, dots are control markers, dashes are wire connectors. Rows are qubits, columns are time. Example:
```
H-X
--.-
```
Row 0 has H then X (with a control dot on row 1), row 1 is empty then a control dot.