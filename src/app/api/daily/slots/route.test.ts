// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The DB is mocked at the boundary; the route's own mapping/sorting logic runs for real.
// (`@/lib/db/client` also imports `server-only`, which throws outside Next's build.)
const rows: { key: string; variant: string; grid: number[][] }[] = [];
vi.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => rows }) }),
  },
}));

import { GET } from './route';

function buildRequest(search = ''): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/daily/slots${search}`) } as unknown as NextRequest;
}

const grid = (size: number) => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

function setRows(next: { key: string; variant: string; size: number }[]): void {
  rows.length = 0;
  rows.push(...next.map((r) => ({ key: r.key, variant: r.variant, grid: grid(r.size) })));
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

  /**
   * Regression: `section` must come from the GRID SIZE, not a `mini-` key prefix. Keying off the
   * prefix filed every retired mini (`mini4-*`, `killer6-*`, `calc4-*`) under Standard — and since
   * the shared `slotLabel` only shows a board's size for minis, an archived day rendered several
   * indistinguishable "Medium · Classic" pills. Archived dates are the permanent case, so this is
   * not a cutover-only concern.
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
