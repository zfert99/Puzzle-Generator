// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mocked at the boundary: `@/lib/db/client` (its real module imports `server-only`, which throws
// outside Next's build) and the service query. The route's own month validation runs for real.
vi.mock('@/lib/db/client', () => ({ db: {} }));

let month: { days: string[]; first: string | null } = { days: [], first: null };
const getArchiveMonth = vi.fn(async () => month);
vi.mock('@/features/dailies/dailies.service', () => ({
  getArchiveMonth: (...args: unknown[]) => getArchiveMonth(...(args as [])),
}));

import { GET } from './route';

function buildRequest(search = '?month=2026-07'): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/daily/days${search}`) } as unknown as NextRequest;
}

beforeEach(() => {
  // A call-history assertion in a file with no `mockClear` is presumed vacuous
  // (Docs/pre-merge-log.md) — the 400 case below asserts the data layer was never reached.
  getArchiveMonth.mockClear();
  month = { days: [], first: null };
});

describe('GET /api/daily/days', () => {
  /**
   * The real archive is not a contiguous range: boards begin 2026-07-11 and 2026-07-24 holds none
   * (the cron missed it). The calendar therefore cannot derive availability from a lower bound —
   * it needs the actual days, holes included, which is this endpoint's whole reason to exist.
   */
  it('returns the days that hold boards, preserving gaps inside the range', async () => {
    month = { days: ['2026-07-11', '2026-07-12', '2026-07-25'], first: '2026-07-11' };

    const res = await GET(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ month: '2026-07', first: '2026-07-11', days: ['2026-07-11', '2026-07-12', '2026-07-25'] });
  });

  it('returns an empty list for a month before the archive began', async () => {
    month = { days: [], first: '2026-07-11' };

    const body = await (await GET(buildRequest('?month=2026-06'))).json();

    // `first` still comes back, so the calendar can bound paging even from an empty month.
    expect(body).toEqual({ month: '2026-06', first: '2026-07-11', days: [] });
  });

  it('defaults to the current month when none is given', async () => {
    const body = await (await GET(buildRequest(''))).json();
    expect(body.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  /**
   * `?month=` (present but empty) is a malformed value, NOT an absent param: `searchParams.get`
   * returns `''`, which `?? today` does not replace. So it 400s while omitting the param entirely
   * defaults — the case above. Same `??` semantics as `/api/me/progress`.
   */
  it.each(['2026-13', '2026-00', '2026-7', 'july', '2026-07-11', ''])(
    'rejects the malformed month %p before touching the data layer',
    async (value) => {
      const res = await GET(buildRequest(`?month=${value}`));

      expect(res.status).toBe(400);
      expect(getArchiveMonth).not.toHaveBeenCalled();
    },
  );
});
