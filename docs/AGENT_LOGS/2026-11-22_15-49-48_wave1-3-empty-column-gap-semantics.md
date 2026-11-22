Title: Wave 1.3 empty-column/gap semantics for placement

Summary:
Modified `_tryPlace()` in src/ui/AppController.js so that targeting a column `k`
beyond the current column count creates empty `GateColumn({ gates: [] })` entries
for every intermediate index from the current length up to `k-1`, then places the
gate at column `k`. The result has `columns.length === column + 1` with empty gap
columns preserved. Replaced the `if/else push` with a `while (nextColumns.length <
column)` loop plus `nextColumns[column] = nextColumn`, keeping the file at 399
lines (under the 400-line cap). Added three tests to test/ui/AppController.test.js:
placing at column 0 creates 1 column; placing at column 2 creates 3 columns with
empty gap columns 0 and 1 and the gate at column 2; placing at column 5 creates 6
columns with gaps. All assert numQubits is preserved. Full `node --test` suite:
823 tests pass, 0 fail. `node --input-type=module --check` on the modified source
passes.
