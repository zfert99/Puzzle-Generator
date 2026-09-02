# Sudoku Hint MCP Server: Plain English Pseudocode

Companion to [`mcp-server.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/hint-agent/mcp-server.ts).

## What it is

A stdio MCP server that exposes the engine's deduction oracle as two tools:

| Tool | Returns |
|---|---|
| `get_grid_state` | The grid (1-indexed rows, `.` for empty) plus candidates for every empty cell |
| `list_available_deductions` | JSON array of every available deduction, each with a strategy label |

Run it with `npm run mcp:hint`. The repo's `.mcp.json` registers it for Claude Code under the
name `sudoku-hint`, so "what can I do next on this grid?" is answered by `HumanSolver`, not by
the model's own reasoning.

## Why there is no "apply move" tool

The server's grid is fixed for the life of the process — `HINT_GRID` (a flat digit string)
if set, otherwise `DEFAULT_PUZZLE`. That makes its output a pure function of the grid it was
started with. The eval harness relies on this: it spawns one process per state and never has
to reason about session bookkeeping. Move application, session state and generation-via-tools
are on the weekend's explicit cut list.

## buildHintServer(flatGrid) → McpServer

Exported separately from `main()` so tests can wire it to an in-memory transport instead of a
child process.

```text
solver = new HumanSolver(parseGrid(flatGrid))
tools  = createHintTools(solver)
server = new McpServer({ name: 'sudoku-hint' })
register get_grid_state            → text: tools.getGridState()
register list_available_deductions → text: JSON.stringify(tools.listAvailableDeductions())
RETURN server
```

## main()

Only runs when the file is the entrypoint (`require.main === module`) — importing the module
for tests must not start a transport. Connects the server to `StdioServerTransport`. Errors go
to stderr, never stdout, because stdout *is* the protocol channel.
