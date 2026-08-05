// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { UnauthorizedError } from '@/features/auth/errors';

// Mocked at the boundary only: the session (so no real cookie is needed), `@/lib/db/client`
// (its real module imports `server-only`, which throws outside Next's build), and the service
// query. The route's own folding — size → section, per-date accumulation — runs for real.
vi.mock('@/lib/db/client', () => ({ db: {} }));
const requireUserId = vi.fn(async () => 'test-user-id');
vi.mock('@/features/auth/session', () => ({ requireUserId: () => requireUserId() }));

const progressRows: { date: string; gridSize: number; total: number; done: number }[] = [];
const getDailyProgress = vi.fn(async () => progressRows);
vi.mock('@/features/leaderboards/attempts.service', () => ({
  getDailyProgress: (...args: unknown[]) => getDailyProgress(...(args as [])),
}));

import { GET } from './route';

function buildRequest(search = ''): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/me/progress${search}`) } as unknown as NextRequest;
}

function setRows(next: typeof progressRows): void {
  progressRows.length = 0;
  progressRows.push(...next);
}

describe('GET /api/me/progress', () => {
  // Call history must not leak between tests: the 401 case asserts the data layer was NEVER
  // reached, which a call recorded by an earlier test would silently satisfy.
  beforeEach(() => {
    getDailyProgress.mockClear();
  });

  it('folds board sizes into the Standard and Mini sets, per date', async () => {
    setRows([
      { date: '2026-08-01', gridSize: 9, total: 3, done: 2 },
      { date: '2026-08-01', gridSize: 4, total: 2, done: 1 },
      { date: '2026-08-01', gridSize: 6, total: 1, done: 1 },
      { date: '2026-08-02', gridSize: 9, total: 3, done: 0 },
    ]);

    const res = await GET(buildRequest('?month=2026-08'));
    expect(res.status).toBe(200);
    const { month, days } = await res.json();

    expect(month).toBe('2026-08');
    // Both mini sizes land in one set; the standard set stays separate.
    expect(days['2026-08-01']).toEqual({ standard: { done: 2, total: 3 }, mini: { done: 2, total: 3 } });
    // A day the user completed nothing on still reports its denominator (0/3), not nothing.
    expect(days['2026-08-02']).toEqual({ standard: { done: 0, total: 3 }, mini: { done: 0, total: 0 } });
  });

  /**
   * The denominator is counted from the day's real rows, never assumed to be 3. Archived dates
   * predating the restructure held 30 boards, and the count grows to 5 per set as puzzle types
   * are added — a hardcoded N would misreport both.
   */
  it('uses the day’s own board count as N, including pre-restructure days', async () => {
    setRows([
      { date: '2026-07-15', gridSize: 9, total: 15, done: 4 },
      { date: '2026-07-15', gridSize: 4, total: 9, done: 1 },
      { date: '2026-07-15', gridSize: 6, total: 6, done: 0 },
    ]);

    const { days } = await (await GET(buildRequest('?month=2026-07'))).json();

    expect(days['2026-07-15']).toEqual({ standard: { done: 4, total: 15 }, mini: { done: 1, total: 15 } });
  });

  it('queries the full calendar month, including a 31-day and a leap February', async () => {
    setRows([]);

    await GET(buildRequest('?month=2026-08'));
    expect(getDailyProgress).toHaveBeenLastCalledWith({}, 'test-user-id', '2026-08-01', '2026-08-31');

    await GET(buildRequest('?month=2028-02'));
    expect(getDailyProgress).toHaveBeenLastCalledWith({}, 'test-user-id', '2028-02-01', '2028-02-29');
  });

  it('rejects a malformed month', async () => {
    for (const bad of ['?month=2026-8', '?month=2026-13', '?month=2026-08-01', '?month=nope']) {
      const res = await GET(buildRequest(bad));
      expect(res.status).toBe(400);
    }
  });

  /**
   * Regression: `ISO_MONTH` validates the month's SHAPE, and `0000-01` has a valid shape. It used
   * to expand to the range `0000-01-01 … 0000-01-31`, which reached the `date` column and threw at
   * the driver — the SQL calendar runs 1 BC → AD 1, so there is no year zero. That is a 500 (with a
   * stack in the logs) produced by input the route had already accepted, the same failure this
   * branch removed from the three `?date=` routes. `0001-01` is a real month and must still work,
   * so the guard has to reject the year, not the shape.
   */
  it('rejects year zero before it reaches the date column, but still serves year 0001', async () => {
    setRows([]);

    const yearZero = await GET(buildRequest('?month=0000-01'));
    expect(yearZero.status).toBe(400);
    expect(getDailyProgress).not.toHaveBeenCalled();

    const yearOne = await GET(buildRequest('?month=0001-01'));
    expect(yearOne.status).toBe(200);
    expect(getDailyProgress).toHaveBeenCalledWith({}, 'test-user-id', '0001-01-01', '0001-01-31');
  });

  it('requires a session (401) and never reaches the data layer without one', async () => {
    requireUserId.mockRejectedValueOnce(new UnauthorizedError());

    const res = await GET(buildRequest('?month=2026-08&userId=someone-else'));

    expect(res.status).toBe(401);
    // Authorize BEFORE anything else: a signed-out request must not touch the query at all, and
    // the `?userId=` here must not become an identity. `mockClear` in beforeEach is what gives
    // this assertion teeth — otherwise an earlier test's call would satisfy it vacuously.
    expect(getDailyProgress).not.toHaveBeenCalled();
  });

  it('only ever passes the SESSION id to the data layer, never a request parameter', async () => {
    setRows([]);

    await GET(buildRequest('?month=2026-08&userId=someone-else'));

    // BOLA (AGENTS.md §6): the id is server-supplied. Reading it from the request — even as a
    // fallback — would show up here as the attacker-chosen value.
    expect(getDailyProgress).toHaveBeenCalledWith({}, 'test-user-id', '2026-08-01', '2026-08-31');
  });
});
