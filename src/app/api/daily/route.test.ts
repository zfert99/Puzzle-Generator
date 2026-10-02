// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Boundaries only (AGENTS.md §4): the DB client (never touched — the service is mocked) and the
// dailies service, which is where a stored row comes from.
vi.mock('@/lib/db/client', () => ({ db: {} }));
const getDailyPuzzle = vi.fn();
vi.mock('@/features/dailies/dailies.service', () => ({ getDailyPuzzle: (...args: unknown[]) => getDailyPuzzle(...args) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { GET } from './route';

function buildRequest(search = '?difficulty=hard'): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/daily${search}`) } as unknown as NextRequest;
}

const grid = (size: number, fill = 0) => Array.from({ length: size }, () => Array<number>(size).fill(fill));
const row = (variant: string, cages: unknown) => ({
  date: '2026-10-01',
  difficulty: 'hard',
  variant,
  grid: grid(variant === 'kakuro' ? 6 : variant === 'skyscrapers' ? 5 : 9),
  solution: grid(variant === 'kakuro' ? 6 : variant === 'skyscrapers' ? 5 : 9, 1),
  clueCount: 3,
  cages,
});

/**
 * The one place a stored row becomes a board: the `variant` column decides whether the `cages`
 * jsonb comes back as `cages` (Killer/Keisan) or `runs` (Kakuro — R1), or not at all (classic).
 * Fold the branches together and the first Kakuro daily starts as a classic board of zeros.
 */
describe('GET /api/daily — payload shape per variant', () => {
  beforeEach(() => getDailyPuzzle.mockReset());

  it('serves a Kakuro row with its stored runs under `runs`, not `cages`', async () => {
    const runs = [{ id: 0, dir: 'across', sum: 3, cells: [0, 1] }];
    getDailyPuzzle.mockResolvedValue(row('kakuro', runs));
    const body = await (await GET(buildRequest())).json();
    expect(body).toMatchObject({ variant: 'kakuro', runs, gridSize: 6 });
    expect(body.cages).toBeUndefined();
  });

  it('serves a Skyscrapers row with its stored clues restored to the four gutter arrays (R1, D2)', async () => {
    getDailyPuzzle.mockResolvedValue(row('skyscrapers', [{ side: 'top', index: 1, count: 3 }, { side: 'right', index: 4, count: 1 }]));
    const body = await (await GET(buildRequest('?difficulty=hard'))).json();
    expect(body).toMatchObject({ variant: 'skyscrapers', gridSize: 5, clues: { top: [0, 3, 0, 0, 0], bottom: [0, 0, 0, 0, 0], left: [0, 0, 0, 0, 0], right: [0, 0, 0, 0, 1] } });
    expect(body.cages).toBeUndefined();
    expect(body.runs).toBeUndefined();
  });

  it('serves Killer and Keisan rows with `cages`, and a classic row with neither', async () => {
    const cages = [{ id: 0, sum: 3, cells: [0, 1] }];
    for (const variant of ['killer', 'calc']) {
      getDailyPuzzle.mockResolvedValue(row(variant, cages));
      const body = await (await GET(buildRequest())).json();
      expect(body).toMatchObject({ variant, cages });
      expect(body.runs).toBeUndefined();
    }
    getDailyPuzzle.mockResolvedValue(row('classic', null));
    const body = await (await GET(buildRequest())).json();
    expect(body.variant).toBeUndefined();
    expect(body.cages).toBeUndefined();
    expect(body.runs).toBeUndefined();
  });

  it('404s when the day has no such board', async () => {
    getDailyPuzzle.mockResolvedValue(null);
    expect((await GET(buildRequest())).status).toBe(404);
  });
});
