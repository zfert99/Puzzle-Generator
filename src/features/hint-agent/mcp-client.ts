import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { HumanSolver } from '@/features/engine/human-solver';
import { createHintTools, parseGrid, HINT_TOOL_DEFINITIONS, type HintToolName } from './hint-tools';

const SERVER_ENTRY = path.resolve(__dirname, 'mcp-server.ts');

/**
 * A connected hint server: the Anthropic-shaped tool list plus a way to call
 * one. Kept transport-agnostic so the agent loop and its tests never touch the
 * MCP SDK directly.
 */
export interface HintToolClient {
  tools: Anthropic.Tool[];
  callTool: (name: string, input: unknown) => Promise<string>;
  close: () => Promise<void>;
}

/**
 * Spawns `mcp-server.ts` for one grid over stdio and exposes its tools in the
 * shape the Messages API expects. The grid rides in on `HINT_GRID` because the
 * server is deliberately stateless — one process, one position — so the eval
 * harness gets a fresh oracle per state with no session bookkeeping to get wrong.
 *
 * `getDefaultEnvironment()` is spread in explicitly: passing `env` to the
 * transport replaces the inherited environment rather than extending it, and
 * without PATH the `npx tsx` spawn fails silently.
 */
export async function connectHintServer(flatGrid: string): Promise<HintToolClient> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', SERVER_ENTRY],
    env: { ...getDefaultEnvironment(), HINT_GRID: flatGrid },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'sudoku-hint-agent', version: '0.1.0' });
  await client.connect(transport);

  const { tools } = await client.listTools();
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
    })),
    callTool: async (name, input) => {
      const result = await client.callTool({ name, arguments: (input ?? {}) as Record<string, unknown> });
      const content = result.content as { type: string; text?: string }[];
      return content.map(block => block.text ?? '').join('');
    },
    close: () => client.close(),
  };
}

/**
 * The same tool contract served in-process, with no child process. Used by
 * tests and by anything that wants the oracle without stdio round-trips; the
 * agent loop cannot tell the two apart, which is the point.
 */
export function createInProcessHintClient(flatGrid: string): HintToolClient {
  const tools = createHintTools(new HumanSolver(parseGrid(flatGrid)));
  const bodies: Record<HintToolName, () => string> = {
    get_grid_state: () => tools.getGridState(),
    list_available_deductions: () => JSON.stringify(tools.listAvailableDeductions(), null, 2),
  };
  return {
    tools: (Object.keys(HINT_TOOL_DEFINITIONS) as HintToolName[]).map(name => ({
      name,
      description: HINT_TOOL_DEFINITIONS[name].description,
      input_schema: { type: 'object', properties: {} },
    })),
    callTool: async name => {
      const body = bodies[name as HintToolName];
      if (!body) throw new Error(`Unknown tool ${name}`);
      return body();
    },
    close: async () => {},
  };
}
