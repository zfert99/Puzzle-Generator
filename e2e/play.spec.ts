import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage of the interactive board flow (Phase 3): navigate in, generate
 * a real puzzle via /api/puzzle, and interact with the board in a real browser.
 */
test.describe('Interactive play', () => {
  test('links from the landing page into play mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /play online/i }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByRole('heading', { name: /new game/i })).toBeVisible();
  });

  test('generates a 4x4 board and accepts a digit', async ({ page }) => {
    await page.goto('/play');

    await page.getByRole('button', { name: '4×4' }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();

    const grid = page.getByRole('grid', { name: /sudoku board/i });
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('gridcell')).toHaveCount(16);

    // Select an empty cell and enter a digit; it must appear on the board.
    await grid.getByRole('gridcell', { name: /^Empty/ }).first().click();
    await page.keyboard.press('1');
    await expect(grid.getByRole('gridcell', { name: /value 1/i }).first()).toBeVisible();
  });

  test('can return from a game to the play menu', async ({ page }) => {
    await page.goto('/play');
    await page.getByRole('button', { name: '4×4' }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();
    await expect(page.getByRole('grid', { name: /sudoku board/i })).toBeVisible();

    await page.getByRole('button', { name: /new game/i }).click();

    // Back on the config screen.
    await expect(page.getByRole('heading', { name: /new game/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Play$/ })).toBeVisible();
  });

  test('disables Expert/Extreme for mini grids', async ({ page }) => {
    await page.goto('/play');
    await page.getByRole('button', { name: '4×4' }).click();
    await expect(page.getByRole('button', { name: 'expert' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'extreme' })).toBeDisabled();
  });

  test('solving via Hint triggers the celebration', async ({ page }) => {
    await page.goto('/play');
    await page.getByRole('button', { name: '4×4' }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();
    await expect(page.getByRole('grid', { name: /sudoku board/i })).toBeVisible();

    // A 4x4 has at most 16 holes; each Hint fills one, extras are no-ops once solved.
    const hintButton = page.getByRole('button', { name: /hint/i });
    for (let i = 0; i < 16; i++) await hintButton.click();

    await expect(page.getByText(/solved/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /new puzzle/i })).toBeVisible();
  });
});
