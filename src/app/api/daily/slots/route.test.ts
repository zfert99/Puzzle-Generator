// @vitest-environment node
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The DB is mocked at the boundary; the service query (`getDailySlotRows`) and the route's own
// mapping/sorting logic run for real. (`@/lib/db/client` also imports `server-only`, which throws
// outside Next's build.) `selections` records what the query asked Postgres for.
const rows: { key: string; variant: string; gridSize: number }[] = [];
const selections: Record<string, unknown>[] = [];
vi.mock('@/lib/db/client', () => ({
  db: {
    select: (selection: Record<string, unknown>) => {
      selections.push(selection);
      return { from: () => ({ where: async () => rows }) };
    },
  },
}));

import { GET } from './route';

function buildRequest(search = ''): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/daily/slots${search}`) } as unknown as NextRequest;
}

function setRows(next: { key: string; variant: string; size: number }[]): void {
  rows.length = 0;
  rows.push(...next.map((r) => ({ key: r.key, variant: r.variant, gridSize: r.size })));
}

describe('GET /api/daily/slots', () => {
  it("maps today's rolled slots to labelled metadata, standard before minis", async () => {
    setRows([
      { key: 'mini-hard', variant: 'killer', size: 6 },
      { key: 'hard', variant: 'killer', size: 9 },
      { key: 'mini-easy', variant: 'calc', size: 4 },
      { key: 'easy', variant: 'classic', size: 9 },
    ]);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const { slots } = await res.json();

    expect(slots.map((s: { key: string }) => s.key)).toEqual(['easy', 'hard', 'mini-easy', 'mini-hard']);
    expect(slots[1]).toMatchObject({ key: 'hard', variant: 'killer', difficulty: 'hard', gridSize: 9, section: 'standard' });
    expect(slots[3]).toMatchObject({ key: 'mini-hard', variant: 'killer', difficulty: 'hard', gridSize: 6, section: 'mini' });
  });

  it('files a 6×6 Skyscrapers under a rung key as a STANDARD — the first non-9×9 standard (D5)', async () => {
    setRows([
      { key: 'hard', variant: 'skyscrapers', size: 6 },
      { key: 'mini-hard', variant: 'kakuro', size: 6 },
    ]);
    const { slots } = await (await GET(buildRequest())).json();
    expect(slots[0]).toMatchObject({ key: 'hard', variant: 'skyscrapers', gridSize: 6, section: 'standard' });
    expect(slots[1]).toMatchObject({ key: 'mini-hard', variant: 'kakuro', gridSize: 6, section: 'mini' });
  });

  /**
   * Regression: for RETIRED keys `section` must come from the grid size, not the key prefix. Keying
   * off the prefix filed every retired mini (`mini4-*`, `killer6-*`, `calc4-*`) under Standard — and
   * since the shared `slotLabel` only shows a board's size for minis, an archived day rendered several
   * indistinguishable "Medium · Classic" pills. Archived dates are the permanent case, so this is
   * not a cutover-only concern. (Active keys decide by key since D5 — see the test above.)
   */
  it('classifies RETIRED mini keys as minis (so their size shows and labels stay distinct)', async () => {
    setRows([
      { key: 'mini4-medium', variant: 'classic', size: 4 },
      { key: 'mini6-medium', variant: 'classic', size: 6 },
      { key: 'killer6-hard', variant: 'killer', size: 6 },
      { key: 'calc4-easy', variant: 'calc', size: 4 },
      { key: 'killer-hard', variant: 'killer', size: 9 }, // retired but genuinely 9×9 -> standard
    ]);

    const { slots } = await (await GET(buildRequest())).json();
    const bySection = (s: string) =>
      slots.filter((x: { section: string }) => x.section === s).map((x: { key: string }) => x.key);

    expect(bySection('mini').sort()).toEqual(['calc4-easy', 'killer6-hard', 'mini4-medium', 'mini6-medium']);
    expect(bySection('standard')).toEqual(['killer-hard']);
    // Retired keys still resolve to their real rung (drives the label + the profile lookups).
    const medium4 = slots.find((s: { key: string }) => s.key === 'mini4-medium');
    expect(medium4).toMatchObject({ difficulty: 'medium', gridSize: 4 });
  });

  it('never leaks grid or solution data', async () => {
    setRows([{ key: 'easy', variant: 'classic', size: 9 }]);
    const { slots } = await (await GET(buildRequest())).json();
    expect(slots[0]).not.toHaveProperty('grid');
    expect(slots[0]).not.toHaveProperty('solution');
    expect(Object.keys(slots[0]).sort()).toEqual(['difficulty', 'gridSize', 'key', 'section', 'variant']);
  });

  it('rejects a malformed date and a future date', async () => {
    setRows([]);
    expect((await GET(buildRequest('?date=nope'))).status).toBe(400);
    expect((await GET(buildRequest('?date=2999-01-01'))).status).toBe(400);
  });
});

describe('GET /api/daily/slots — query shape', () => {
  /**
   * The picker needs only each board's size. Selecting the `grid` jsonb to read `.length` in JS
   * shipped every cell of every board over the wire on each picker load; the size now comes from
   * `jsonb_array_length` in Postgres.
   */
  it('never selects the grid (or solution) column — only key, variant and a computed size', async () => {
    selections.length = 0;
    setRows([{ key: 'easy', variant: 'classic', size: 9 }]);

    await GET(buildRequest());

    expect(selections).toHaveLength(1);
    expect(Object.keys(selections[0]).sort()).toEqual(['gridSize', 'key', 'variant']);
  });
});

describe('GET /api/daily/slots — public caching only for past dates', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('marks a strictly-past day with boards publicly cacheable', async () => {
    setRows([{ key: 'easy', variant: 'classic', size: 9 }]);
    const res = await GET(buildRequest('?date=2026-10-01'));
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=86400');
  });

  it("does not publicly cache today's list, explicit or defaulted", async () => {
    setRows([{ key: 'easy', variant: 'classic', size: 9 }]);
    for (const search of ['', '?date=2026-10-02']) {
      const res = await GET(buildRequest(search));
      expect(res.headers.get('Cache-Control') ?? '').not.toContain('public');
    }
  });

  it('does not publicly cache an EMPTY past day — a cron miss awaiting backfill', async () => {
    setRows([]);
    const res = await GET(buildRequest('?date=2026-07-24'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control') ?? '').not.toContain('public');
  });
});
