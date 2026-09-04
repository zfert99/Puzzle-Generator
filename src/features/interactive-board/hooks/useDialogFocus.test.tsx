// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { useDialogFocus } from './useDialogFocus';

/**
 * F7 in miniature: a page with a trigger button and a conditionally-rendered dialog. The real
 * dialogs (solved / review / new-game confirm) all reduce to this shape, so the contract is
 * pinned once here — focus moves onto the primary action when the dialog opens, and returns to
 * the opener when it closes.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  const primaryRef = useDialogFocus<HTMLButtonElement>(open);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Test dialog">
          <button ref={primaryRef} type="button" onClick={() => setOpen(false)}>
            Primary action
          </button>
        </div>
      )}
    </div>
  );
}

describe('useDialogFocus', () => {
  it('moves focus onto the primary action when the dialog opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    expect(screen.getByRole('button', { name: 'Primary action' })).toHaveFocus();
  });

  it('returns focus to the opener when the dialog closes', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Primary action' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
