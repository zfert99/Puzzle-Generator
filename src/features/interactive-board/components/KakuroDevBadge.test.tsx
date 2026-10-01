// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KAKURO_FIXTURE_7X7_CHAINS, findKakuroFixture } from '@/features/engine/kakuro/kakuro-fixtures';
import { useBoardStore } from '../store/useBoardStore';
import { KakuroDevBadge } from './KakuroDevBadge';

describe('KakuroDevBadge', () => {
  it('reports a served fixture as unique and graded, with the solver cost in nodes', () => {
    useBoardStore.getState().startNewGame(findKakuroFixture(7, 'easy')!);
    render(<KakuroDevBadge />);

    const badge = screen.getByTestId('kakuro-dev-badge');
    expect(badge).toHaveTextContent(/unique ✓ · \d+ nodes/);
    expect(badge).toHaveTextContent(/ladder: easy \(tier 1\)/);
    expect(badge).toHaveTextContent(/fixed 32/);
  });

  it('reports a chain-tier puzzle with its chain technique', () => {
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7_CHAINS);
    render(<KakuroDevBadge />);

    const badge = screen.getByTestId('kakuro-dev-badge');
    expect(badge).toHaveTextContent(/ladder: expert \(tier 4\)/);
    expect(badge).toHaveTextContent(/shortChain×1/);
  });
});
