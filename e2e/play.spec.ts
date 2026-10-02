import { test, expect, dismissRulesIfShown } from './fixtures';

/**
 * End-to-end coverage of the interactive board flow (Phase 3): navigate in, generate
 * a real puzzle via /api/puzzle, and interact with the board in a real browser.
 */
test.describe('Interactive play', () => {
  test('links from the hub into play mode', async ({ page }) => {
    await page.goto('/');
    // The Sudoku card replaced the old "Free play" card (Aug 2026 hub reorg) and is the
    // plain-`/play` entry point; Killer/Keisan carry a `?variant=` query.
    await page.getByRole('link', { name: /sudoku/i }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByRole('heading', { name: /new game/i })).toBeVisible();
  });

  test('generates a 4x4 board and accepts a digit', async ({ page }) => {
    await page.goto('/play');

    await page.getByRole('button', { name: '4×4' }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();

    const grid = page.getByRole('grid', { name: /sudoku board/i });
    await expect(grid).toBeVisible();

    // A fresh browser context has never seen the rules, so the first-play dialog auto-opens
    // (QA Step 5b) as a MODAL — the board behind it is inert until it is dismissed. Assert it
    // here (this spec is the suite's canonical first game) rather than just tolerating it.
    await expect(page.getByRole('dialog', { name: 'How to play Sudoku' })).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();

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
    await dismissRulesIfShown(page);

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
    await dismissRulesIfShown(page);

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
    await dismissRulesIfShown(page);
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

  test('plays a 6×6 Killer: 36 cells, cage overlay, beginner ladder only', async ({ page }) => {
    await page.goto('/play');
    await page.getByRole('button', { name: /^killer$/i }).click();
    await page.getByRole('button', { name: '6×6', exact: true }).click();
    // Beginner size: expert/extreme gray out (same behavior as classic minis).
    await expect(page.getByRole('button', { name: 'expert', exact: true })).toBeDisabled();
    await expect(page.getByText(/only available for 9×9 grids/i)).toBeVisible();
    await page.getByRole('button', { name: 'easy', exact: true }).click();
    await page.getByRole('button', { name: /^Play$/ }).click();

    const grid = page.getByRole('grid', { name: /sudoku board/i });
    await expect(grid).toBeVisible({ timeout: 15000 });
    await expect(grid.getByRole('gridcell')).toHaveCount(36);
    expect(await page.locator('svg text').count()).toBeGreaterThan(8);
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

  test('plays a Kakuro: clue gutter, 1–9 numpad at the 6×6 mini, black cells refuse input, explained hint', async ({ page }) => {
    await page.goto('/play?variant=kakuro');

    // The deep link preselects Kakuro at its 6×6 mini (D6′). Every level is graded by the
    // solver — the full ladder is open at every size (unlike the Sudoku family's minis).
    await expect(page.getByRole('button', { name: /^kakuro$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '6×6', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'expert', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'extreme', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: /^Play$/ }).click();

    const grid = page.getByRole('grid', { name: /kakuro board/i });
    await expect(grid).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'How to play Kakuro' })).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();

    // 6×6 interior + the clue gutter = 7×7 cells; every white cell starts empty. The puzzle is
    // generated, so the white count and the clue sums vary from run to run.
    await expect(grid.getByRole('gridcell')).toHaveCount(49);
    await expect(grid.getByRole('gridcell', { name: /^Value/ })).toHaveCount(0);
    expect(await grid.getByRole('gridcell', { name: /^Empty/ }).count()).toBeGreaterThan(10);
    // The header carries the classifier's grade: E5 generates at exactly the requested tier.
    await expect(page.getByText(/easy · 6×6/)).toBeVisible();
    // Clue cells name their sums.
    const clue = grid.getByRole('gridcell', { name: /^Clue: (across|down) \d+/ }).first();
    await expect(clue).toBeVisible();

    // Digits are 1–9 at every size — the numpad offers all nine on a 6×6.
    await expect(page.getByRole('button', { name: '9', exact: true })).toBeEnabled();

    // A black cell takes no input; a white one does.
    await clue.click();
    await page.keyboard.press('5');
    await expect(grid.getByRole('gridcell', { name: /^Value/ })).toHaveCount(0);
    await grid.getByRole('gridcell', { name: /^Empty/ }).first().click();
    await page.keyboard.press('9');
    await expect(grid.getByRole('gridcell', { name: /value 9/i })).toHaveCount(1);

    // Hint is a deduction with a reason, not a bare reveal: the logical solver names the step.
    await page.keyboard.press('Backspace');
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(/Hint — /);
    await expect(page.getByText(/How we got there/)).toBeVisible();
  });

  test('plays a Skyscrapers: four-sided clue gutter, 1..N numpad at the 6×6, clue marked done, board starts empty', async ({ page }) => {
    await page.goto('/play?variant=skyscrapers');

    // The deep link preselects Skyscrapers at its 6×6 standard (D4); the full ladder is offered
    // at every size (the puzzle is generated fresh since E4, its label the classifier's).
    await expect(page.getByRole('button', { name: /^skyscrapers$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '6×6', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'extreme', exact: true })).toBeEnabled();

    // Each size offers the tiers it can produce (D12): the 7×7 starts at medium, so the default
    // easy pick clamps to the nearest offered tier and the easy button greys out; 6×6 restores it.
    await page.getByRole('button', { name: '7×7', exact: true }).click();
    await expect(page.getByRole('button', { name: 'easy', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'medium', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '6×6', exact: true }).click();
    await expect(page.getByRole('button', { name: 'easy', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: /^Play$/ }).click();

    const grid = page.getByRole('grid', { name: /skyscrapers board/i });
    await expect(grid).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'How to play Skyscrapers' })).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();

    // 6×6 interior + a gutter on all four sides = 8×8 cells; 36 play cells start empty; a fresh
    // 6×6 keeps between N − 1 and 4N clues (E3: median 11 of 24).
    await expect(grid.getByRole('gridcell')).toHaveCount(64);
    await expect(grid.getByRole('gridcell', { name: /^Empty/ })).toHaveCount(36);
    const clueCount = await grid.getByRole('gridcell', { name: /^Clue \d/ }).count();
    expect(clueCount).toBeGreaterThanOrEqual(5);
    expect(clueCount).toBeLessThanOrEqual(24);
    await expect(grid.getByRole('gridcell', { name: /^Value/ })).toHaveCount(0);

    // Digits are 1..N: the numpad offers 6 and no 7.
    await expect(page.getByRole('button', { name: '6', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '7', exact: true })).toHaveCount(0);

    // A clue marks done on click; a play cell takes a digit.
    const clue = grid.getByRole('gridcell', { name: /^Clue \d.*, unsolved$/ }).first();
    await clue.click();
    await expect(grid.getByRole('gridcell', { name: /marked done$/ })).toHaveCount(1);
    await grid.getByRole('gridcell', { name: /^Empty/ }).first().click();
    await page.keyboard.press('3');
    await expect(grid.getByRole('gridcell', { name: /value 3/i })).toHaveCount(1);
  });
});
