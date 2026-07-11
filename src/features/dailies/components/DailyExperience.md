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

## Note

The solved modal is intentionally daily-specific and simpler than `/play`'s — in 4.4 it
gains the ranked-time / streak / rank-reveal treatment, at which point the solve is also
submitted to the server for validation.
