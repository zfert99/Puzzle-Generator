// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DifficultyConfigurator } from './DifficultyConfigurator';

const zeroCounts = { easy: 0, medium: 0, hard: 0, expert: 0, extreme: 0 };

describe('DifficultyConfigurator', () => {
  it('renders a count input for all five difficulties', () => {
    render(<DifficultyConfigurator gridSize={9} counts={zeroCounts} onChange={() => {}} />);
    // easy, medium, hard, expert, extreme
    expect(screen.getAllByRole('spinbutton')).toHaveLength(5);
  });

  it('disables Expert and Extreme for mini grids and explains why', () => {
    render(<DifficultyConfigurator gridSize={4} counts={zeroCounts} onChange={() => {}} />);

    const [easy, medium, hard, expert, extreme] = screen.getAllByRole('spinbutton');
    expect(easy).toBeEnabled();
    expect(medium).toBeEnabled();
    expect(hard).toBeEnabled();
    expect(expert).toBeDisabled();
    expect(extreme).toBeDisabled();

    expect(screen.getByText(/only available for 9×9 grids/i)).toBeInTheDocument();
  });

  it('reports edits to onChange with the difficulty key and numeric value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DifficultyConfigurator gridSize={9} counts={zeroCounts} onChange={onChange} />);

    const [easy] = screen.getAllByRole('spinbutton');
    await user.type(easy, '5');

    expect(onChange).toHaveBeenCalledWith('easy', 5);
  });

  it('warns about slow generation when extreme puzzles are requested', () => {
    render(
      <DifficultyConfigurator gridSize={9} counts={{ ...zeroCounts, extreme: 1 }} onChange={() => {}} />
    );
    expect(screen.getByText(/elite-tier strategies/i)).toBeInTheDocument();
  });
});
