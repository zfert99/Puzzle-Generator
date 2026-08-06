// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocked at the boundary (the DB and the session), so the route's own validation runs for real.
// `@/lib/db/client` also imports `server-only`, which throws outside Next's build.
vi.mock('@/lib/db/client', () => ({ db: {} }));

const getDailyPuzzle = vi.fn();
vi.mock('@/features/dailies/dailies.service', () => ({
  getDailyPuzzle: (...args: unknown[]) => getDailyPuzzle(...args),
}));

// Typed via the generic rather than an unused rest param, so the mocks accept the route's
// arguments without tripping `no-unused-vars`.
const getLeaderboard = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []);
const getUserRank = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null);
vi.mock('@/features/leaderboards/leaderboard.service', () => ({
  getLeaderboard: (...args: unknown[]) => getLeaderboard(...args),
  getUserRank: (...args: unknown[]) => getUserRank(...args),
}));

const getCurrentUserId = vi.fn<() => Promise<string | null>>(async () => null);
vi.mock('@/features/auth/session', () => ({ getCurrentUserId: () => getCurrentUserId() }));

import { GET } from './route';

function buildRequest(search: string): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/leaderboard${search}`) } as unknown as NextRequest;
}

beforeEach(() => {
  // Without this the "never reached the database" assertions below are vacuous.
  getDailyPuzzle.mockClear();
  getLeaderboard.mockClear();
  getUserRank.mockClear();
  getCurrentUserId.mockClear();
  getCurrentUserId.mockResolvedValue(null);
  getDailyPuzzle.mockResolvedValue({ id: 'p1', date: '2026-08-05', difficulty: 'easy' });
});

describe('GET /api/leaderboard date validation', () => {
  /**
   * Regression: `/^\d{4}-\d{2}-\d{2}$/` tested the SHAPE of the date, so a well-formed non-date
   * passed validation, was compared against a Postgres `date`, and the driver threw — a 500 with a
   * stack trace, from input the route had already accepted. This route is the worst case of the
   * three that took a `?date=`: it has no future-date guard, so even `9999-99-99` got through
   * (the other two were saved incidentally by their `isoDate > todayIso` string comparison).
   */
  it.each(['2026-02-31', '2026-02-29', '2026-00-10', '2026-01-32', '9999-99-99', '0000-01-01'])(
    'rejects %s with 400 and never reaches the database',
    async (date) => {
      const res = await GET(buildRequest(`?difficulty=easy&date=${date}`));

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('Invalid date') });
      expect(getDailyPuzzle).not.toHaveBeenCalled();
    },
  );

  it('still serves a real date that simply has no puzzles (404, not 400)', async () => {
    getDailyPuzzle.mockResolvedValue(undefined);

    const res = await GET(buildRequest('?difficulty=easy&date=1999-12-31'));

    expect(res.status).toBe(404);
    expect(getDailyPuzzle).toHaveBeenCalledWith(expect.anything(), '1999-12-31', 'easy');
  });

  it('serves a real date that does have a puzzle', async () => {
    const res = await GET(buildRequest('?difficulty=easy&date=2024-02-29'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ date: '2024-02-29', difficulty: 'easy' });
    expect(getLeaderboard).toHaveBeenCalledOnce();
  });
});

/**
 * The board no longer ships each player's account id, so "which row is you?" is decided on the
 * server. The id it decides with has to be the SESSION's — taking it from the request would let a
 * caller ask which row belongs to someone else, the same BOLA rule the rest of this feature keeps.
 */
describe('GET /api/leaderboard viewer identity', () => {
  it('passes the session user id to the board query', async () => {
    getCurrentUserId.mockResolvedValue('user-A');

    await GET(buildRequest('?difficulty=easy'));

    expect(getLeaderboard).toHaveBeenCalledWith(expect.anything(), 'p1', 'user-A');
  });

  it('passes null when signed out, so no row can be marked as the viewer', async () => {
    await GET(buildRequest('?difficulty=easy'));

    expect(getLeaderboard).toHaveBeenCalledWith(expect.anything(), 'p1', null);
  });

  it('ignores a ?userId= in the query and still uses the session id', async () => {
    getCurrentUserId.mockResolvedValue('user-A');

    await GET(buildRequest('?difficulty=easy&userId=user-B'));

    expect(getLeaderboard).toHaveBeenCalledWith(expect.anything(), 'p1', 'user-A');
    expect(getUserRank).toHaveBeenCalledWith(expect.anything(), 'p1', 'user-A');
  });
});
