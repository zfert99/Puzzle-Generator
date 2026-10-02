// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from './Board';
import { useBoardStore } from '../../store/useBoardStore';
import type { SudokuPuzzle } from '@/features/engine/sudoku';
import { parseKakuroFixture } from '@/features/engine/kakuro/kakuro-fixtures';
import { parseSkyscrapersFixture } from '@/features/engine/skyscrapers/skyscrapers-fixtures';

const puzzle = (): SudokuPuzzle => ({
  grid: [
    [0, 0, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
  solution: [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
  difficulty: 'easy',
  gridSize: 4,
});

beforeEach(() => {
  useBoardStore.getState().startNewGame(puzzle());
});

describe('Board', () => {
  it('renders one gridcell per square', () => {
    render(<Board />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(16);
  });

  /**
   * F6: the ARIA grid pattern requires role="row" between grid and gridcell — gridcells used to
   * be direct children of role="grid", so screen readers could not announce row position. The
   * rows are display:contents, so this asserts the accessibility tree, not layout.
   */
  it('structures the grid as rows of gridcells with 1-based indices (F6)', () => {
    render(<Board />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    rows.forEach((row, i) => {
      expect(row).toHaveAttribute('aria-rowindex', String(i + 1));
      expect(within(row).getAllByRole('gridcell')).toHaveLength(4);
    });
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i })).toHaveAttribute(
      'aria-colindex',
      '2',
    );
  });

  it('is reachable by keyboard before any selection exists (F4)', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // (0,0) is empty/editable in the fixture, so it seeds the roving tabindex.
    const entry = screen.getByRole('gridcell', { name: /empty, row 1, column 1/i });
    expect(entry).toHaveAttribute('tabindex', '0');

    await user.tab();
    expect(entry).toHaveFocus();

    // Focus selects the cell, so typing works immediately after tabbing in.
    await user.keyboard('1');
    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();
  });

  it('seeds the entry Tab stop on the first editable cell, skipping givens', () => {
    const withGivenCorner = puzzle();
    withGivenCorner.grid[0][0] = 1; // (0,0) becomes a given; first editable is now (0,1)
    useBoardStore.getState().startNewGame(withGivenCorner);
    render(<Board />);

    expect(screen.getByRole('gridcell', { name: /given clue 1, row 1, column 1/i })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i })).toHaveAttribute('tabindex', '0');
  });

  it('moves the selection with the arrow keys (roving tabindex)', async () => {
    const user = userEvent.setup();
    render(<Board />);

    const first = screen.getByRole('gridcell', { name: /row 1, column 1/i });
    await user.click(first);
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveAttribute('tabindex', '0');

    await user.keyboard('{ArrowRight}');

    const second = screen.getByRole('gridcell', { name: /row 1, column 2/i });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveFocus();
    expect(first).toHaveAttribute('tabindex', '-1');
  });

  it('places a typed digit into the selected empty cell', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(screen.getByRole('gridcell', { name: /row 1, column 1/i }));
    await user.keyboard('1');

    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();
  });

  it('highlights every other cell holding the selected value', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // Select the given 3 at (0,2). The solution places 3 also at (1,0), (2,3), (3,1).
    await user.click(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i }));

    const otherThree = screen.getByRole('gridcell', { name: /given clue 3, row 2, column 1/i });
    expect(otherThree).toHaveAttribute('data-highlight', 'same');

    // A cell with a different value is not same-highlighted.
    const four = screen.getByRole('gridcell', { name: /given clue 4, row 1, column 4/i });
    expect(four).not.toHaveAttribute('data-highlight');
  });

  it('undoes and redoes placements with Ctrl+Z / Ctrl+Y', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(screen.getByRole('gridcell', { name: /row 1, column 1/i }));
    await user.keyboard('1');
    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();

    await user.keyboard('{Control>}z{/Control}'); // undo
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 1/i })).toBeInTheDocument();

    await user.keyboard('{Control>}y{/Control}'); // redo
    expect(screen.getByRole('gridcell', { name: /value 1, row 1, column 1/i })).toBeInTheDocument();
  });

  it('refuses to overwrite a given clue', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // (0,2) is a given with value 3.
    await user.click(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i }));
    await user.keyboard('9');

    expect(screen.getByRole('gridcell', { name: /given clue 3, row 1, column 3/i })).toBeInTheDocument();
  });
});

