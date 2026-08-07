import { test, expect } from './fixtures';

/**
 * Today is browsable in the archive but must not be STARTED there. It used to start an unranked
 * practice run of the live board — and, because a replay calls `startNewGame`, could erase an
 * in-progress ranked attempt from the single saved slot.
 */
test.describe('Archive hands today off to the ranked daily', () => {
  test('today offers a ranked hand-off, not a practice start', async ({ page }) => {
    await page.goto('/archive');
    // Default selection is today, so the primary action must be the hand-off.
    await expect(page.getByRole('link', { name: /on the Daily \(ranked\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\(practice\)$/ })).toHaveCount(0);
  });

  test('the hand-off carries the chosen slot through to /daily', async ({ page }) => {
    await page.goto('/archive');
    const handoff = page.getByRole('link', { name: /on the Daily \(ranked\)/i });
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
    await expect(page.getByRole('link', { name: /on the Daily \(ranked\)/i })).toHaveCount(0);
  });

  test('a stale or garbage slot self-corrects instead of breaking', async ({ page }) => {
    // The seed is deliberately unvalidated: /daily's slots effect keeps the current key only if
    // today actually rolled it. A retired key from an old bookmark must fall back, not error.
    await page.goto('/daily?slot=not-a-real-slot');
    await expect(page.getByRole('button', { name: /^Play .+/ })).toBeVisible();
    await expect(page.getByText(/error|something went wrong/i)).toHaveCount(0);
  });
});
