# Hint Tool Clients: Plain English Pseudocode

Companion to [`mcp-client.ts`](file:///Users/morp/Documents/GitHub/Puzzle-Generator/src/features/hint-agent/mcp-client.ts).

## The shape both clients share

`HintToolClient` is `{ tools, callTool, close }` — the tool list already in the Messages API's
`Anthropic.Tool` shape, and a `callTool` that returns the tool's text. The agent loop only ever
sees this interface, so it cannot tell a spawned MCP server from an in-process function table.
That is deliberate: the tests drive the loop with the in-process client, and the live run uses
the real server, with no branch in the loop itself.

## connectHintServer(flatGrid) → HintToolClient

Spawns `mcp-server.ts` via `npx tsx` with `HINT_GRID` in its environment and speaks MCP over
stdio.

**Gotcha recorded here:** passing `env` to `StdioClientTransport` *replaces* the inherited
environment rather than extending it. Without spreading `getDefaultEnvironment()` first, the
child has no `PATH` and the spawn fails with nothing useful on stderr.

```text
transport = StdioClientTransport({ command: 'npx', args: ['tsx', mcp-server.ts],
                                   env: { ...defaultEnvironment, HINT_GRID: flatGrid } })
client.connect(transport)
tools = client.listTools() mapped to { name, description, input_schema }
callTool(name, input) = join the text blocks of client.callTool(...)
```

## createInProcessHintClient(flatGrid) → HintToolClient

Same contract, no child process: `HINT_TOOL_DEFINITIONS` for the tool list, `createHintTools`
for the bodies. Used by the agent tests. `mcp-client.test.ts` asserts the two clients return
byte-identical tool output for the same grid.
