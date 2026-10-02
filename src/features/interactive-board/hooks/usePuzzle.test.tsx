// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePuzzle } from './usePuzzle';
import { SKYSCRAPERS_FIXTURE_6X6 } from '@/features/engine/skyscrapers/skyscrapers-fixtures';

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

  it('requests a Kakuro from the route like every other type (E4: the generator lives server-side)', async () => {
    const served = { variant: 'kakuro', gridSize: 6, grid: [], solution: [], runs: [], difficulty: 'hard' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => served });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePuzzle());
    let puzzle: unknown = null;
    await act(async () => {
      puzzle = await result.current.fetchPuzzle({ difficulty: 'easy', gridSize: 6, variant: 'kakuro' });
    });

    expect(fetchMock).toHaveBeenCalledWith('/puzzles/api/puzzle', expect.objectContaining({
      body: JSON.stringify({ difficulty: 'easy', gridSize: 6, variant: 'kakuro' }),
    }));
    // The label is the route's (the classifier's), not the request's.
    expect(puzzle).toMatchObject({ variant: 'kakuro', gridSize: 6, difficulty: 'hard' });
    expect(result.current.error).toBe('');
  });
});

describe('usePuzzle — Skyscrapers (plan slice V2)', () => {
  it('serves the baked fixture for the requested size without touching the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePuzzle());
    let returned: unknown;
    await act(async () => {
      returned = await result.current.fetchPuzzle({ difficulty: 'easy', gridSize: 6, variant: 'skyscrapers' });
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(returned).toBe(SKYSCRAPERS_FIXTURE_6X6);
    expect(result.current.puzzle).toBe(SKYSCRAPERS_FIXTURE_6X6);
    expect(result.current.loading).toBe(false);
  });
});
