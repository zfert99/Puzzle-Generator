// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { Modal } from './Modal';

function Harness({ onDismiss = () => {} }: { onDismiss?: () => void }) {
  const [open, setOpen] = useState(false);
  const secondRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal
        open={open}
        ariaLabel="Example"
        initialFocusRef={secondRef}
        onDismiss={() => {
          onDismiss();
          setOpen(false);
        }}
      >
        <button type="button">First</button>
        <button ref={secondRef} type="button" onClick={() => setOpen(false)}>
          Second
        </button>
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('renders nothing while closed and a native labelled dialog while open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Example' });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
  });

  it('focuses the requested control on open and hands focus back to the opener on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Second' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('dismisses on Escape (the native cancel) and on a backdrop click, never on a card click', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<Harness onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Example' });
    // jsdom does not turn Escape into a `cancel` event; dispatch what the browser would.
    dialog.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'First' }));
    expect(onDismiss).toHaveBeenCalledTimes(1); // a click inside the card is not a dismiss
    await user.click(screen.getByRole('dialog', { name: 'Example' })); // the dialog box itself = backdrop
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
