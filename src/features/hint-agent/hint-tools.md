# Hint Tools: Plain English Pseudocode

Companion to [`hint-tools.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/hint-agent/hint-tools.ts).

## Why this file exists

The MCP server, the in-process test client, and the eval harness all need the same two
answers about a grid: *what does it look like* and *what deductions are available*. Putting the
tool bodies here, independent of transport, means the model and the grader are looking at one
code path. If they diverged, an eval number could be an artifact of the transport.

## Constants

- `DEFAULT_PUZZLE` — the one hardcoded grid the MCP server serves when `HINT_GRID` is unset.
  Frozen as a literal (not regenerated) so the demo does not change when the generator does.
- `HINT_TOOL_DEFINITIONS` — tool names + descriptions. Every transport spreads these so the
  model always sees one contract.

## parseGrid(flat) → number[][]

Length picks the size: 16 → 4×4, 36 → 6×6, 81 → 9×9. `.` and `0` both mean empty. Anything
else, or a digit above the size, throws — a malformed state should fail loudly, not solve as
nonsense.

```text
size = { 16: 4, 36: 6, 81: 9 }[flat.length]  ELSE throw
FOR each row, col: digit = flat[r*size + c]; validate 0..size; grid[r][c] = digit
```

## describeGridState(solver) → string

Rows are 1-indexed and box borders are drawn so the model can see house boundaries. Every
empty cell's candidates follow, because a hint about a technique is meaningless without them —
and because an agent that *ignores* the deduction tool will try to derive moves from exactly
this list, which is what the eval's empty states are designed to catch.

## reportDeductions(deductions) → DeductionReport[]

Converts the engine's 0-indexed `Deduction`s to `r#c#` labels. The engine stays 0-indexed;
1-indexing happens only at this boundary.

## createHintTools(solver)

Returns `{ getGridState, listAvailableDeductions }` closed over one solver. The solver is never
mutated (see `deductions.md`), so both can be called any number of times in any order.
