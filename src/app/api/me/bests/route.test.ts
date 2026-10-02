// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { UnauthorizedError } from '@/features/auth/errors';

// Boundaries only (AGENTS.md §4): the session (no real cookie), the DB client (its real module
// imports `server-only`), the bests query, and the logger.
vi.mock('@/lib/db/client', () => ({ db: {} }));
const requireUserId = vi.fn(async () => 'session-user');
vi.mock('@/features/auth/session', () => ({ requireUserId: () => requireUserId() }));
const getPersonalBests = vi.fn(async () => [{ difficulty: 'hard', variant: 'classic', gridSize: 9, bestMs: 61_000 }]);
vi.mock('@/features/leaderboards/attempts.service', () => ({
  getPersonalBests: (...args: unknown[]) => getPersonalBests(...(args as [])),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { GET } from './route';

/**
 * The handler takes no request at all — the strongest form of "no `?userId=`". It is still called
 * WITH an attacker-shaped request here, as Next would, so that a future signature change that starts
 * reading the query string would be caught by these assertions rather than slip through.
 */
const callWith = GET as unknown as (req: NextRequest) => Promise<Response>;
function buildRequest(search: string): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/me/bests${search}`) } as unknown as NextRequest;
}

describe('GET /api/me/bests — BOLA', () => {
  // A call-history assertion is vacuous without clearing between tests (Docs/pre-merge-log.md).
  beforeEach(() => getPersonalBests.mockClear());

  it('ignores a ?userId= query param and reads only the SESSION user', async () => {
    const res = await callWith(buildRequest('?userId=someone-else'));

    expect(res.status).toBe(200);
    expect(getPersonalBests).toHaveBeenCalledTimes(1);
    expect(getPersonalBests).toHaveBeenCalledWith({}, 'session-user');
    expect(JSON.stringify(getPersonalBests.mock.calls)).not.toContain('someone-else');
  });

  it('401s when signed out, even with a ?userId= supplied, and never reaches the query', async () => {
    requireUserId.mockRejectedValueOnce(new UnauthorizedError());

    const res = await callWith(buildRequest('?userId=someone-else'));

    expect(res.status).toBe(401);
    expect(getPersonalBests).not.toHaveBeenCalled();
  });
});
