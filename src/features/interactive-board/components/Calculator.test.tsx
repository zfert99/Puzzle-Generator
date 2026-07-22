// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Calculator } from './Calculator';

/** Opens the popup and returns the scoped dialog + display text getter. */
async function openCalculator() {
  const user = userEvent.setup();
  render(<Calculator />);
  await user.click(screen.getByRole('button', { name: '🧮' }));
  const dialog = screen.getByRole('dialog', { name: 'Calculator' });
  const display = () => within(dialog).getByRole('status').textContent;
  return { user, dialog, display };
}

describe('Calculator', () => {
  it('is closed by default, showing only the trigger button', () => {
    render(<Calculator />);
    expect(screen.getByRole('button', { name: '🧮' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on trigger click, showing a fresh "0"', async () => {
    const { display } = await openCalculator();
    expect(display()).toBe('0');
  });

  it('does basic addition: 5 + 3 = 8', async () => {
    const { user, dialog, display } = await openCalculator();
    await user.click(within(dialog).getByRole('button', { name: '5' }));
    await user.click(within(dialog).getByRole('button', { name: '+' }));
    await user.click(within(dialog).getByRole('button', { name: '3' }));
    await user.click(within(dialog).getByRole('button', { name: '=' }));
    expect(display()).toBe('8');
  });

  it('chains operators left-to-right: 5 + 3 − 2 = 6', async () => {
    const { user, dialog, display } = await openCalculator();
    await user.click(within(dialog).getByRole('button', { name: '5' }));
    await user.click(within(dialog).getByRole('button', { name: '+' }));
    await user.click(within(dialog).getByRole('button', { name: '3' }));
    await user.click(within(dialog).getByRole('button', { name: '−' }));
    await user.click(within(dialog).getByRole('button', { name: '2' }));
    await user.click(within(dialog).getByRole('button', { name: '=' }));
    expect(display()).toBe('6');
  });

  it('supports a decimal point: 1.5 + 2 = 3.5', async () => {
    const { user, dialog, display } = await openCalculator();
    await user.click(within(dialog).getByRole('button', { name: '1' }));
    await user.click(within(dialog).getByRole('button', { name: '.' }));
    await user.click(within(dialog).getByRole('button', { name: '5' }));
    await user.click(within(dialog).getByRole('button', { name: '+' }));
    await user.click(within(dialog).getByRole('button', { name: '2' }));
    await user.click(within(dialog).getByRole('button', { name: '=' }));
    expect(display()).toBe('3.5');
  });

  it('shows Error on divide by zero', async () => {
    const { user, dialog, display } = await openCalculator();
    await user.click(within(dialog).getByRole('button', { name: '9' }));
    await user.click(within(dialog).getByRole('button', { name: '÷' }));
    await user.click(within(dialog).getByRole('button', { name: '0' }));
    await user.click(within(dialog).getByRole('button', { name: '=' }));
    expect(display()).toBe('Error');
  });

  it('backspace removes the last digit, falling back to "0" when empty', async () => {
    const { user, dialog, display } = await openCalculator();
    await user.click(within(dialog).getByRole('button', { name: '4' }));
    await user.click(within(dialog).getByRole('button', { name: '2' }));
    await user.click(within(dialog).getByRole('button', { name: 'Backspace' }));
    expect(display()).toBe('4');
    await user.click(within(dialog).getByRole('button', { name: 'Backspace' }));
    expect(display()).toBe('0');
  });

  it('C clears an in-progress calculation back to "0"', async () => {
    const { user, dialog, display } = await openCalculator();
    await user.click(within(dialog).getByRole('button', { name: '7' }));
    await user.click(within(dialog).getByRole('button', { name: '+' }));
    await user.click(within(dialog).getByRole('button', { name: 'C' }));
    expect(display()).toBe('0');
    // The pending "+" was also cleared — a bare "=" now does nothing.
    await user.click(within(dialog).getByRole('button', { name: '3' }));
    await user.click(within(dialog).getByRole('button', { name: '=' }));
    expect(display()).toBe('3');
  });

  it('closes on Escape', async () => {
    const { user } = await openCalculator();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on the ✕ button', async () => {
    const { user, dialog } = await openCalculator();
    await user.click(within(dialog).getByRole('button', { name: 'Close calculator' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('keyboard entry', () => {
    it('does basic addition via the keyboard: 5+3=8', async () => {
      const { user, display } = await openCalculator();
      await user.keyboard('5+3=');
      expect(display()).toBe('8');
    });

    it('accepts Enter as an alternative to =', async () => {
      const { user, display } = await openCalculator();
      await user.keyboard('4+4{Enter}');
      expect(display()).toBe('8');
    });

    it('maps * to × and / to ÷', async () => {
      const { user, display } = await openCalculator();
      await user.keyboard('6*7=');
      expect(display()).toBe('42');
      await user.keyboard('c9/3=');
      expect(display()).toBe('3');
    });

    it('supports a decimal point via the keyboard', async () => {
      const { user, display } = await openCalculator();
      await user.keyboard('1.5+2=');
      expect(display()).toBe('3.5');
    });

    it('supports Backspace via the keyboard', async () => {
      const { user, display } = await openCalculator();
      await user.keyboard('42{Backspace}');
      expect(display()).toBe('4');
    });

    it('supports C via the keyboard', async () => {
      const { user, display } = await openCalculator();
      await user.keyboard('7+c3=');
      expect(display()).toBe('3');
    });

    it('does not close on typed keys, only Escape', async () => {
      const { user, dialog } = await openCalculator();
      await user.keyboard('5+3=');
      expect(dialog).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
