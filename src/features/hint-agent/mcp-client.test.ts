import { describe, it, expect } from 'vitest';
import { connectHintServer, createInProcessHintClient } from './mcp-client';
import { DEFAULT_PUZZLE } from './hint-tools';

describe('hint tool clients', () => {
  it('the stdio client spawns the server for the given grid and returns the same answers as in-process', async () => {
    const solved = '167582493352419768849376251684195372231768945795243186928637514473851629516924837';
    const remote = await connectHintServer(solved);
    try {
      expect(remote.tools.map(t => t.name).sort()).toEqual(['get_grid_state', 'list_available_deductions']);
      const local = createInProcessHintClient(solved);
      expect(await remote.callTool('list_available_deductions', {})).toBe(await local.callTool('list_available_deductions', {}));
      expect(await remote.callTool('get_grid_state', {})).toBe(await local.callTool('get_grid_state', {}));
    } finally {
      await remote.close();
    }
  }, 30_000);

  it('the in-process client rejects unknown tools', async () => {
    await expect(createInProcessHintClient(DEFAULT_PUZZLE).callTool('nope', {})).rejects.toThrow(/Unknown tool/);
  });
});
