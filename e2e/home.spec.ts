import { test, expect } from '@playwright/test';

/**
 * Smoke-level end-to-end coverage of the landing page and the puzzle-configuration
 * form. These drive the real app in a real browser (via the webServer in
 * playwright.config.ts) and assert user-visible behaviour with accessibility-first
 * locators — the same querying discipline the unit tests use (AGENTS.md Section 4).
 */
test.describe('Home page', () => {
  test('renders the generator landing page and configuration form', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /pdf puzzle generator/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /sudoku configuration/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /generate pdf/i })).toBeVisible();
  });

  test('disables Expert and Extreme when a mini grid size is selected', async ({ page }) => {
    await page.goto('/');

    // Switching to a 4x4 grid must disable the 9x9-only difficulties.
    await page.getByRole('button', { name: '4×4' }).click();

    const spinButtons = page.getByRole('spinbutton');
    // Order: easy, medium, hard, expert, extreme
    await expect(spinButtons.nth(3)).toBeDisabled(); // expert
    await expect(spinButtons.nth(4)).toBeDisabled(); // extreme
    await expect(page.getByText(/only available for 9×9 grids/i)).toBeVisible();
  });
});
