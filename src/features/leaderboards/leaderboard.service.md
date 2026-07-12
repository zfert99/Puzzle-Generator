# Leaderboard Service (`leaderboard.service.ts`)

Reads for a single daily puzzle's board.

## Why public reads, but self-rank stays scoped

**Why:** The board is shared, so the top-N read has no ownership filter. But a caller's *own*
rank is still derived from their session id by the route (never a client-supplied id), so
"my rank" can't be spoofed to peek at someone else's placement. Ordering is served by the
`(puzzle_id, time_ms)` index; only completed attempts count.

## `getLeaderboard(db, puzzleId, limit=20)`

**Why join `user`:** Entries need a display name, so it joins the better-auth `user` table.
The name is `coalesce(username, name)` — the chosen public handle, falling back to the account
name if none is set. Ascending by time; rank is the row position.

```text
SELECT userId, user.name, time_ms, mistakes
  FROM solve_attempts JOIN user
  WHERE puzzle_id = puzzleId AND completed
  ORDER BY time_ms ASC LIMIT limit
-> attach rank = index + 1
```

## `getUserRank(db, puzzleId, userId)`

**Why a COUNT, not a scan:** Rank = `1 + (completed attempts strictly faster)`, computed with
a single COUNT so it stays cheap as the board grows. Ties share a rank. Returns null if the
user hasn't completed the puzzle.
