// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesDialog, hasSeenRules, markRulesSeen } from './RulesDialog';

beforeEach(() => {
  localStorage.clear();
});

describe('rules seen persistence (5b)', () => {
  it('is tracked PER TYPE, not as one global flag', () => {
    expect(hasSeenRules('classic')).toBe(false);

    markRulesSeen('classic');

    expect(hasSeenRules('classic')).toBe(true);
    expect(hasSeenRules('killer')).toBe(false);
    expect(hasSeenRules('calc')).toBe(false);
  });

  it('treats an unreadable store as "not seen" instead of throwing', () => {
    localStorage.setItem('pl-rules-seen', 'not json');
    expect(hasSeenRules('classic')).toBe(false);
    expect(() => markRulesSeen('classic')).not.toThrow();
  });
});

describe('RulesDialog (5a content)', () => {
  it('explains cages and the no-repeat rule for Killer', () => {
    render(<RulesDialog variant="killer" open onClose={() => {}} />);

    expect(screen.getByRole('heading', { name: 'How to play Killer' })).toBeInTheDocument();
    expect(screen.getByText(/add up to the small number/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot repeat inside a cage/i)).toBeInTheDocument();
  });

  it('explains the boxless grid, in-cage repeats, and Mystery mode for Keisan', () => {
    render(<RulesDialog variant="calc" open onClose={() => {}} />);

    expect(screen.getByRole('heading', { name: 'How to play Keisan' })).toBeInTheDocument();
    expect(screen.getByText(/no boxes/i)).toBeInTheDocument();
    expect(screen.getByText(/may repeat inside a cage/i)).toBeInTheDocument();
    // The genuinely non-obvious mode the QA doc calls out as unexplained anywhere in the UI.
    expect(screen.getByText(/Mystery mode/)).toBeInTheDocument();
  });

  it('closes through its button, reporting up via onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RulesDialog variant="classic" open onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    expect(onClose).toHaveBeenCalled();
  });
});
