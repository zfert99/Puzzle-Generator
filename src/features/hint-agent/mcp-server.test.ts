import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildHintServer } from './mcp-server';
import { DEFAULT_PUZZLE } from './hint-tools';

async function connect(flatGrid: string) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = buildHintServer(flatGrid);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

function text(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as { type: string; text?: string }[];
  return content.map(c => c.text ?? '').join('');
}

describe('sudoku-hint MCP server', () => {
  it('exposes exactly the two tools', async () => {
    const client = await connect(DEFAULT_PUZZLE);
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual(['get_grid_state', 'list_available_deductions']);
  });

  it('serves the grid it was started with', async () => {
    const client = await connect(DEFAULT_PUZZLE);
    const state = text(await client.callTool({ name: 'get_grid_state', arguments: {} }));
    expect(state).toContain('1 . 6 7 |');
  });

  it('returns JSON deductions with strategy labels', async () => {
    const client = await connect(DEFAULT_PUZZLE);
    const raw = text(await client.callTool({ name: 'list_available_deductions', arguments: {} }));
    const deductions = JSON.parse(raw) as { strategy: string }[];
    expect(deductions.some(d => d.strategy === 'Hidden Single')).toBe(true);
  });

  it('returns an empty list for a solved grid', async () => {
    const solved = '167582493352419768849376251684195372231768945795243186928637514473851629516924837';
    const client = await connect(solved);
    const raw = text(await client.callTool({ name: 'list_available_deductions', arguments: {} }));
    expect(JSON.parse(raw)).toEqual([]);
  });
});
