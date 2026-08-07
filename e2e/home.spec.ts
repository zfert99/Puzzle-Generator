import { test, expect } from './fixtures';

/**
 * Smoke-level end-to-end coverage of the landing hub and the puzzle-configuration
 * form. These drive the real app in a real browser (via the webServer in
 * playwright.config.ts) and assert user-visible behaviour with accessibility-first
 * locators — the same querying discipline the unit tests use (AGENTS.md Section 4).
 *
 * Phase 5.4 made `/` the puzzle hub and moved the PDF generator to `/generate` —
 * these specs target that shipped layout.
 */
test.describe('Hub and generator', () => {
  test('renders the puzzle hub on the landing page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /puzzle lab/i })).toBeVisible();
    // The hub groups its cards under real <h2>s (Aug 2026 reorg) — assert the outline, not
    // just the links, since the grouping IS the feature.
    await expect(page.getByRole('heading', { name: 'Play', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compete', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Print', level: 2 })).toBeVisible();
    // One card per puzzle type — there is deliberately no "Free play" card; the type cards
    // are the free-play entry points.
    await expect(page.getByRole('link', { name: /sudoku/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /killer/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /keisan/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /free play/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /print packs/i })).toBeVisible();
  });

  test('the Killer card deep-links into play with Killer preselected', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /killer/i }).click();
    await expect(page).toHaveURL(/\/play\?variant=killer$/);

    await expect(page.getByRole('heading', { name: /new game/i })).toBeVisible();
    // Killer preselected: same layout as Sudoku — Grid Size selector (6/9 only) + full ladder.
    await expect(page.getByText('Grid Size')).toBeVisible();
    await expect(page.getByRole('button', { name: '9×9', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '4×4' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'easy', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'extreme', exact: true })).toBeEnabled();
  });

  test('renders the PDF generator form on /generate', async ({ page }) => {
    await page.goto('/generate');

    await expect(page.getByRole('heading', { name: /print packs/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate pdf/i })).toBeVisible();
  });

  test('disables Expert and Extreme when a mini grid size is selected', async ({ page }) => {
    await page.goto('/generate');

    // Switching to a 4x4 grid must disable the 9x9-only difficulties.
    await page.getByRole('button', { name: '4×4' }).click();

    const spinButtons = page.getByRole('spinbutton');
    // Order: easy, medium, hard, expert, extreme
    await expect(spinButtons.nth(3)).toBeDisabled(); // expert
    await expect(spinButtons.nth(4)).toBeDisabled(); // extreme
    await expect(page.getByText(/only available for 9×9 grids/i)).toBeVisible();
  });
});
