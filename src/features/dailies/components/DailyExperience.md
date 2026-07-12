# DailyExperience Component (`DailyExperience.tsx`)

The client orchestrator for `/daily`. Fetches today's shared puzzle and plays it on the
same Phase 3 board, so the entire interactive board (grid, numpad, header, hints, undo,
timer, mistakes) is reused rather than reimplemented.

## Why it owns a local `phase` instead of reading the store's status

**Why:** The board store is a single, localStorage-persisted source of truth shared with
`/play`. If `/daily` gated its screens on `store.status`, a game left in progress on
`/play` would flash straight onto the daily board on load. Keeping a local
`'select' | 'playing'` phase means the player always explicitly picks a difficulty first;
only after a successful fetch does `startNewGame` overwrite the board and switch to
`'playing'`. The persisted store still powers the actual gameplay once started.

## Why fetch, not generate

**Why:** A daily must be identical for everyone, so the puzzle comes from `/api/daily`
(the stored, cron-generated board) via `useDaily` — never from the client generator. This
also keeps generation off the main thread and out of SSR (AGENTS.md §1).

```text
Until hydrated: render a neutral placeholder (avoids reading persisted state during SSR).

Phase 'select':
  Show the four daily difficulties and a Play button.
  On Play: fetch the daily; on success start the board game and go to phase 'playing'.

Phase 'playing':
  Render the shared board surface (header, board/paused, numpad, keyboard hints).
  Run a 1s timer only while actively playing.
  On solved: show a celebratory modal with time + mistakes and a note that leaderboards
    arrive later; offer a return to the difficulty picker.
```

## Ranked flow (4.4 UI)

**Why:** For a signed-in player the daily is competitive, so the component drives the ranked
endpoints around the reused board:

- On **Play**, it POSTs `/api/daily/start` **unconditionally** (not gated on the client
  `session`, which may still be loading — the auth cookie is what matters; a signed-out
  caller just gets a harmless 401). This stamps the server-side start time.
- On **solved**, a one-shot guard (`submittedRef`) POSTs `/api/solve` once with the completed
  grid + mistakes, and the returned rank is shown in the modal.
- The "submitting…" and signed-out states are **derived in render** from `session` + the
  submit result, so the effect never calls setState synchronously
  (`react-hooks/set-state-in-effect`).

The solved modal shows the rank (or a "sign in to be ranked" prompt when signed out) plus a
link to the leaderboard. The header carries the `AccountBadge`, a leaderboard link, and the
first-time `UsernamePrompt`.

## One attempt per day

**Why:** A daily is ranked, so it's one attempt per difficulty per day. On load (signed in)
the component fetches `/api/me/today` for the day's completed difficulties, and updates that
set locally the moment a solve succeeds. In the picker, a completed difficulty shows a ✓ and,
when selected, a "✓ Solved in m:ss · come back tomorrow" panel with a leaderboard link
**instead of** the Play button — so the board can't be replayed for a second (rejected) rank.

## Hints off

**Why:** The game view renders `<Numpad showHint={false} />` — hints are disabled for the
competitive daily (they'd hand out answers), while free play keeps them.
