// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
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
    // Path carries the '/puzzles' basePath via apiPath() — Next does not prefix fetch() (see src/lib/base-path.ts).
    expect(fetchMock).toHaveBeenCalledWith('/puzzles/api/generate', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ easy: 2, medium: 2, hard: 2, expert: 0, extreme: 0, gridSize: 9 }),
    }));
  });

  it('offers Killer sizes through the shared Grid Size selector and submits the chosen size', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PuzzleForm />);

    await user.click(screen.getByRole('button', { name: 'Killer' }));

    // Killer offers only 6×6 and 9×9 — the selector's sizes prop must hide 4×4.
    const sizeGroup = screen.getByRole('group', { name: /grid size/i });
    expect(within(sizeGroup).queryByRole('button', { name: '4×4' })).not.toBeInTheDocument();

    await user.click(within(sizeGroup).getByRole('button', { name: '6×6' }));
    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(fetchMock).toHaveBeenCalledWith('/puzzles/api/generate', expect.objectContaining({
      body: JSON.stringify({ variant: 'killer', gridSize: 6, easy: 2, medium: 2, hard: 2, expert: 0, extreme: 0 }),
    }));
  });

  it('offers Kakuro at its own sizes (6×6 / 7×7 / 9×9) with the full ladder, and submits the counts as entered', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PuzzleForm />);

    await user.click(screen.getByRole('button', { name: 'Kakuro' }));
    expect(screen.getByRole('heading', { name: /kakuro configuration/i })).toBeInTheDocument();

    // Kakuro's sizes are its own (D11): 6×6, 7×7 and 9×9 — no 4×4.
    const sizeGroup = screen.getByRole('group', { name: /grid size/i });
    expect(within(sizeGroup).getByRole('button', { name: '7×7' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sizeGroup).getByRole('button', { name: '6×6' })).toBeInTheDocument();
    expect(within(sizeGroup).queryByRole('button', { name: '4×4' })).not.toBeInTheDocument();
    // The full ladder is offered at every Kakuro size — unlike the Sudoku family's minis.
    expect(screen.getByRole('spinbutton', { name: /extreme/i })).toBeEnabled();
    expect(screen.queryByText(/only available for 9×9/i)).not.toBeInTheDocument();

    await user.click(within(sizeGroup).getByRole('button', { name: '9×9' }));
    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(fetchMock).toHaveBeenCalledWith('/puzzles/api/generate', expect.objectContaining({
      body: JSON.stringify({ variant: 'kakuro', gridSize: 9, easy: 2, medium: 2, hard: 2, expert: 0, extreme: 0 }),
    }));
  });

  it('offers Skyscrapers at 5×5 / 6×6 / 7×7 with no difficulty counts, and submits one puzzle', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<PuzzleForm />);

    await user.click(screen.getByRole('button', { name: 'Skyscrapers' }));
    expect(screen.getByRole('heading', { name: /skyscrapers configuration/i })).toBeInTheDocument();

    // Skyscrapers' sizes are its own (D4): 5×5, 6×6 and 7×7 — no 4×4, no 9×9; 6×6 is the default.
    const sizeGroup = screen.getByRole('group', { name: /grid size/i });
    expect(within(sizeGroup).getByRole('button', { name: '6×6' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sizeGroup).getByRole('button', { name: '5×5' })).toBeInTheDocument();
    expect(within(sizeGroup).queryByRole('button', { name: '9×9' })).not.toBeInTheDocument();
    // One hand-made, ungraded fixture per size until the generator lands: no counts to configure.
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/one hand-made/i)).toBeInTheDocument();

    await user.click(within(sizeGroup).getByRole('button', { name: '7×7' }));
    await user.click(screen.getByRole('button', { name: /generate pdf/i }));

    expect(fetchMock).toHaveBeenCalledWith('/puzzles/api/generate', expect.objectContaining({
      body: JSON.stringify({ variant: 'skyscrapers', gridSize: 7, easy: 1, medium: 0, hard: 0, expert: 0, extreme: 0 }),
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
