// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePuzzle } from './usePuzzle';

const fakePuzzle = {
  grid: [[0]],
  solution: [[1]],
  difficulty: 'easy',
  gridSize: 9,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * Drives the real hook and mocks only `fetch` (the network boundary), per the
 * Mocking Boundaries rule (AGENTS.md Section 4).
 */
describe('usePuzzle', () => {
  it('POSTs the request to /api/puzzle and stores the returned puzzle', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakePuzzle,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePuzzle());

    await act(async () => {
      await result.current.fetchPuzzle({ difficulty: 'hard', gridSize: 9 });
    });

    // Path carries the '/puzzles' basePath via apiPath() — Next does not prefix fetch() (see src/lib/base-path.ts).
    expect(fetchMock).toHaveBeenCalledWith('/puzzles/api/puzzle', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: 'hard', gridSize: 9, variant: 'classic' }),
    }));
    expect(result.current.puzzle).toEqual(fakePuzzle);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('');
  });

  it('surfaces the server error message when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid difficulty: must be easy, medium, hard, expert, or extreme' }),
    }));

    const { result } = renderHook(() => usePuzzle());

    await act(async () => {
      const returned = await result.current.fetchPuzzle({ difficulty: 'easy' });
      expect(returned).toBeNull();
    });

    expect(result.current.error).toMatch(/invalid difficulty/i);
    expect(result.current.puzzle).toBeNull();
  });

  it('serves a Kakuro fixture for a known size without touching the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePuzzle());
    let puzzle: unknown = null;
    await act(async () => {
      puzzle = await result.current.fetchPuzzle({ difficulty: 'easy', gridSize: 7, variant: 'kakuro' });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(puzzle).toMatchObject({ variant: 'kakuro', gridSize: 7 });
    expect(result.current.error).toBe('');
  });

  it('reports an error for a Kakuro size with no fixture instead of serving another size', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const { result } = renderHook(() => usePuzzle());
    let puzzle: unknown = 'unset';
    await act(async () => {
      puzzle = await result.current.fetchPuzzle({ difficulty: 'easy', gridSize: 6, variant: 'kakuro' });
    });

    expect(puzzle).toBeNull();
    expect(result.current.puzzle).toBeNull();
    expect(result.current.error).toMatch(/6×6/);
  });
});
