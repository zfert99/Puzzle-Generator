// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KAKURO_FIXTURE_7X7 } from '@/features/engine/kakuro/kakuro-fixtures';
import { useBoardStore } from '../store/useBoardStore';
import { KakuroDevBadge } from './KakuroDevBadge';

describe('KakuroDevBadge', () => {
  it('reports the baked 7×7 as unique, with the solver cost in nodes', () => {
    useBoardStore.getState().startNewGame(KAKURO_FIXTURE_7X7);
    render(<KakuroDevBadge />);

    expect(screen.getByTestId('kakuro-dev-badge')).toHaveTextContent(/unique ✓ · \d+ nodes$/);
  });
});
