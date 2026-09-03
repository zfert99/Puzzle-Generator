// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardView } from './LeaderboardView';

/**
 * Covers the one thing that stopped being self-correcting when the leaderboard DTO dropped
 * `userId`: **who the highlighted row belongs to**.
 *
 * `isMe` used to be computed on every render (`session?.user.id === entry.userId`), so a session
 * change fixed the table for free. It is now decided by the server and arrives baked into the
 * fetched payload, which means the fetch itself has to re-run when the viewer changes — otherwise
 * signing out leaves the previous viewer's row labelled "(you)". `AccountBadge` signs out with
 * `signOut()` + `router.refresh()`, which re-renders Server Components but does **not** re-run a
 * client component's effects, so the dependency array is the only thing standing between a
 * signed-out visitor and a stale "(you)".
 *
 * Boundaries mocked (AGENTS.md Section 4): the auth client (no real session) and `fetch` (no
 * network). The component's own fetching/rendering logic runs for real.
 */
const h = vi.hoisted(() => ({
  session: { data: null as { user: { id: string } } | null },
}));

vi.mock('@/features/auth/auth-client', () => ({
  useSession: () => h.session,
}));

/** The bot is always rank 1; `test-user` owns rank 2 and is the row we assert about. */
function boardPayload(viewerIsSignedIn: boolean) {
  return {
    date: '2026-08-05',
    difficulty: 'mini-medium',
    entries: [
      { rank: 1, name: 'Puzzle Bot', timeMs: 60_000, mistakes: 0, isBot: true, isMe: false },
      { rank: 2, name: 'ada', timeMs: 63_000, mistakes: 2, isBot: false, isMe: viewerIsSignedIn },
    ],
    me: viewerIsSignedIn ? { rank: 2, timeMs: 63_000, mistakes: 2 } : null,
  };
}

/** Serves the board (viewer-dependent) and empty stubs for the signed-in side panels. */
function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/api/leaderboard')
      ? boardPayload(h.session.data !== null)
      : url.includes('/api/daily/slots')
        ? { date: '2026-08-05', slots: [] }
        : url.includes('/api/me/streak')
          ? { streak: 1 }
          : { bests: [] };
    return { ok: true, json: async () => body } as unknown as Response;
  });
}

let fetchMock: ReturnType<typeof stubFetch>;

beforeEach(() => {
  h.session = { data: { user: { id: 'test-user' } } };
  fetchMock = stubFetch();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('LeaderboardView — whose row is "(you)"', () => {
  it('marks the row the server flagged, without needing an id on the entry', async () => {
    render(<LeaderboardView />);

    expect(await screen.findByText('ada')).toBeInTheDocument();
    expect(screen.getByText('(you)')).toBeInTheDocument();
    // The badge is server-decided too — the client no longer knows the bot's id.
    expect(screen.getByText(/bot — beat it!/)).toBeInTheDocument();
  });

  /**
   * The regression this file exists for. Without `session?.user.id` in the fetching effect's
   * dependency array, this rerender changes nothing: the payload from the signed-in fetch stays
   * in state and the signed-out visitor keeps seeing "(you)" on somebody else's row.
   */
  it('refetches when the viewer signs out, so the stale "(you)" cannot survive', async () => {
    const { rerender } = render(<LeaderboardView />);
    expect(await screen.findByText('(you)')).toBeInTheDocument();

    const boardCallsWhileSignedIn = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/leaderboard'),
    ).length;

    h.session = { data: null };
    rerender(<LeaderboardView />);

    await waitFor(() => expect(screen.queryByText('(you)')).not.toBeInTheDocument());
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/leaderboard')).length,
    ).toBeGreaterThan(boardCallsWhileSignedIn);
    // The board itself is public — the rows stay, only the ownership marker clears.
    expect(screen.getByText('ada')).toBeInTheDocument();
  });

  it('does not refetch the board on a rerender that leaves the viewer unchanged', async () => {
    const { rerender } = render(<LeaderboardView />);
    expect(await screen.findByText('ada')).toBeInTheDocument();

    const before = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/leaderboard')).length;
    // A new session OBJECT with the same id — keying the effect on the object rather than the id
    // would refetch here on every auth-client re-render.
    h.session = { data: { user: { id: 'test-user' } } };
    rerender(<LeaderboardView />);

    await waitFor(() => expect(screen.getByText('ada')).toBeInTheDocument());
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/leaderboard')).length,
    ).toBe(before);
  });
});

/**
 * QA finding D1: archived dates from the retired 30-key era (2026-07-20 → 07-31) hold 19–33
 * boards, which as chip rows is a wall of tabs. Over 12 slots the picker collapses to a grouped
 * <select> — presentation only: every key stays selectable, because retired keys must remain
 * readable and replayable (a standing /pre-merge invariant).
 */
describe('LeaderboardView — legacy-shaped days collapse the picker', () => {
  /** A legacy-era slot list: n unique keys split across both sections. */
  function legacySlots(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const mini = i % 3 === 2; // roughly a third minis, like the real legacy registry
      return {
        key: `legacy-${i}`,
        variant: (['classic', 'killer', 'calc'] as const)[i % 3],
        difficulty: ['easy', 'medium', 'hard', 'expert', 'extreme'][i % 5],
        gridSize: mini ? 4 : 9,
        section: mini ? 'mini' : 'standard',
      };
    });
  }

  function stubFetchWithSlots(slotCount: number) {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/leaderboard')
        ? boardPayload(h.session.data !== null)
        : url.includes('/api/daily/slots')
          ? { date: '2026-07-25', slots: legacySlots(slotCount) }
          : url.includes('/api/me/streak')
            ? { streak: 1 }
            : { bests: [] };
      return { ok: true, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal('fetch', mock);
    return mock;
  }

  it('renders a grouped select instead of chip rows when a day holds more than 12 boards', async () => {
    stubFetchWithSlots(33); // the worst measured legacy day

    render(<LeaderboardView date="2026-07-25" />);

    const picker = await screen.findByRole('combobox', { name: 'Board' });
    expect(picker.querySelectorAll('option')).toHaveLength(33);
    // Grouped, not flat — the sections survive the collapse.
    expect(screen.getByRole('group', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Minis' })).toBeInTheDocument();
    // No chip row remains alongside it.
    expect(screen.queryByRole('button', { name: /·/ })).not.toBeInTheDocument();
  });

  it('every legacy key stays selectable, and selecting one refetches its board', async () => {
    const mock = stubFetchWithSlots(20);

    render(<LeaderboardView date="2026-07-25" />);
    const picker = await screen.findByRole('combobox', { name: 'Board' });

    const before = mock.mock.calls.filter((c) => String(c[0]).includes('/api/leaderboard')).length;
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.setup().selectOptions(picker, 'legacy-7');

    await waitFor(() =>
      expect(
        mock.mock.calls.filter((c) => String(c[0]).includes('difficulty=legacy-7')).length,
      ).toBeGreaterThan(0),
    );
    expect(
      mock.mock.calls.filter((c) => String(c[0]).includes('/api/leaderboard')).length,
    ).toBeGreaterThan(before);
  });

  it('keeps the chip rows for a current-model day (6 boards)', async () => {
    stubFetchWithSlots(6);

    render(<LeaderboardView date="2026-08-05" />);

    expect((await screen.findAllByRole('button', { name: /·/ })).length).toBe(6);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