describe('Board — Kakuro', () => {
  // 3×3, black in two opposite corners:
  //   # 1 3        across sums: 4 / 7 / 8
  //   1 2 4        down sums:   4 / 8 / 7
  //   3 5 #
  beforeEach(() => {
    useBoardStore.getState().startNewGame(parseKakuroFixture(['#13', '124', '35#'], 'easy'));
  });

  it('draws the clue gutter: N+1 rows of N+1 cells, clue cells named by their sums', () => {
    render(<Board />);

    expect(screen.getByRole('grid', { name: 'Kakuro board' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    rows.forEach((row, i) => {
      expect(row).toHaveAttribute('aria-rowindex', String(i + 1));
      expect(within(row).getAllByRole('gridcell')).toHaveLength(4);
    });
    expect(screen.getByRole('gridcell', { name: 'Clue: across 4, down 4' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell', { name: /^Clue/ })).toHaveLength(5);
    expect(screen.getAllByRole('gridcell', { name: 'Blocked cell' })).toHaveLength(4);
    // Interior (0,1) is the third column a screen reader counts, after the gutter.
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i })).toHaveAttribute('aria-colindex', '3');
  });

  it('seeds the Tab stop on the first white cell and skips black cells with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Board />);

    const first = screen.getByRole('gridcell', { name: /empty, row 1, column 2/i });
    expect(first).toHaveAttribute('tabindex', '0');

    await user.click(screen.getByRole('gridcell', { name: /empty, row 2, column 1/i }));
    await user.keyboard('{ArrowUp}'); // (0,0) is black and the edge is next — stay put
    expect(screen.getByRole('gridcell', { name: /empty, row 2, column 1/i })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('gridcell', { name: /empty, row 3, column 2/i }));
    await user.keyboard('{ArrowRight}'); // (2,2) is black and the edge is next — stay put
    expect(screen.getByRole('gridcell', { name: /empty, row 3, column 2/i })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowUp}'); // (1,1) is white
    expect(screen.getByRole('gridcell', { name: /empty, row 2, column 2/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('accepts 7, 8 and 9 on a 3×3 — digits are 1–9 at every size', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(screen.getByRole('gridcell', { name: /empty, row 2, column 2/i }));
    await user.keyboard('9');
    expect(screen.getByRole('gridcell', { name: /value 9, row 2, column 2/i })).toBeInTheDocument();
  });

  it('highlights only run-mates as peers of the selection', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // Select the top-right white cell (0,2): its runs are the top across run and the right
    // down run — so (0,1), (1,2) are peers; (1,1) and (2,1) are not.
    await user.click(screen.getByRole('gridcell', { name: /empty, row 1, column 3/i }));
    const peerClass = (name: RegExp) => screen.getByRole('gridcell', { name }).className;
    expect(peerClass(/empty, row 1, column 2/i)).toMatch(/peer/);
    expect(peerClass(/empty, row 2, column 3/i)).toMatch(/peer/);
    expect(peerClass(/empty, row 2, column 2/i)).not.toMatch(/peer/);
  });
});

describe('Board — Skyscrapers', () => {
  // 4×4, every clue kept except the right side:
  //   top    4 2 2 1
  //   left 4 | 1 2 3 4
  //        2 | 2 1 4 3
  //        2 | 3 4 1 2
  //        1 | 4 3 2 1
  //   bottom 1 2 2 4
  beforeEach(() => {
    useBoardStore
      .getState()
      .startNewGame(parseSkyscrapersFixture(['1234', '2143', '3412', '4321'], { top: 'xxxx', bottom: 'xxxx', left: 'xxxx', right: '....' }));
  });

  it('draws a four-sided gutter: N+2 rows of N+2 cells, every row indexed, clues named by direction', () => {
    render(<Board />);

    const grid = screen.getByRole('grid', { name: 'Skyscrapers board' });
    // The gutter is outside the Tab order, so the grid's description tells a listener how to reach
    // it (G8), and every corner is a named cell rather than silence (L5).
    expect(grid).toHaveAttribute('aria-describedby', 'skyscrapers-gutter-help');
    expect(document.getElementById('skyscrapers-gutter-help')?.textContent).toMatch(/Press C to move to the clues/);
    expect(screen.getAllByRole('gridcell', { name: 'Corner' })).toHaveLength(4);
    expect(grid).toHaveAttribute('aria-rowcount', '6');
    expect(grid).toHaveAttribute('aria-colcount', '6');
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(6);
    rows.forEach((row, i) => {
      expect(row).toHaveAttribute('aria-rowindex', String(i + 1));
      const cells = within(row).getAllByRole('gridcell');
      expect(cells).toHaveLength(6);
      cells.forEach((cell, c) => expect(cell).toHaveAttribute('aria-colindex', String(c + 1)));
    });
    expect(screen.getByRole('gridcell', { name: 'Clue 4, from the top of column 1, unsolved' })).toHaveTextContent('4');
    expect(screen.getByRole('gridcell', { name: 'Clue 1, from the left of row 4, unsolved' })).toHaveTextContent('1');
    expect(screen.getAllByRole('gridcell', { name: /^No clue, right of row \d$/ })).toHaveLength(4);
    expect(screen.getAllByRole('gridcell', { name: /^Empty/ })).toHaveLength(16);
    // Interior (0,1) is the third column a screen reader counts, after the gutter.
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i })).toHaveAttribute('aria-colindex', '3');
  });

  it('frames the play area on its edge cells, not the whole board', () => {
    render(<Board />);
    const cls = (name: RegExp) => screen.getByRole('gridcell', { name }).className;
    expect(cls(/empty, row 1, column 1/i)).toMatch(/frameTop/);
    expect(cls(/empty, row 1, column 1/i)).toMatch(/frameLeft/);
    expect(cls(/empty, row 4, column 4/i)).toMatch(/frameBottom/);
    expect(cls(/empty, row 4, column 4/i)).toMatch(/frameRight/);
    expect(cls(/empty, row 2, column 2/i)).not.toMatch(/frame/);
  });

  it('judges a clue from the filled prefix: violated as soon as it is provable, satisfied on a complete line', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // Row 2's left clue is 2. Put a 4 first: the tallest is next to the clue — provably violated.
    await user.click(screen.getByRole('gridcell', { name: /empty, row 2, column 1/i }));
    await user.keyboard('4');
    expect(screen.getByRole('gridcell', { name: 'Clue 2, from the left of row 2, violated' })).toHaveAttribute('data-status', 'violated');
    // Top clue of column 1 is 4: a 4 in row 2 is not in that column's prefix (row 1 is empty) — still open.
    expect(screen.getByRole('gridcell', { name: 'Clue 4, from the top of column 1, unsolved' })).toBeInTheDocument();

    // Fix it: 2 1 4 3 satisfies "2 from the left".
    await user.keyboard('4'); // toggles the 4 off
    await user.keyboard('2');
    await user.click(screen.getByRole('gridcell', { name: /empty, row 2, column 2/i }));
    await user.keyboard('1');
    await user.click(screen.getByRole('gridcell', { name: /empty, row 2, column 3/i }));
    await user.keyboard('4');
    await user.click(screen.getByRole('gridcell', { name: /empty, row 2, column 4/i }));
    await user.keyboard('3');
    expect(screen.getByRole('gridcell', { name: 'Clue 2, from the left of row 2, satisfied' })).toHaveAttribute('data-status', 'satisfied');
  });

  it('does not announce a new game\'s reset of the done marks as a clue event', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(screen.getByRole('gridcell', { name: 'Clue 4, from the top of column 1, unsolved' }));
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('marked done');
    // Same size, no digits entered: the grid diff has nothing to say, so a stale done-flag diff
    // would be the only voice — and it would describe the NEW game's clue at that index.
    act(() =>
      useBoardStore
        .getState()
        .startNewGame(parseSkyscrapersFixture(['1234', '2413', '3142', '4321'], { top: 'xxxx', bottom: 'xxxx', left: 'xxxx', right: 'xxxx' }))
    );
    expect(document.querySelector('[aria-live="polite"]')?.textContent).not.toContain('unsolved');
  });

  it('marks a clue done by click, and by keyboard via C, arrows and Enter', async () => {
    const user = userEvent.setup();
    render(<Board />);

    // Select a play cell, click a clue: it marks done and focus comes straight back to the play
    // cell, so the next digit still lands on the board (no focus steal).
    await user.click(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i }));
    const first = screen.getByRole('gridcell', { name: 'Clue 4, from the top of column 1, unsolved' });
    await user.click(first);
    expect(screen.getByRole('gridcell', { name: 'Clue 4, from the top of column 1, marked done' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 2/i })).toHaveFocus();
    await user.keyboard('2');
    expect(screen.getByRole('gridcell', { name: /value 2, row 1, column 2/i })).toBeInTheDocument();
    await user.keyboard('2'); // toggle it back off for the rest of the test

    // Keyboard: select a play cell, C jumps to the first clue, ArrowRight to the second, Enter marks it.
    await user.click(screen.getByRole('gridcell', { name: /empty, row 1, column 1/i }));
    await user.keyboard('{Control>}c{/Control}'); // a modified C is copy, not the gutter jump
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 1/i })).toHaveFocus();
    await user.keyboard('c');
    expect(screen.getByRole('gridcell', { name: /from the top of column 1, marked done/ })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('gridcell', { name: 'Clue 2, from the top of column 2, marked done' })).toBeInTheDocument();
    // The mark is announced (G8): a screen reader does not re-read the focused cell's own name
    // when it changes, so the live region says it.
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain('Clue 2, from the top of column 2, marked done');
    // Un-marking announces the clue's restored name — the listener's state word, not the engine's "open".
    await user.keyboard('{Enter}');
    expect(screen.getByRole('gridcell', { name: 'Clue 2, from the top of column 2, unsolved' })).toBeInTheDocument();
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Clue 2, from the top of column 2, unsolved');
    // A digit typed while a clue has focus never lands on the board.
    await user.keyboard('3');
    expect(screen.queryAllByRole('gridcell', { name: /^Value/ })).toHaveLength(0);
    // Escape returns to the selected play cell.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 1/i })).toHaveFocus();
  });

  it('offers digits 1..N only and clamps at the play area edge', async () => {
    const user = userEvent.setup();
    render(<Board />);

    await user.click(screen.getByRole('gridcell', { name: /empty, row 1, column 1/i }));
    await user.keyboard('5'); // above maxNum 4 — ignored
    expect(screen.queryAllByRole('gridcell', { name: /^Value/ })).toHaveLength(0);
    await user.keyboard('{ArrowUp}'); // the gutter is not a cell — stay put
    expect(screen.getByRole('gridcell', { name: /empty, row 1, column 1/i })).toHaveAttribute('aria-selected', 'true');
  });
});
