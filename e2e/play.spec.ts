import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage of the interactive board flow (Phase 3): navigate in, generate
 * a real puzzle via /api/puzzle, and interact with the board in a real browser.
 */
test.describe('Interactive play', () => {
  test('links from the hub into play mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /free play/i }).click();
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

    await page.getByRole('button', { name: /menu/i }).click();

    // Back on the config screen (the in-progress game is offered as a Continue).
    await expect(page.getByRole('heading', { name: /new game/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
  });

  test('disables Expert/Extreme for mini grids', async ({ page }) => {
    await page.goto('/play');
    await page.getByRole('button', { name: '4×4' }).click();
    await expect(page.getByRole('button', { name: 'expert' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'extreme' })).toBeDisabled();
  });

  test('solving via Hint shows the solved modal; View puzzle dismisses it', async ({ page }) => {
    await page.goto('/play');
    await page.getByRole('button', { name: '4×4' }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();
    await expect(page.getByRole('grid', { name: /sudoku board/i })).toBeVisible();

    // Hint fills one cell each; stop once the solved modal appears (it covers the pad).
    const hintButton = page.getByRole('button', { name: /hint/i });
    const dialog = page.getByRole('dialog');
    for (let i = 0; i < 16; i++) {
      if (await dialog.isVisible().catch(() => false)) break;
      await hintButton.click();
    }

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/solved/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /new puzzle/i })).toBeVisible();

    // "View puzzle" closes the modal and reveals the completed board.
    await dialog.getByRole('button', { name: /view puzzle/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('grid', { name: /sudoku board/i })).toBeVisible();
  });

  test('resumes an in-progress game after a page reload (persistence)', async ({ page }) => {
    await page.goto('/play');
    await page.getByRole('button', { name: '4×4' }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();

    const grid = page.getByRole('grid', { name: /sudoku board/i });
    await expect(grid).toBeVisible();
    await grid.getByRole('gridcell', { name: /^Empty/ }).first().click();
    await page.keyboard.press('1');
    await expect(grid.getByRole('gridcell', { name: /value 1/i }).first()).toBeVisible();

    await page.reload();

    // The play surface is menu-first: after a reload it offers the saved game as a Continue.
    await page.getByRole('button', { name: /continue/i }).click();

    // Back in the game, with the placed value intact.
    const gridAfter = page.getByRole('grid', { name: /sudoku board/i });
    await expect(gridAfter).toBeVisible();
    await expect(gridAfter.getByRole('gridcell', { name: /value 1/i }).first()).toBeVisible();
  });

  test('plays a Killer puzzle: cage overlay renders and the board starts empty', async ({ page }) => {
    await page.goto('/play');

    await page.getByRole('button', { name: /^killer$/i }).click();
    // Killer is 9×9 only with the full graded ladder (easy…extreme).
    await expect(page.getByRole('button', { name: 'expert', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'extreme', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'easy', exact: true }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();

    const grid = page.getByRole('grid', { name: /sudoku board/i });
    await expect(grid).toBeVisible({ timeout: 15000 });
    await expect(grid.getByRole('gridcell')).toHaveCount(81);

    // Killer ships no givens — every cell starts empty; the cages carry the clues.
    await expect(grid.getByRole('gridcell', { name: /^Empty/ }).first()).toBeVisible();
    // The cage overlay draws sum labels into an SVG layer on the board.
    const cageSums = page.locator('svg text');
    expect(await cageSums.count()).toBeGreaterThan(20);
  });
});
