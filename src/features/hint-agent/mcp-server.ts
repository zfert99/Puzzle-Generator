import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HumanSolver } from '@/features/engine/human-solver';
import { createHintTools, parseGrid, DEFAULT_PUZZLE, HINT_TOOL_DEFINITIONS } from './hint-tools';

/**
 * Stdio MCP server exposing the Sudoku engine's deduction oracle as two tools.
 * The grid it serves is fixed for the life of the process: `HINT_GRID` (a flat
 * digit string) if set, otherwise the frozen default puzzle. There is
 * deliberately no "apply move" tool — the server answers "what can I do next?"
 * and nothing else, so its output is a pure function of the grid it was started
 * with. Run with `npm run mcp:hint`.
 */
export function buildHintServer(flatGrid: string): McpServer {
  const solver = new HumanSolver(parseGrid(flatGrid));
  const tools = createHintTools(solver);

  const server = new McpServer({ name: 'sudoku-hint', version: '0.1.0' });

  server.registerTool(
    'get_grid_state',
    { ...HINT_TOOL_DEFINITIONS.get_grid_state, inputSchema: {} },
    async () => ({ content: [{ type: 'text', text: tools.getGridState() }] }),
  );

  server.registerTool(
    'list_available_deductions',
    { ...HINT_TOOL_DEFINITIONS.list_available_deductions, inputSchema: {} },
    async () => ({ content: [{ type: 'text', text: JSON.stringify(tools.listAvailableDeductions(), null, 2) }] }),
  );

  return server;
}

async function main() {
  const server = buildHintServer(process.env.HINT_GRID ?? DEFAULT_PUZZLE);
  await server.connect(new StdioServerTransport());
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`sudoku-hint MCP server failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
