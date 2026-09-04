// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MobileNavMenu } from './MobileNavMenu';

describe('MobileNavMenu (QA F11)', () => {
  it('discloses the overflow links behind a native details/summary', async () => {
    const user = userEvent.setup();
    render(<MobileNavMenu />);

    expect(screen.getByText('More ▾')).toBeInTheDocument();
    await user.click(screen.getByText('More ▾'));

    expect(screen.getByRole('link', { name: 'Archive' })).toHaveAttribute('href', '/archive');
    expect(screen.getByRole('link', { name: 'PDF' })).toHaveAttribute('href', '/generate');
  });

  /**
   * The root layout's header persists across client navigations, so without this a menu opened
   * on one page would still be open on the next — the one behaviour that makes this leaf a
   * client component at all.
   */
  it('closes when a panel link is clicked, so navigation does not strand it open', async () => {
    const user = userEvent.setup();
    const { container } = render(<MobileNavMenu />);
    const details = container.querySelector('details')!;

    await user.click(screen.getByText('More ▾'));
    expect(details).toHaveAttribute('open');

    await user.click(screen.getByRole('link', { name: 'PDF' }));
    expect(details).not.toHaveAttribute('open');
  });
});
