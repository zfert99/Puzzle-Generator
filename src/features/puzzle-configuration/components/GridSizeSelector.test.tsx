// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { GridSizeSelector } from './GridSizeSelector';

describe('GridSizeSelector', () => {
  it('renders a button for every supported grid size', () => {
    render(<GridSizeSelector value={9} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: '4×4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6×6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9×9' })).toBeInTheDocument();
  });

  it('reports the chosen size to onChange when a button is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<GridSizeSelector value={9} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '4×4' }));

    expect(onChange).toHaveBeenCalledWith(4);
  });
});
