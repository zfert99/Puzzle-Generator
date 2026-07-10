// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function buildBrokenRequest(): NextRequest {
  return { json: async () => { throw new Error('Invalid JSON'); } } as unknown as NextRequest;
}

describe('POST /api/puzzle — happy paths', () => {
  it('returns a valid 9x9 puzzle for a valid difficulty', async () => {
    const res = await POST(buildRequest({ difficulty: 'easy' }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.gridSize).toBe(9);
    expect(body.difficulty).toBe('easy');
    expect(body.grid).toHaveLength(9);
    expect(body.solution).toHaveLength(9);
    // The puzzle must be a subset of its own solution (givens match, holes are 0).
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (body.grid[r][c] !== 0) expect(body.grid[r][c]).toBe(body.solution[r][c]);
      }
    }
  }, 30_000);

  it('honours a mini grid size', async () => {
    const res = await POST(buildRequest({ difficulty: 'easy', gridSize: 4 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gridSize).toBe(4);
    expect(body.grid).toHaveLength(4);
  }, 30_000);

  it('generates an extreme 9x9 puzzle', async () => {
    const res = await POST(buildRequest({ difficulty: 'extreme', gridSize: 9 }));
    expect(res.status).toBe(200);
  }, 120_000);
});

describe('POST /api/puzzle — sad paths', () => {
  it('rejects a missing difficulty', async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown difficulty', async () => {
    const res = await POST(buildRequest({ difficulty: 'impossible' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid grid size', async () => {
    const res = await POST(buildRequest({ difficulty: 'easy', gridSize: 5 }));
    expect(res.status).toBe(400);
  });

  it('rejects Expert/Extreme on a mini grid', async () => {
    const res = await POST(buildRequest({ difficulty: 'expert', gridSize: 4 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/9x9/i);
  });

  it('handles a malformed body without crashing', async () => {
    const res = await POST(buildBrokenRequest());
    expect(res.status).toBe(400);
  });
});
