// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SKYSCRAPERS_FIXTURE_6X6, SKYSCRAPERS_NONUNIQUE_4X4 } from '@/features/engine/skyscrapers/skyscrapers-fixtures';
import { useBoardStore } from '../store/useBoardStore';
import { SkyscrapersDevBadge } from './SkyscrapersDevBadge';

describe('SkyscrapersDevBadge', () => {
  it('reports a served fixture as unique, with the solver cost in nodes and the clue count', () => {
    useBoardStore.getState().startNewGame(SKYSCRAPERS_FIXTURE_6X6);
    render(<SkyscrapersDevBadge />);

    const badge = screen.getByTestId('skyscrapers-dev-badge');
    expect(badge).toHaveTextContent(/unique ✓ · \d+ nodes/);
    expect(badge).toHaveTextContent(/15 of 24 clues/);
  });

  it('reports a non-unique puzzle as such', () => {
    useBoardStore.getState().startNewGame(SKYSCRAPERS_NONUNIQUE_4X4[0]);
    render(<SkyscrapersDevBadge />);

    expect(screen.getByTestId('skyscrapers-dev-badge')).toHaveTextContent(/NOT unique — 2 solutions/);
  });
});
