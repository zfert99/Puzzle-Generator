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

  /**
   * QA F5: the accessible name used to be the placeholder "0" for all five inputs — a
   * screen-reader user could not tell Easy from Extreme. The visible text is now a real
   * htmlFor/id label, which is exactly what getByLabelText resolves.
   */
  it('names each count input after its difficulty (F5)', () => {
    render(<DifficultyConfigurator gridSize={9} counts={zeroCounts} onChange={() => {}} />);

    for (const diff of ['easy', 'medium', 'hard', 'expert', 'extreme']) {
      expect(screen.getByLabelText(diff)).toHaveAttribute('type', 'number');
    }
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

  it('warns about slow generation when extreme puzzles are requested (classic)', () => {
    render(
      <DifficultyConfigurator gridSize={9} counts={{ ...zeroCounts, extreme: 1 }} onChange={() => {}} />
    );
    expect(screen.getByText(/elite-tier strategies/i)).toBeInTheDocument();
  });

  it('classic Expert alone triggers no slow-generation warning', () => {
    render(
      <DifficultyConfigurator gridSize={9} counts={{ ...zeroCounts, expert: 3 }} onChange={() => {}} />
    );
    expect(screen.queryByText(/seconds|elite-tier|hypothesis/i)).not.toBeInTheDocument();
  });

  it('Keisan Expert / Extreme warnings name the hypothesis (Nishio) cost', () => {
    const { rerender } = render(
      <DifficultyConfigurator gridSize={9} variant="calc" counts={{ ...zeroCounts, expert: 1 }} onChange={() => {}} />
    );
    expect(screen.getByText(/Keisan Expert needs a hypothesis .*1–4 seconds/i)).toBeInTheDocument();

    rerender(
      <DifficultyConfigurator gridSize={9} variant="calc" counts={{ ...zeroCounts, extreme: 1 }} onChange={() => {}} />
    );
    expect(screen.getByText(/Keisan Extreme needs many hypothesis .*2–5 seconds/i)).toBeInTheDocument();
  });

  it('Mystery mode escalates the Keisan warning to the tens-of-seconds range', () => {
    const { rerender } = render(
      <DifficultyConfigurator gridSize={9} variant="calc" mystery counts={{ ...zeroCounts, expert: 1 }} onChange={() => {}} />
    );
    expect(screen.getByText(/Mystery on.*5–15 seconds/i)).toBeInTheDocument();

    rerender(
      <DifficultyConfigurator gridSize={9} variant="calc" mystery counts={{ ...zeroCounts, extreme: 1 }} onChange={() => {}} />
    );
    expect(screen.getByText(/Mystery Extreme.*15–30 seconds.*up to a minute/i)).toBeInTheDocument();
  });
});
