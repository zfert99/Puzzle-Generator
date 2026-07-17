# ArchiveExperience (`ArchiveExperience.tsx`)

Client orchestrator for `/archive` — browse a past day, see its final leaderboard, and replay
its puzzle as **unranked practice**.

## Why replays are unranked

That day's leaderboard is closed; letting late solves post to it would let players pad old
boards. So the archive **never** calls `/api/solve` — its solved modal just shows the time and
says "practice replay — not ranked". Replays reuse the shared board via
`startNewGame(puzzle, 'daily', date)`, and the timer runs only while actively replaying
(`view === 'playing'`), same as the other surfaces.

## Why difficulty is lifted here

The browse view shows one `LeaderboardView` (its difficulty tabs) AND a "Play {difficulty}
(practice)" button. To keep them in sync from a single selector, difficulty is owned here and
passed to `LeaderboardView` as a controlled prop (`difficulty` + `onDifficultyChange`); the
Play button reads the same value. `Calendar` picks the date, which drives both the leaderboard
(`date` prop) and the puzzle fetch (`useDaily(difficulty, date)`).

## Shared-slot note

The board store holds one game, so starting a replay erases any parked game — hence the same
`ConfirmModal` warning as the other surfaces. A parked archive replay (mode `daily`, a past
date) resumes via the normal daily continue path and is shown as expired there (unranked),
which is consistent with it being practice.

```text
view 'browse':
  Calendar(value=date, maxDate=today) → date
  LeaderboardView(date, difficulty, onDifficultyChange)   # that day's final board
  "Play {difficulty} (practice)" → warn if a game is parked, else fetch + startNewGame + play

view 'playing':
  reused board (GameHeader / Board / Numpad / KeyboardHints); hints allowed (it's practice)
  solved → unranked modal (time + mistakes + "not ranked") → back to browse
```
