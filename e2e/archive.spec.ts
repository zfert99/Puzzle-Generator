import { test, expect, todayHasBoards } from './fixtures';

/**
 * Today is browsable in the archive but must not be STARTED there. It used to start an unranked
 * practice run of the live board — and, because a replay calls `startNewGame`, could erase an
 * in-progress ranked attempt from the single saved slot.
 */
test.describe('Archive hands today off to the ranked daily', () => {
  /**
   * Gated on TODAY ACTUALLY HAVING BOARDS, not on a database being configured. Those are different
   * conditions and the difference is not hypothetical: 2026-08-11 had a real database and **zero**
   * boards (the roller had not run), so a `HAS_DATABASE` gate would have run these against the
   * empty state and failed. CI without a database lands in the same place for a different reason.
   */
  test.beforeEach(async ({ request }) => {
    test.skip(!(await todayHasBoards(request)), 'today has no daily boards — nothing to hand off to');
  });

  test('today offers a ranked hand-off, not a practice start', async ({ page }) => {
    await page.goto('/archive');
    // Default selection is today, so the primary action must be the hand-off.
    await expect(page.getByRole('link', { name: /^Daily .+\(ranked\)$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\(practice\)$/ })).toHaveCount(0);
  });

  test('the hand-off carries the chosen slot through to /daily', async ({ page }) => {
    await page.goto('/archive');
    const handoff = page.getByRole('link', { name: /^Daily .+\(ranked\)$/i });
    const href = await handoff.getAttribute('href');
    expect(href).toMatch(/\/daily\?slot=/);

    await handoff.click();
    await expect(page).toHaveURL(/\/daily\?slot=/);
    // The slot arrives preselected: /daily's Play button names the same board.
    await expect(page.getByRole('button', { name: /^Play .+/ })).toBeVisible();
  });

  test('a past day still starts a practice replay', async ({ page }) => {
    await page.goto('/archive');
    // Step back a month — every day there is in the past regardless of today's date.
    await page.getByRole('button', { name: /previous month/i }).click();
    const anyDay = page.getByRole('button', { name: '15', exact: true });
    await anyDay.click();
    await expect(page.getByRole('button', { name: /\(practice\)$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Daily .+\(ranked\)$/i })).toHaveCount(0);
  });

  test('a stale or garbage slot self-corrects instead of breaking', async ({ page }) => {
    // The seed is deliberately unvalidated: /daily's slots effect keeps the current key only if
    // today actually rolled it. A retired key from an old bookmark must fall back, not error.
    await page.goto('/daily?slot=not-a-real-slot');
    await expect(page.getByRole('button', { name: /^Play .+/ })).toBeVisible();
    await expect(page.getByText(/error|something went wrong/i)).toHaveCount(0);
  });

  test('the hand-off never points at a board the label does not name', async ({ page }) => {
    // Regression for a review finding: `difficulty` starts at the hardcoded 'easy', but the
    // standard rungs roll — 2026-08-03 rolled hard/expert/extreme with no `easy` — so an
    // ungated link could read one board and navigate to another. Whatever the link says, its
    // slot must be one today actually rolled.
    await page.route('**/api/daily/slots*', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.slots = body.slots.filter((x: { key: string }) => x.key !== 'easy');
      await route.fulfill({ response: res, body: JSON.stringify(body) });
    });
    await page.goto('/archive');
    const handoff = page.getByRole('link', { name: /^Daily .+\(ranked\)$/i });
    await expect(handoff).toBeVisible();

    const href = await handoff.getAttribute('href');
    const slot = new URL(href!, 'http://localhost').searchParams.get('slot');

    const slots: string[] = await page.evaluate(async () => {
      const r = await fetch('/puzzles/api/daily/slots');
      const d = await r.json();
      return d.slots.map((s: { key: string }) => s.key);
    });
    expect(slots).toContain(slot);
  });
});

/**
 * Deliberately its own describe: the block above has a `beforeEach` that skips when today has no
 * boards, which is exactly the condition this test needs. Nested inside it, it could never run.
 */
test.describe('Archive on a day with no boards', () => {
  test('a day with no boards shows a note, never a stuck spinner', async ({ page, request }) => {
    // Runs in the opposite condition to the block above, so CI (no database → no boards) covers
    // this branch even though it can cover none of the others. Regression for a bug introduced
    // while fixing a review finding: the hand-off was first held back on `slots.length === 0`, and
    // `onSlotsLoaded` never fired for an empty day — so a boardless day sat on "Loading…" forever.
    test.skip(await todayHasBoards(request), 'today has boards — the empty state is not reachable');

    await page.goto('/archive');
    await expect(page.getByText(/haven.t been generated yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Loading…' })).toHaveCount(0);
  });
});
