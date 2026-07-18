import { test, expect } from '@playwright/test';

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
    // The hub's core cards link to the app's surfaces.
    await expect(page.getByRole('link', { name: /free play/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /print packs/i })).toBeVisible();
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
