// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { SolvedDialog } from './SolvedDialog';

// Boundary mock: `SolvedStamp` lazy-loads canvas-confetti on mount, and jsdom has no canvas.
// The dialog's own behavior (shell, stats, focus, actions) is what's under test here.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

describe('SolvedDialog', () => {
  it('renders the labelled dialog with the stamp and the formatted stats line', () => {
    render(
      <SolvedDialog
        ariaLabel="Daily solved"
        stampLabel="Daily solved!"
        elapsedSeconds={65}
        mistakes={3}
        primaryLabel="Back to difficulties"
        onPrimary={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Daily solved' })).toBeInTheDocument();
    expect(screen.getByText('Daily solved!')).toBeInTheDocument();
    expect(screen.getByText('1:05 · 3 mistakes')).toBeInTheDocument();
  });

  it('uses the singular for exactly one mistake', () => {
    render(
      <SolvedDialog
        ariaLabel="Solved"
        stampLabel="Solved!"
        elapsedSeconds={9}
        mistakes={1}
        primaryLabel="New puzzle"
        onPrimary={() => {}}
      />,
    );

    expect(screen.getByText('0:09 · 1 mistake')).toBeInTheDocument();
  });

  it('renders children between the stats and the actions, plus a secondary action', () => {
    render(
      <SolvedDialog
        ariaLabel="Practice solved"
        stampLabel="Solved!"
        elapsedSeconds={0}
        mistakes={0}
        primaryLabel="Back to archive"
        onPrimary={() => {}}
        secondaryAction={<a href="/leaderboard">Leaderboard</a>}
      >
        <p>Practice replay — not ranked.</p>
      </SolvedDialog>,
    );

    expect(screen.getByText('Practice replay — not ranked.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toBeInTheDocument();
  });

  it('fires onPrimary from the primary button', async () => {
    const onPrimary = vi.fn();
    const user = userEvent.setup();
    render(
      <SolvedDialog
        ariaLabel="Solved"
        stampLabel="Solved!"
        elapsedSeconds={5}
        mistakes={0}
        primaryLabel="New puzzle"
        onPrimary={onPrimary}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'New puzzle' }));

    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  // F7 end-to-end through the component: the callers mount SolvedDialog conditionally, so the
  // harness mirrors that shape — focus must land on the primary when it appears and return to
  // the opener when it unmounts (the wiring the three hand-rolled shells each used to carry).
  function Harness() {
    const [solved, setSolved] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setSolved(true)}>
          Solve
        </button>
        {solved && (
          <SolvedDialog
            ariaLabel="Solved"
            stampLabel="Solved!"
            elapsedSeconds={12}
            mistakes={0}
            primaryLabel="New puzzle"
            onPrimary={() => setSolved(false)}
          />
        )}
      </div>
    );
  }

  it('moves focus onto the primary action on mount and restores the opener on unmount', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const opener = screen.getByRole('button', { name: 'Solve' });
    await user.click(opener);
    expect(screen.getByRole('button', { name: 'New puzzle' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'New puzzle' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
