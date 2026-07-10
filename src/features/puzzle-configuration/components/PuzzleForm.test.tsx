// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PuzzleForm from './PuzzleForm';

/**
 * These tests drive the REAL usePuzzleGeneration hook and mock only `fetch` —
 * the application's network boundary. AGENTS.md Section 4 ("Mocking Boundaries")
 * forbids mocking internal modules like the hook itself; doing so would let the
 * hook's real behaviour (validation, loading state, error handling) rot untested.
 */
describe('PuzzleForm Component', () => {
  beforeEach(() => {
    // jsdom does not implement object-URL APIs used by the download path.
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders correctly with default values', () => {
    render(<PuzzleForm />);
    expect(screen.getByRole('heading', { name: /sudoku configuration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate pdf/i })).toBeInTheDocument();
  });

  it('POSTs the correct configuration to /api/generate when submitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PuzzleForm />);

    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    // Defaults: gridSize=9, easy=2, medium=2, hard=2, expert=0, extreme=0
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ easy: 2, medium: 2, hard: 2, expert: 0, extreme: 0, gridSize: 9 }),
    }));
  });

  it('shows the loading state while a request is in flight', async () => {
    // A fetch that never resolves keeps the hook in its loading state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const user = userEvent.setup();
    render(<PuzzleForm />);

    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    const busyButton = await screen.findByRole('button', { name: /generating/i });
    expect(busyButton).toBeDisabled();
  });

  it('displays an error message when the server rejects the request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Too many puzzles.' }),
    }));

    const user = userEvent.setup();
    render(<PuzzleForm />);

    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(await screen.findByText('Too many puzzles.')).toBeInTheDocument();
  });
});
